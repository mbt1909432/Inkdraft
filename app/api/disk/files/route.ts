/**
 * Disk Files API - Lists and deletes files from Acontext Disk
 * GET /api/disk/files?documentId=xxx&path=images
 * DELETE /api/disk/files?documentId=xxx&path=images/xxx.png
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcontextConfig, createAcontextClient } from '@/lib/acontext/client';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';

const LOG_TAG = '[api/disk/files]';

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
    const documentId = searchParams.get('documentId');
    const path = searchParams.get('path') || '/';

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
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

    console.log(LOG_TAG, 'Listing files', { diskId, path });

    // List artifacts in disk
    const result = await client.disks.artifacts.list(diskId, {
      path: path === '/' ? undefined : path,
    });

    console.log(LOG_TAG, 'List result', {
      artifactCount: result.artifacts?.length || 0,
      directories: result.directories,
    });

    // Format response
    const files = (result.artifacts || []).map((artifact) => ({
      path: artifact.path,
      filename: artifact.filename,
      fullPath: artifact.path ? `${artifact.path}/${artifact.filename}` : artifact.filename,
      createdAt: artifact.created_at,
      updatedAt: artifact.updated_at,
      meta: artifact.meta,
    }));

    return NextResponse.json({
      files,
      directories: result.directories || [],
      diskId,
    });
  } catch (error) {
    console.error(LOG_TAG, 'Error listing files:', error);
    const message = error instanceof Error ? error.message : 'Failed to list files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const documentId = searchParams.get('documentId');
    const path = searchParams.get('path');

    if (!documentId || !path) {
      return NextResponse.json(
        { error: 'Missing documentId or path' },
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
    const pathParts = path.split('/');
    const filename = pathParts.pop() || '';
    const filePath = pathParts.join('/') || '';

    console.log(LOG_TAG, 'Deleting file', { diskId, filePath, filename });

    // Delete artifact
    await client.disks.artifacts.delete(diskId, {
      filePath,
      filename,
    });

    console.log(LOG_TAG, 'Delete successful');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(LOG_TAG, 'Error deleting file:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
