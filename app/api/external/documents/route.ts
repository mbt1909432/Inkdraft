import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

const LOG_TAG = '[api/external/documents]';

// Verify API key and return user_id
async function verifyApiKey(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;

  // Support both "Bearer sk_xxx" and "sk_xxx" formats
  let key = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    key = authHeader.slice(7);
  }

  // Validate key format
  if (!key.startsWith('sk_') || key.length < 10) {
    return null;
  }

  // Hash the key
  const keyHash = createHash('sha256').update(key).digest('hex');

  // Look up the key
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, id')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return null;
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return data.user_id;
}

// POST - Upload a document via API key
export async function POST(request: Request) {
  try {
    // Verify API key
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
    const userId = await verifyApiKey(authHeader);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or missing API key. Use Authorization: Bearer sk_xxx or X-API-Key: sk_xxx' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Parse request body
    const contentType = request.headers.get('content-type') || '';

    let title: string;
    let content: string;
    let folderId: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (file upload)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const titleField = formData.get('title') as string | null;
      folderId = formData.get('folder_id') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      title = titleField || file.name.replace(/\.[^.]+$/, '');
      content = await file.text();
    } else {
      // Handle JSON body
      const body = await request.json();
      title = body.title || 'Untitled Document';
      content = body.content || '';
      folderId = body.folder_id || null;
    }

    // Validate
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (content.length > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ error: 'Content too large (max 10MB)' }, { status: 400 });
    }

    // Verify folder belongs to user if specified
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', userId)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
    }

    // Create document
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        title,
        content,
        folder_id: folderId,
      })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      console.error(LOG_TAG, 'Error creating document', error);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
    });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - List documents via API key
export async function GET(request: Request) {
  try {
    // Verify API key
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
    const userId = await verifyApiKey(authHeader);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const url = new URL(request.url);

    // Query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const folderId = url.searchParams.get('folder_id');

    let query = supabase
      .from('documents')
      .select('id, title, created_at, updated_at, folder_id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (folderId) {
      query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(LOG_TAG, 'Error fetching documents', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documents: data,
    });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
