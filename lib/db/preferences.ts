import { createClient } from '@/lib/supabase/client';
import type { UserPreferences } from '@/lib/types';

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No preferences found, create default
      return createDefaultPreferences();
    }
    console.error('Error fetching user preferences:', error);
    throw error;
  }

  return data;
}

export async function createDefaultPreferences(): Promise<UserPreferences> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .insert({
      user_id: user.id,
      theme: 'system',
      auto_save_enabled: true,
      show_outline: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user preferences:', error);
    throw error;
  }

  return data;
}

export async function updateUserPreferences(
  updates: Partial<Pick<UserPreferences, 'theme' | 'auto_save_enabled' | 'show_outline'>>
): Promise<UserPreferences> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }

  return data;
}
