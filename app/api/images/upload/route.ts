/**
 * Image Upload API - Uploads images to Acontext Disk
 * POST /api/images/upload
 * Body: FormData { file: File, documentId: string }
 * Response: { url: "disk::images/xxx.png", diskId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcontextConfig, createAcontextClient } from '@/lib/acontext/client';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';
import { FileUpload } from '@acontext/acontext';

const LOG_TAG = '[api/images/upload]';

export async function POST(request: NextRequest) {
  try {
    // Get user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentId = formData.get('documentId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!documentId) {
      return NextResponse.json({ error: 'No documentId provided' }, { status: 400 });
    }

    // Check Acontext config
    const config = getAcontextConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Acontext not configured, falling back to Supabase' },
        { status: 503 }
      );
    }

    // Create Acontext client
    const client = createAcontextClient(config);

    // Get or create chat session to get disk ID
    const session = await getOrCreateChatSession({
      userId: user.id,
      documentId,
      acontextClient: client,
    });

    const diskId = session.acontextDiskId;

    // Generate file path
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? ext : 'png';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2);
    const filename = `${timestamp}-${randomStr}.${safeExt}`;
    const filePath = 'images';

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create FileUpload for Acontext
    const fileUpload = new FileUpload({
      filename,
      content: buffer,
      contentType: file.type || `image/${safeExt}`,
    });

    console.log(LOG_TAG, 'Uploading to disk', { diskId, filePath, filename });

    // Upload to Acontext Disk
    const artifact = await client.disks.artifacts.upsert(diskId, {
      file: fileUpload,
      filePath,
    });

    console.log(LOG_TAG, 'Upload successful', { artifact });

    // Return disk:: protocol URL
    const diskUrl = `disk::${filePath}/${filename}`;

    return NextResponse.json({
      url: diskUrl,
      diskId,
      artifact: {
        path: artifact.path,
        filename: artifact.filename,
      },
    });
  } catch (error) {
    console.error(LOG_TAG, 'Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
