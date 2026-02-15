import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface DocumentInput {
  title?: string;
  content?: string;
  parent_folder_id?: string | null;
}

// GET /api/documents - Get all documents or documents in a folder
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');
    const search = searchParams.get('search');

    let query = supabase
      .from('documents')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('last_edited_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    } else if (folderId === 'null') {
      query = query.is('parent_folder_id', null);
    } else if (folderId) {
      query = query.eq('parent_folder_id', folderId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ documents: data });
  } catch (error) {
    console.error('Error in GET /api/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/documents - Create a new document
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: DocumentInput = await request.json();

    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        title: body.title || 'Untitled',
        content: body.content || '',
        parent_folder_id: body.parent_folder_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error('Error in POST /api/documents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
