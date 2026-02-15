import { createClient } from '@/lib/supabase/client';
import type { Document } from '@/lib/types';

export async function getDocuments(folderId?: string | null): Promise<Document[]> {
  const supabase = createClient();

  let query = supabase
    .from('documents')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('last_edited_at', { ascending: false });

  if (folderId === null) {
    query = query.is('parent_folder_id', null);
  } else if (folderId) {
    query = query.eq('parent_folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }

  return data || [];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getDocument(id: string): Promise<Document | null> {
  if (!id || !UUID_REGEX.test(id.trim())) {
    return null; // Invalid UUID (e.g. placeholder %%drp:id:xxx%%) causes PostgreSQL 22P02
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Document not found (no row or RLS)
    }
    // Log full error for debugging (e.g. session/RLS on production)
    console.error('Error fetching document:', { id, code: error.code, message: error.message });
    throw error;
  }

  return data;
}

export async function createDocument(doc: {
  title?: string;
  content?: string;
  parent_folder_id?: string | null;
}): Promise<Document> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      title: doc.title || 'Untitled',
      content: doc.content || '',
      parent_folder_id: doc.parent_folder_id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document:', error);
    throw error;
  }

  return data;
}

export async function updateDocument(
  id: string,
  updates: {
    title?: string;
    content?: string;
    parent_folder_id?: string | null;
    is_pinned?: boolean;
  }
): Promise<Document> {
  const supabase = createClient();

  // First get the current document to increment version
  const { data: currentDoc, error: fetchError } = await supabase
    .from('documents')
    .select('version')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching document for update:', fetchError);
    throw fetchError;
  }

  const { data, error } = await supabase
    .from('documents')
    .update({
      ...updates,
      version: (currentDoc?.version || 1) + 1,
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating document:', error);
    throw error;
  }

  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

export async function toggleDocumentPin(id: string): Promise<Document> {
  const supabase = createClient();

  // Get current pin status
  const { data: currentDoc, error: fetchError } = await supabase
    .from('documents')
    .select('is_pinned')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Error fetching document for pin toggle:', fetchError);
    throw fetchError;
  }

  const { data, error } = await supabase
    .from('documents')
    .update({ is_pinned: !currentDoc?.is_pinned })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error toggling document pin:', error);
    throw error;
  }

  return data;
}

export async function searchDocuments(query: string): Promise<Document[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('last_edited_at', { ascending: false });

  if (error) {
    console.error('Error searching documents:', error);
    throw error;
  }

  return data || [];
}
