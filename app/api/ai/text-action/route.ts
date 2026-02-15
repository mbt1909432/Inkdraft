import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  runTextAction,
  type TextActionType,
} from '@/lib/ai/text-action';

const VALID_ACTIONS: TextActionType[] = [
  'polish',
  'expand',
  'shrink',
  'translate',
  'summarize',
  'correct',
];

interface Body {
  action: TextActionType;
  text: string;
  options?: { targetLang?: string };
}

const LOG_TAG = '[api/text-action]';

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

    const body: Body = await request.json().catch(() => ({}));

    if (
      !body.action ||
      !VALID_ACTIONS.includes(body.action as TextActionType)
    ) {
      console.warn(LOG_TAG, 'Invalid action', { action: body.action });
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!body.text || typeof body.text !== 'string') {
      console.warn(LOG_TAG, 'Missing or invalid text');
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    const action = body.action as TextActionType;
    const textLen = body.text.length;
    console.log(LOG_TAG, 'Request', { action, textLen, options: body.options });

    const result = await runTextAction(action, body.text, body.options);

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', {
      action,
      textLen,
      resultLen: result.length,
      durationMs: duration,
    });
    return NextResponse.json({ text: result });
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
