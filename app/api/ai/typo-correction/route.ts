import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkTypos } from '@/lib/ai/typo-correction';

const LOG_TAG = '[api/typo-correction]';

interface TypoCheckRequest {
  text: string;
}

// POST /api/ai/typo-correction - Check text for typos
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

    const body: TypoCheckRequest = await request.json();

    if (!body.text || typeof body.text !== 'string') {
      console.warn(LOG_TAG, 'Missing or invalid text');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    if (body.text.length > 50000) {
      console.warn(LOG_TAG, 'Text too long', { len: body.text.length });
      return NextResponse.json(
        { error: 'Text is too long. Maximum 50,000 characters.' },
        { status: 400 }
      );
    }

    console.log(LOG_TAG, 'Request', { textLen: body.text.length });
    const result = await checkTypos(body.text);
    const duration = Date.now() - start;
    const typoCount = result.typos?.length ?? 0;
    console.log(LOG_TAG, 'Success', { typoCount, durationMs: duration });

    return NextResponse.json(result);
  } catch (error) {
    console.error(LOG_TAG, 'Error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
