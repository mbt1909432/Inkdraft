import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getAcontextConfig, createAcontextClient, deleteSessionAndDisk } from '@/lib/acontext';

const LOG_TAG = '[api/ai/chat-acontext/cleanup]';

/**
 * DELETE /api/ai/chat-acontext/cleanup
 * Delete Acontext session and disk for a document
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const acontextConfig = getAcontextConfig();
    if (!acontextConfig) {
      // Acontext not configured, nothing to clean up
      return NextResponse.json({ success: true, message: 'Acontext not configured' });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Find chat session for this document
    const { data: chatSession, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('document_id', documentId)
      .maybeSingle();

    if (fetchError) {
      console.error(LOG_TAG, 'Error fetching chat session', fetchError);
      return NextResponse.json({ error: 'Failed to fetch chat session' }, { status: 500 });
    }

    if (!chatSession) {
      // No chat session for this document
      return NextResponse.json({ success: true, message: 'No chat session found' });
    }

    // Delete Acontext session and disk
    const acontextClient = createAcontextClient(acontextConfig);
    try {
      await deleteSessionAndDisk(
        acontextClient,
        chatSession.acontext_session_id,
        chatSession.acontext_disk_id
      );
      console.log(LOG_TAG, 'Deleted Acontext resources', {
        sessionId: chatSession.acontext_session_id,
        diskId: chatSession.acontext_disk_id,
      });
    } catch (err) {
      console.error(LOG_TAG, 'Failed to delete Acontext resources', err);
      // Continue to delete DB record even if Acontext deletion fails
    }

    // Delete chat session from database
    const { error: deleteError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatSession.id);

    if (deleteError) {
      console.error(LOG_TAG, 'Error deleting chat session', deleteError);
      return NextResponse.json({ error: 'Failed to delete chat session' }, { status: 500 });
    }

    console.log(LOG_TAG, 'Cleanup complete', { documentId, chatSessionId: chatSession.id });

    return NextResponse.json({
      success: true,
      deletedSession: chatSession.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(LOG_TAG, 'Error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
