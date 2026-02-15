import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface FolderInput {
  name: string;
  parent_folder_id?: string | null;
}

// GET /api/folders - Get all folders
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
    const parentId = searchParams.get('parentId');

    let query = supabase
      .from('folders')
      .select('*')
      .order('name', { ascending: true });

    if (parentId === 'null') {
      query = query.is('parent_folder_id', null);
    } else if (parentId) {
      query = query.eq('parent_folder_id', parentId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders: data });
  } catch (error) {
    console.error('Error in GET /api/folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/folders - Create a new folder
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: FolderInput = await request.json();

    const { data, error } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name: body.name,
        parent_folder_id: body.parent_folder_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folder: data });
  } catch (error) {
    console.error('Error in POST /api/folders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
