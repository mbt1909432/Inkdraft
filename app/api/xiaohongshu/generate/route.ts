/**
 * API route for generating Xiaohongshu content from document content
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import { getXiaohongshuToolSchema, parseXiaohongshuFromArgs, OutputXiaohongshuArgs } from '@/lib/xiaohongshu/tools';

const LOG_TAG = '[api/xiaohongshu/generate]';

export interface GenerateXiaohongshuRequest {
  documentContent: string;
  topic?: string;
  language?: 'zh' | 'en';
}

export interface GenerateXiaohongshuResponse {
  success: boolean;
  data?: {
    title: string;
    tags: string[];
    cards: Array<{ content: string }>;
  };
  error?: string;
}

function getSystemPrompt(language: 'zh' | 'en'): string {
  if (language === 'en') {
    return `You are a Xiaohongshu (Little Red Book) content creation assistant. Generate engaging social media content based on the user's topic or document content.

Requirements:
1. Title: Eye-catching, 15-25 characters, include emojis
2. Tags: 3-5 relevant hashtags
3. Cards: Generate 3-6 content cards, each containing a short content segment (50-100 characters per card)
   - Each card should be a self-contained piece of content
   - Use emojis in each card
   - Cards should flow naturally when read in sequence
   - Conversational tone, authentic feel

Use the output_xiaohongshu function to return your generated content.`;
  }

  return `你是一个小红书内容创作助手。请根据用户提供的主题或文档内容，生成适合小红书风格的卡片内容。

要求：
1. 标题：吸引眼球，15-25字，包含emoji
2. 标签：3-5个相关话题标签
3. 卡片：生成3-6张内容卡片，每张卡片包含一段短内容（50-100字）
   - 每张卡片应该是一个独立的内容片段
   - 每张卡片都要带emoji
   - 卡片内容连起来是一个完整的故事
   - 口语化、真实感强

请使用 output_xiaohongshu 函数返回生成的内容。`;
}

function getUserPrompt(documentContent: string, topic?: string, language: 'zh' | 'en' = 'zh'): string {
  const topicText = topic
    ? (language === 'en' ? `Topic: ${topic}` : `主题：${topic}`)
    : (language === 'en' ? 'Please generate content based on the document.' : '请根据文档内容生成小红书卡片。');

  const docText = language === 'en'
    ? `Document content:\n${documentContent || '(No document content)'}`
    : `文档内容：\n${documentContent || '（无文档内容）'}`;

  return `${topicText}\n\n${docText}`;
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

    const body = (await request.json().catch(() => ({}))) as GenerateXiaohongshuRequest;

    if (!body.documentContent || typeof body.documentContent !== 'string') {
      return NextResponse.json(
        { error: 'documentContent is required' },
        { status: 400 }
      );
    }

    const language = body.language ?? 'zh';

    console.log(LOG_TAG, 'Request', {
      topic: body.topic,
      docLen: body.documentContent.length,
      language,
    });

    const config = getLLMConfig();
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });

    const tools = getXiaohongshuToolSchema();
    const systemPrompt = getSystemPrompt(language);
    const userPrompt = getUserPrompt(body.documentContent, body.topic, language);

    const completion = await client.chat.completions.create({
      model: config.model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature ?? 0.8,
      max_tokens: 2048,
      tools,
      tool_choice: { type: 'function', function: { name: 'output_xiaohongshu' } },
    });

    const assistant = completion.choices[0]?.message;
    if (!assistant) {
      throw new Error('No response from model');
    }

    const toolCall = assistant.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('Model did not call output_xiaohongshu tool');
    }

    const args = JSON.parse(toolCall.function.arguments) as OutputXiaohongshuArgs;
    const data = parseXiaohongshuFromArgs(args);

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', {
      durationMs: duration,
      title: data.title,
      tagsCount: data.tags.length,
    });

    const response: GenerateXiaohongshuResponse = {
      success: true,
      data,
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
