import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import { getChatEditToolSchema } from '@/lib/llm/openai-client';
import {
  getAcontextConfig,
  createAcontextClient,
  storeMessage,
  getMessages,
  getTokenCounts,
} from '@/lib/acontext';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';

const LOG_TAG = '[api/ai/chat-acontext]';

const CHAT_EDIT_SYSTEM_PROMPT = `You are an AI document editor. Your job is to DIRECTLY EDIT the user's Markdown document based on their requests. Do NOT just give advice or explain what to do - actually use the edit tools to make changes.

**Core Principle**: When users describe what they want (e.g., "help me write a CV for HKU application", "translate this to English", "add a section about my research"), you should IMMEDIATELY use tools to edit the document. Be proactive, not reactive.

**Document context**: You will receive the current document content (and optionally the user's selected text). Use it to understand what to change.

**Edit tools**:
1. **search_replace**: Replace one segment with another. Use when the user wants to change or delete existing content.
   - old_string: Copy a unique segment from the document exactly (including newlines and spaces). It must appear verbatim in the document.
   - new_string: The replacement. Use "" to delete that segment.

2. **insert_after**: Insert content after a segment. Use when the user wants to add new content after a specific line or paragraph.
   - after_string: A segment that exists in the document (e.g. end of a paragraph or a heading line). Copy it exactly.
   - content: The Markdown to insert. Start with "\\n\\n" if you want a blank line before it.

**When to use tools**:
- User asks to modify, add, remove, or restructure content → USE TOOLS
- User provides personal info to fill in → USE TOOLS to replace placeholders
- User wants translation, formatting changes, or improvements → USE TOOLS
- User asks a question about the document → Reply with text (no tools needed)
- User explicitly says "don't edit" or "just tell me" → Reply with text only

**Rules**:
- Only use old_string / after_string that appear exactly in the provided document. Do not invent or paraphrase.
- Prefer short, unique segments so the match is unambiguous.
- When making many changes, call multiple tools in one response. Do not split into many back-and-forth turns.
- Output valid Markdown in new_string and content.
- If a tool returns "applied: false" with an error (e.g. old_string not found), read the current document again and retry with the exact text from the document.`;

function buildSystemContent(documentMarkdown: string, selectionMarkdown?: string | null): string {
  const documentBlock =
    documentMarkdown.trim().length > 0
      ? `\n\n**Current document (Markdown):**\n\`\`\`\n${documentMarkdown}\n\`\`\``
      : '\n\n**Current document is empty.**';
  const selectionBlock =
    selectionMarkdown?.trim()
      ? `\n\n**User has selected this part of the document:**\n\`\`\`\n${selectionMarkdown}\n\`\`\``
      : '';
  return CHAT_EDIT_SYSTEM_PROMPT + documentBlock + selectionBlock;
}

interface Body {
  content: string;
  documentId?: string;
  documentMarkdown: string;
  selectionMarkdown?: string | null;
  chatSessionId?: string;
}

