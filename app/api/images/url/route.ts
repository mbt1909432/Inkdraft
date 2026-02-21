/**
 * Image URL API - Gets public URL for disk:: images
 * GET /api/images/url?path=images/xxx.png&documentId=xxx
 * Response: { url: "https://acontextcdn.com/..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcontextConfig, createAcontextClient } from '@/lib/acontext/client';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';

const LOG_TAG = '[api/images/url]';

export async function GET(request: NextRequest) {
  try {
    // Get user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const documentId = searchParams.get('documentId');

    if (!path || !documentId) {
      return NextResponse.json(
        { error: 'Missing path or documentId' },
        { status: 400 }
      );
    }

    // Check Acontext config
    const config = getAcontextConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Acontext not configured' },
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

    // Parse path to get filePath and filename
    // path format: "images/xxx.png" -> filePath: "images", filename: "xxx.png"
    const pathParts = path.split('/');
    const filename = pathParts.pop() || '';
    const filePath = pathParts.join('/') || '';

    console.log(LOG_TAG, 'Getting public URL', { diskId, filePath, filename });

    // Get artifact with public URL
    const result = await client.disks.artifacts.get(diskId, {
      filePath,
      filename,
      withPublicUrl: true,
      withContent: false,
    });

    if (!result.public_url) {
      return NextResponse.json(
        { error: 'Failed to get public URL' },
        { status: 500 }
      );
    }

    console.log(LOG_TAG, 'Got public URL', { publicUrl: result.public_url });

    return NextResponse.json({ url: result.public_url });
  } catch (error) {
    console.error(LOG_TAG, 'Error getting URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to get URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
