/**
 * API route for generating quizzes from document content
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import { getQuizSystemPrompt, getQuizUserPrompt } from '@/lib/quiz/prompts';
import { getQuizToolSchema, parseQuizFromArgs, OutputQuizArgs } from '@/lib/quiz/tools';
import type { QuestionType, GenerateQuizRequest, GenerateQuizResponse } from '@/lib/quiz/types';

const LOG_TAG = '[api/quiz/generate]';

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

    const body = (await request.json().catch(() => ({}))) as GenerateQuizRequest;

    if (!body.documentContent || typeof body.documentContent !== 'string') {
      return NextResponse.json(
        { error: 'documentContent is required' },
        { status: 400 }
      );
    }

    const questionCount = body.questionCount ?? 5;
    const questionTypes = body.questionTypes ?? ['mcq', 'fib'];
    const language = body.language ?? 'zh';

    console.log(LOG_TAG, 'Request', {
      documentId: body.documentId,
      docLen: body.documentContent.length,
      questionCount,
      questionTypes,
      language,
    });

    const config = getLLMConfig();
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });

    const tools = getQuizToolSchema();
    const systemPrompt = getQuizSystemPrompt(language);
    const userPrompt = getQuizUserPrompt(
      body.documentContent,
      questionCount,
      questionTypes.map((t) => (t === 'mcq' ? '单选题' : '填空题')),
      language
    );

    const completion = await client.chat.completions.create({
      model: config.model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature ?? 0.7,
      max_tokens: 4096,
      tools,
      tool_choice: { type: 'function', function: { name: 'output_quiz' } },
    });

    const assistant = completion.choices[0]?.message;
    if (!assistant) {
      throw new Error('No response from model');
    }

    const toolCall = assistant.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('Model did not call output_quiz tool');
    }

    const args = JSON.parse(toolCall.function.arguments) as OutputQuizArgs;
    const quiz = parseQuizFromArgs(args);

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', {
      durationMs: duration,
      quizId: quiz.id,
      questionCount: quiz.questions.length,
    });

    const response: GenerateQuizResponse = {
      success: true,
      quiz,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConfig =
      message.includes('OPENAI_LLM_') || message.includes('is not set');
    console.error(LOG_TAG, 'Error', { error: message, durationMs: Date.now() - start });
    return NextResponse.json(
      {
        success: false,
        error: isConfig
          ? 'LLM not configured. Set OPENAI_LLM_* in .env.local.'
          : message,
      },
      { status: isConfig ? 503 : 500 }
    );
  }
}
