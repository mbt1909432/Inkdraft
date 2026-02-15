import { NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm/config';
import { createOpenAIClient, chatCompletion, getDraftToolSchema } from '@/lib/llm/openai-client';

const LOG_TAG = '[api/draft]';

const SYSTEM_PROMPT = `You are a document drafting assistant. Your task is to write a complete Markdown draft based on the user's title and optional instructions.

Rules:
1. Output ONLY by calling the output_draft tool with the full Markdown content. Do not output the draft in your message text.
2. Use proper Markdown: headings (# ##), paragraphs, lists, bold/italic as appropriate.
3. Write in a clear, structured way. The content should be ready to use as a document body.`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';

    if (!title) {
      console.warn(LOG_TAG, 'Missing or empty title');
      return NextResponse.json(
        { error: 'Missing or empty title' },
        { status: 400 }
      );
    }

    const start = Date.now();
    console.log(LOG_TAG, 'Request', { titleLen: title.length, hasInstruction: !!instruction });

    const config = getLLMConfig();
    const client = createOpenAIClient(config);
    const tools = getDraftToolSchema();

    const userContent = instruction
      ? `Please draft a document with the following title. Output the full Markdown by calling output_draft.\n\nTitle: ${title}\n\nAdditional instructions: ${instruction}`
      : `Please draft a document with the following title. Output the full Markdown by calling output_draft.\n\nTitle: ${title}`;

    const { message, toolCalls } = await chatCompletion(
      client,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      config,
      tools,
      { forcedToolName: 'output_draft', maxIterations: 3 }
    );

    const draftInvocation = toolCalls?.find((t) => t.name === 'output_draft');
    const markdown =
      typeof draftInvocation?.result === 'string'
        ? draftInvocation.result
        : message || '';

    if (!markdown.trim()) {
      console.warn(LOG_TAG, 'Draft returned empty content');
      return NextResponse.json(
        { error: 'Draft did not return content. Please try again.' },
        { status: 422 }
      );
    }

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', { markdownLen: markdown.length, durationMs: duration });
    return NextResponse.json({ markdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConfig = message.includes('OPENAI_LLM_') || message.includes('is not set');
    console.error(LOG_TAG, 'Error', { error: message });
    return NextResponse.json(
      { error: isConfig ? 'LLM not configured. Please set OPENAI_LLM_* in .env.local.' : message },
      { status: isConfig ? 503 : 500 }
    );
  }
}
