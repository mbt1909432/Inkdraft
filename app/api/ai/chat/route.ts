import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { runChatWithEditTools } from '@/lib/ai/chat-edit';

const LOG_TAG = '[api/ai/chat]';

interface Body {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  documentMarkdown: string;
  selectionMarkdown?: string | null;
}

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn(LOG_TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages is required and must be a non-empty array' },
        { status: 400 }
      );
    }
    const documentMarkdown =
      typeof body.documentMarkdown === 'string' ? body.documentMarkdown : '';
    const selectionMarkdown =
      typeof body.selectionMarkdown === 'string' ? body.selectionMarkdown : null;

    console.log(LOG_TAG, 'Request', {
      messageCount: body.messages.length,
      docLen: documentMarkdown.length,
      hasSelection: !!selectionMarkdown,
    });

    const result = await runChatWithEditTools({
      messages: body.messages,
      documentMarkdown,
      selectionMarkdown: selectionMarkdown || undefined,
    });

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', {
      durationMs: duration,
      toolCallsCount: result.toolCalls?.length ?? 0,
    });

    return NextResponse.json({
      message: result.message,
      toolCalls: result.toolCalls ?? [],
      documentMarkdown: result.documentMarkdown ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConfig =
      message.includes('OPENAI_LLM_') || message.includes('is not set');
    console.error(LOG_TAG, 'Error', { error: message, durationMs: Date.now() - start });
    return NextResponse.json(
      {
        error: isConfig
          ? 'LLM not configured. Set OPENAI_LLM_* in .env.local.'
          : message,
      },
      { status: isConfig ? 503 : 500 }
    );
  }
}
