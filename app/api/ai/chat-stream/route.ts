import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import { getChatEditToolSchema } from '@/lib/llm/openai-client';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';

const LOG_TAG = '[api/ai/chat-stream]';

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
- If a tool returns "applied: false" with an error (e.g. old_string not found), read the current document again and retry with the exact text from the document.

**Example interactions**:

User: "I'm Elon, applying to HKU for CS master's"
→ BAD: "I can help you with that. First, tell me your GPA..."
→ GOOD: [Use search_replace to replace "[Your Name]" with "Elon", update target school info, etc.]

User: "帮我翻译成英文"
→ BAD: "Here's how to translate..." or "I'll translate for you: [shows translated text]"
→ GOOD: [Use search_replace to replace Chinese sections with English translations]

User: "Add my GPA 3.8/4.0"
→ [Use search_replace to update the GPA field]`;

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

    const config = getLLMConfig();
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    });

    const userConversation = body.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemContent = buildSystemContent(documentMarkdown, selectionMarkdown);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...userConversation,
    ];

    const tools = getChatEditToolSchema();

    // Create streaming completion
    const stream = await client.chat.completions.create({
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
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Handle content delta
            if (delta.content) {
              currentContent += delta.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`)
              );
            }

            // Handle tool call delta
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
                if (tc.function?.arguments) toolCalls[index].arguments += tc.function.arguments;

                // Send tool call update
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    type: 'tool_call_delta',
                    index,
                    toolCall: toolCalls[index],
                  })}\n\n`)
                );
              }
            }
          }

          // Stream complete - process tool calls and send final result
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

          // Send done event with final state
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              content: currentContent,
              toolCalls: processedToolCalls,
              documentMarkdown: processedToolCalls.some(tc => tc.applied) ? finalDoc : undefined,
            })}\n\n`)
          );

          console.log(LOG_TAG, 'Stream complete', {
            durationMs: Date.now() - start,
            contentLen: currentContent.length,
            toolCallsCount: processedToolCalls.length,
            appliedCount: processedToolCalls.filter(tc => tc.applied).length,
          });

          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(LOG_TAG, 'Stream error', { error: message });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`)
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
