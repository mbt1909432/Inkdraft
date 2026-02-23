/**
 * Chat session management with Supabase for Acontext session mapping
 */

import { createClient } from '@/lib/supabase/server';
import type { AcontextClient } from '@acontext/acontext';
import { createSessionWithDisk } from './client';
import type { ChatSession } from './types';

const LOG_TAG = '[acontext/session-store]';

/**
 * Get or create a chat session for a user/document
 */
export async function getOrCreateChatSession(options: {
  userId: string;
  documentId?: string;
  acontextClient: AcontextClient;
}): Promise<ChatSession> {
  const { userId, documentId, acontextClient } = options;
  const supabase = await createClient();

  // Try to find existing session
  let query = supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId);

  if (documentId) {
    query = query.eq('document_id', documentId);
  } else {
    query = query.is('document_id', null);
  }

  const { data: existing, error: fetchError } = await query.maybeSingle();

  if (fetchError) {
    console.error(LOG_TAG, 'Error fetching chat session', fetchError);
    throw fetchError;
  }

  if (existing) {
    console.log(LOG_TAG, 'Found existing chat session', { id: existing.id });

    return {
      id: existing.id,
      userId: existing.user_id,
      documentId: existing.document_id,
      acontextSessionId: existing.acontext_session_id,
      acontextDiskId: existing.acontext_disk_id,
      title: existing.title,
      createdAt: new Date(existing.created_at),
      updatedAt: new Date(existing.updated_at),
    };
  }

  // Create new session in Acontext
  const { sessionId, diskId } = await createSessionWithDisk(acontextClient, {
    user: userId,
  });

  // Store mapping in Supabase
  const { data: newSession, error: insertError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      document_id: documentId || null,
      acontext_session_id: sessionId,
      acontext_disk_id: diskId,
    })
    .select()
    .single();

  if (insertError) {
    console.error(LOG_TAG, 'Error creating chat session', insertError);
    throw insertError;
  }

  console.log(LOG_TAG, 'Created new chat session', { id: newSession.id });

  return {
    id: newSession.id,
    userId: newSession.user_id,
    documentId: newSession.document_id,
    acontextSessionId: newSession.acontext_session_id,
    acontextDiskId: newSession.acontext_disk_id,
    title: newSession.title,
    createdAt: new Date(newSession.created_at),
    updatedAt: new Date(newSession.updated_at),
  };
}

/**
 * Get all chat sessions for a user
 */
export async function getUserChatSessions(userId: string): Promise<ChatSession[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error(LOG_TAG, 'Error fetching user chat sessions', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    documentId: row.document_id,
    acontextSessionId: row.acontext_session_id,
    acontextDiskId: row.acontext_disk_id,
    title: row.title,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error(LOG_TAG, 'Error deleting chat session', error);
    throw error;
  }

  console.log(LOG_TAG, 'Deleted chat session', { id: sessionId });
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId);

  if (error) {
    console.error(LOG_TAG, 'Error updating chat session title', error);
    throw error;
  }
}
