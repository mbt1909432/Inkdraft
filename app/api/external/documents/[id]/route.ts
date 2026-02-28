import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

const LOG_TAG = '[api/external/documents/[id]]';

// Verify API key and return user_id
async function verifyApiKey(authHeader: string | null): Promise<{ userId: string; error?: string } | null> {
  if (!authHeader) {
    return null;
  }

  let key = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    key = authHeader.slice(7);
  }

  if (!key.startsWith('sk_') || key.length < 10) {
    return null;
  }

  const keyHash = createHash('sha256').update(key).digest('hex');
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, id, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) {
    return null;
  }

  // Check expiration
  if (data.expires_at) {
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return { userId: '', error: 'API key has expired' };
    }
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { userId: data.user_id };
}

// GET - Get a single document
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
    const result = await verifyApiKey(authHeader);

    if (!result) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: document, error } = await supabase
      .from('documents')
      .select('id, title, content, created_at, updated_at, parent_folder_id')
      .eq('id', id)
      .eq('user_id', result.userId)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, document });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a document
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
    const result = await verifyApiKey(authHeader);

    if (!result) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    // Check document exists and belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', result.userId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Parse body
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.content !== undefined) {
      if (typeof body.content !== 'string') {
        return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
      }
      if (body.content.length > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Content too large (max 10MB)' }, { status: 400 });
      }
      updates.content = body.content;
    }

    // Update document
    const { data: document, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select('id, title, updated_at')
      .single();

    if (error) {
      console.error(LOG_TAG, 'Error updating document', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a document
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
    const result = await verifyApiKey(authHeader);

    if (!result) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServiceClient();

    // Delete document (RLS will ensure user owns it)
    const { error, count } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', result.userId);

    if (error) {
      console.error(LOG_TAG, 'Error deleting document', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error(LOG_TAG, 'Error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