export async function POST(request: Request) {
  const start = Date.now();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Acontext configuration
    const acontextConfig = getAcontextConfig();
    if (!acontextConfig) {
      return NextResponse.json(
        { error: 'Acontext not configured. Please set ACONTEXT_API_KEY.' },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    const documentMarkdown =
      typeof body.documentMarkdown === 'string' ? body.documentMarkdown : '';
    const selectionMarkdown =
      typeof body.selectionMarkdown === 'string' ? body.selectionMarkdown : null;
    const documentId = body.documentId;

    console.log(LOG_TAG, 'Request', {
      userId: user.id.slice(0, 8),
      documentId,
      contentLen: body.content.length,
      docLen: documentMarkdown.length,
    });

    // Initialize clients
    const acontextClient = createAcontextClient(acontextConfig);
    const config = getLLMConfig();
    const openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });

    // Get or create chat session
    const chatSession = await getOrCreateChatSession({
      userId: user.id,
      documentId,
      acontextClient,
    });

    console.log(LOG_TAG, 'Chat session', {
      id: chatSession.id,
      acontextSessionId: chatSession.acontextSessionId.slice(0, 8),
    });

    // Store user message
    await storeMessage(acontextClient, chatSession.acontextSessionId, {
      role: 'user',
      content: body.content,
    });

    // Load message history from Acontext
    const history = await getMessages(acontextClient, chatSession.acontextSessionId, {
      limit: 50,
    });

    // Build messages for OpenAI
    const systemContent = buildSystemContent(documentMarkdown, selectionMarkdown);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const tools = getChatEditToolSchema();

    // Create streaming completion
    const stream = await openaiClient.chat.completions.create({
      model: config.model ?? 'gpt-4o-mini',
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
      tools,
      tool_choice: 'auto',
      stream: true,
    });

    // Create SSE encoder
    const encoder = new TextEncoder();
    let currentContent = '';
    let toolCalls: Array<{
      id: string;
      name: string;
      arguments: string;
    }> = [];

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send session info first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'session',
                chatSessionId: chatSession.id,
                acontextSessionId: chatSession.acontextSessionId,
                diskId: chatSession.acontextDiskId,
              })}\n\n`
            )
          );

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
              currentContent += delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`
                )
              );
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: tc.id ?? '',
                    name: '',
                    arguments: '',
                  };
                }
                if (tc.id) toolCalls[index].id = tc.id;
                if (tc.function?.name) toolCalls[index].name = tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[index].arguments += tc.function.arguments;

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_call_delta',
                      index,
                      toolCall: toolCalls[index],
                    })}\n\n`
                  )
                );
              }
            }
          }

          // Process tool calls
          let finalDoc = documentMarkdown;
          const processedToolCalls: Array<{
            name: string;
            arguments: Record<string, unknown>;
            applied: boolean;
            error?: string;
          }> = [];

          for (const tc of toolCalls) {
            if (!tc.name) continue;

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.arguments || '{}');
            } catch {
              processedToolCalls.push({
                name: tc.name,
                arguments: {},
                applied: false,
                error: 'Failed to parse arguments',
              });
              continue;
            }

            const result = applyEditTool(finalDoc, tc.name, args);
            if (result.applied) {
              finalDoc = result.newMarkdown;
            }
            processedToolCalls.push({
              name: tc.name,
              arguments: args,
              applied: result.applied,
              error: result.error,
            });
          }

          // Store assistant message
          await storeMessage(acontextClient, chatSession.acontextSessionId, {
            role: 'assistant',
            content: currentContent,
          });

          // Get token counts
          const tokenCount = await getTokenCounts(acontextClient, chatSession.acontextSessionId);

          // Send done event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                content: currentContent,
                toolCalls: processedToolCalls,
                documentMarkdown: processedToolCalls.some((tc) => tc.applied)
                  ? finalDoc
                  : undefined,
                tokenCount,
              })}\n\n`
            )
          );

          console.log(LOG_TAG, 'Stream complete', {
            durationMs: Date.now() - start,
            contentLen: currentContent.length,
            toolCallsCount: processedToolCalls.length,
            tokenCount,
          });

          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(LOG_TAG, 'Stream error', { error: message });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', error: message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(LOG_TAG, 'Error', { error: message, durationMs: Date.now() - start });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET endpoint to load chat history
 */
export async function GET(request: Request) {
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
      return NextResponse.json(
        { error: 'Acontext not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const chatSessionId = url.searchParams.get('chatSessionId');
    const documentId = url.searchParams.get('documentId');

    if (!chatSessionId && !documentId) {
      return NextResponse.json(
        { error: 'chatSessionId or documentId is required' },
        { status: 400 }
      );
    }

    const acontextClient = createAcontextClient(acontextConfig);

    // Find the chat session
    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id);

    if (chatSessionId) {
      query = query.eq('id', chatSessionId);
    } else if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { data: sessionData, error: sessionError } = await query.maybeSingle();

    if (sessionError) {
      console.error(LOG_TAG, 'Error fetching session', sessionError);
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }

    if (!sessionData) {
      return NextResponse.json({
        session: null,
        messages: [],
        tokenCount: 0,
      });
    }

    // Load messages from Acontext
    const messages = await getMessages(
      acontextClient,
      sessionData.acontext_session_id,
      { limit: 100 }
    );

    // Get token count
    const tokenCount = await getTokenCounts(
      acontextClient,
      sessionData.acontext_session_id
    );

    return NextResponse.json({
      session: {
        id: sessionData.id,
        acontextSessionId: sessionData.acontext_session_id,
        diskId: sessionData.acontext_disk_id,
        title: sessionData.title,
      },
      messages,
      tokenCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(LOG_TAG, 'GET error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
