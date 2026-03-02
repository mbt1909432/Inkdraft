/**
 * Refresh chat session - delete old session and create new one
 * Keeps the same disk (files preserved), only resets message history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAcontextConfig, createAcontextClient } from '@/lib/acontext/client';

const LOG_TAG = '[api/chat-acontext/refresh]';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Acontext client
    const config = getAcontextConfig();
    if (!config) {
      return NextResponse.json({ error: 'Acontext not configured' }, { status: 500 });
    }
    const acontextClient = createAcontextClient(config);

    // Find existing session
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id);

    if (documentId) {
      query = query.eq('document_id', documentId);
    } else {
      query = query.is('document_id', null);
    }

    const { data: existingSession, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      console.error(LOG_TAG, 'Error fetching session', fetchError);
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }

    // If session exists, delete old session (keep disk!)
    if (existingSession) {
      console.log(LOG_TAG, 'Deleting old session (keeping disk)', {
        sessionId: existingSession.acontext_session_id,
        diskId: existingSession.acontext_disk_id,
      });

      try {
        await acontextClient.sessions.delete(existingSession.acontext_session_id);
      } catch (deleteError) {
        // Log but don't fail - old session might already be gone
        console.warn(LOG_TAG, 'Failed to delete old session (continuing)', deleteError);
      }
    }

    // Create new session (without new disk - we reuse the old one)
    const newSession = await acontextClient.sessions.create({
      user: user.id,
    });

    console.log(LOG_TAG, 'Created new session', { sessionId: newSession.id });

    // Use existing disk or null if no previous session
    const diskId = existingSession?.acontext_disk_id;

    // Update or insert in Supabase
    let updatedSession;
    if (existingSession) {
      // Update existing record - only change session_id, keep disk_id
      const { data, error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          acontext_session_id: newSession.id,
          // disk_id stays the same
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSession.id)
        .select()
        .single();

      if (updateError) {
        console.error(LOG_TAG, 'Error updating session', updateError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
      updatedSession = data;
    } else {
      // No previous session - create new record (no disk to preserve)
      const { data, error: insertError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          document_id: documentId || null,
          acontext_session_id: newSession.id,
          acontext_disk_id: null, // Will be created when first file is uploaded
        })
        .select()
        .single();

      if (insertError) {
        console.error(LOG_TAG, 'Error creating session', insertError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
      updatedSession = data;
    }

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        acontextSessionId: newSession.id,
        acontextDiskId: diskId,
      },
    });

  } catch (error) {
    console.error(LOG_TAG, 'Error refreshing session', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh session' },
      { status: 500 }
    );
  }
}
