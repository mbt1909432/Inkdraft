/**
 * Image Proxy API - Proxies disk:: images for MDXEditor rendering
 * GET /api/images/proxy?path=images/xxx.png&documentId=xxx
 * Response: Image data (redirect to public URL)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcontextConfig, createAcontextClient } from '@/lib/acontext/client';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';

const LOG_TAG = '[api/images/proxy]';

/**
 * Normalize file path for get operations
 * Returns { filePath: '/path/', filename: 'file.png' }
 */
function parseFilePath(path: string): { filePath: string; filename: string } {
  // Remove leading/trailing slashes for parsing
  let cleanPath = path.replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/');
  const filename = parts.pop() || '';
  let filePath = parts.join('/');

  // Normalize filePath to /path/ format
  if (filePath) {
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath;
    }
    if (!filePath.endsWith('/')) {
      filePath = filePath + '/';
    }
  } else {
    filePath = '/';
  }

  return { filePath, filename };
}

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

    // Parse path to get filePath and filename in Acontext format
    const { filePath, filename } = parseFilePath(path);

    console.log(LOG_TAG, 'Getting public URL for proxy', { diskId, filePath, filename, rawPath: path });

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

    // Redirect to public URL
    return NextResponse.redirect(result.public_url);
  } catch (error) {
    console.error(LOG_TAG, 'Error proxying image:', error);
    const message = error instanceof Error ? error.message : 'Failed to proxy image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
