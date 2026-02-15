import { createClient } from '@/lib/supabase/client';
import type { Folder } from '@/lib/types';

export async function getFolders(parentId?: string | null): Promise<Folder[]> {
  const supabase = createClient();

  let query = supabase
    .from('folders')
    .select('*')
    .order('name', { ascending: true });

  if (parentId === null) {
    query = query.is('parent_folder_id', null);
  } else if (parentId) {
    query = query.eq('parent_folder_id', parentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching folders:', error);
    throw error;
  }

  return data || [];
}

export async function getAllFolders(): Promise<Folder[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching all folders:', error);
    throw error;
  }

  return data || [];
}

export async function createFolder(name: string, parentFolderId?: string | null): Promise<Folder> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      name,
      parent_folder_id: parentFolderId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return data;
}

export async function updateFolder(id: string, name: string): Promise<Folder> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating folder:', error);
    throw error;
  }

  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('folders').delete().eq('id', id);

  if (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
}
