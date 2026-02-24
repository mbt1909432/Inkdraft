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
import {
  getSandboxToolSchemas,
  isSandboxToolName,
  executeSandboxTool,
  formatSandboxContext,
  createSandbox,
} from '@/lib/acontext/sandbox-tools';

const LOG_TAG = '[api/ai/chat-acontext]';

// Agent loop configuration
const MAX_ITERATIONS = 20;

// ==================== CRITICAL RULES (MUST BE AT THE TOP) ====================
const CRITICAL_RULES = `<CRITICAL_RULES priority="highest">
<rule id="python-execution">
<TITLE>HOW TO EXECUTE PYTHON CODE - YOU MUST CALL TWO TOOLS</TITLE>

When user asks to run Python code, you MUST call BOTH tools in ONE response:
1. text_editor_sandbox (create file)
2. bash_execution_sandbox (run file)

Example - user asks "calculate 123*456":
<tool_call_1>
name: text_editor_sandbox
arguments: { "command": "create", "path": "calc.py", "file_text": "print(123*456)" }
</tool_call_1>
<tool_call_2>
name: bash_execution_sandbox
arguments: { "command": "python3 calc.py" }
</tool_call_2>

NEVER create the file without running it - the user expects to see the output!
NEVER use heredoc (<< 'EOF') - it will HANG!

</rule>
</CRITICAL_RULES>

`;

const CHAT_EDIT_SYSTEM_PROMPT = CRITICAL_RULES + `You are an AI document editor with Python code execution capabilities. Your job is to DIRECTLY EDIT the user's Markdown document based on their requests. Do NOT just give advice or explain what to do - actually use the edit tools to make changes.

**Core Principle**: When users describe what they want (e.g., "help me write a CV for HKU application", "translate this to English", "add a section about my research"), you should IMMEDIATELY use tools to edit the document. Be proactive, not reactive.

**Document context**: You will receive the current document content (and optionally the user's selected text). Use it to understand what to change.

**Edit tools**:
1. **search_replace**: Replace one segment with another. Use when the user wants to change or delete existing content.
   - old_string: Copy a unique segment from the document exactly (including newlines and spaces). It must appear verbatim in the document.
   - new_string: The replacement. Use "" to delete that segment.

2. **insert_after**: Insert content after a segment. Use when the user wants to add new content after a specific line or paragraph.
   - after_string: A segment that exists in the document (e.g. end of a paragraph or a heading line). Copy it exactly.
   - content: The Markdown to insert. Start with "\\n\\n" if you want a blank line before it.

**Sandbox tools** (for Python code execution):
3. **bash_execution_sandbox**: Execute bash commands in an isolated sandbox environment.
   - command: Simple single-line bash commands ONLY. For Python: first create a .py file, then run "python3 script.py"
   - timeout: Timeout in seconds (default: 120)

4. **text_editor_sandbox**: Create, view, or edit files in the sandbox.
   - command: "create" to write a file, "view" to read a file
   - path: File path in the sandbox
   - file_text: File content (for "create" command)

5. **export_file_sandbox**: Export files from sandbox to permanent disk storage. Use this to save generated images or outputs.
   - sandbox_path: Directory path in sandbox (e.g., "/workspace/")
   - sandbox_filename: Filename in sandbox (e.g., "figure.png")
   - disk_path: Directory path on disk (e.g., "/images/2026-02-24/")
   - Returns: disk:: path that you MUST use in markdown (e.g., "![chart](disk::artifacts/chart.png)")
   - IMPORTANT: Always use the "disk::" path format in your markdown, NOT any https:// URL!

**When to use tools**:
- User asks to modify, add, remove, or restructure content → USE EDIT TOOLS
- User provides personal info to fill in → USE EDIT TOOLS to replace placeholders
- User wants translation, formatting changes, or improvements → USE EDIT TOOLS
- User wants to run Python code or generate charts → USE SANDBOX TOOLS (create file first!)
- User asks a question about the document → Reply with text (no tools needed)
- User explicitly says "don't edit" or "just tell me" → Reply with text only

**Rules**:
- Only use old_string / after_string that appear exactly in the provided document. Do not invent or paraphrase.
- Prefer short, unique segments so the match is unambiguous.
- When making many changes, call multiple tools in one response. Do not split into many back-and-forth turns.
- Output valid Markdown in new_string and content.
- If a tool returns "applied: false" with an error (e.g. old_string not found), read the current document again and retry with the exact text from the document.
- For generated images/charts, use export_file_sandbox to save to disk, then use insert_after to add the disk:: path to the document.
- **CRITICAL for images**: When embedding exported files in markdown, ALWAYS use the "disk::" format (e.g., "![chart](disk::artifacts/chart.png)"). NEVER use https:// URLs as they will expire!

<FINAL_REMINDER>
Before calling bash_execution_sandbox with any Python command:
- Does the command contain "<<" (heredoc)? → STOP, create a .py file first
- CORRECT: text_editor_sandbox(create script.py) → bash_execution_sandbox(python3 script.py)
- WRONG: bash_execution_sandbox(python3 - << 'EOF') → This will HANG!
</FINAL_REMINDER>`;

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

// Types for processed tool calls
interface ProcessedToolCall {
  name: string;
  arguments: Record<string, unknown>;
  applied: boolean;
  error?: string;
  result?: Record<string, unknown>;
}

// Types for LLM tool calls
interface LLMToolCall {
  id: string;
  name: string;
  arguments: string;
}

export async function POST(request: Request) {
  const start = Date.now();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const acontextConfig = getAcontextConfig();
    if (!acontextConfig) {
      return NextResponse.json(
        { error: 'Acontext not configured. Please set ACONTEXT_API_KEY.' },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const documentMarkdown = typeof body.documentMarkdown === 'string' ? body.documentMarkdown : '';
    const selectionMarkdown = typeof body.selectionMarkdown === 'string' ? body.selectionMarkdown : null;
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
      acontextSessionId: chatSession.acontextSessionId,
      acontextDiskId: chatSession.acontextDiskId,
    });

    // Store user message
    try {
      await storeMessage(acontextClient, chatSession.acontextSessionId, {
        role: 'user',
        content: body.content,
      });
      console.log(LOG_TAG, 'User message stored');
    } catch (err) {
      console.error(LOG_TAG, 'Failed to store user message', err);
      throw err;
    }

    // Load message history from Acontext
    let history: Array<{
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
    }> = [];
    try {
      history = await getMessages(acontextClient, chatSession.acontextSessionId, { limit: 50 });
      console.log(LOG_TAG, 'History loaded', { count: history.length });
    } catch (err) {
      console.error(LOG_TAG, 'Failed to load history', err);
    }

    // Build initial messages for OpenAI
    const systemContent = buildSystemContent(documentMarkdown, selectionMarkdown);
    const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = history.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.tool_call_id || '',
          content: m.content || '',
        };
      }
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant' as const,
          content: m.content || '',
          tool_calls: m.tool_calls as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
        };
      }
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content || '',
      };
    });

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...historyMessages,
    ];

    const editTools = getChatEditToolSchema();
    const sandboxTools = getSandboxToolSchemas();
    const tools = [...editTools, ...sandboxTools] as OpenAI.Chat.Completions.ChatCompletionTool[];

    // Create SSE encoder
    const encoder = new TextEncoder();

    // Accumulated state across iterations
    let finalContent = '';
    let finalDoc = documentMarkdown;
    const allProcessedToolCalls: ProcessedToolCall[] = [];
    let sandboxId: string | undefined;

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

          // Send agent loop start
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_loop_start', maxIterations: MAX_ITERATIONS })}\n\n`
            )
          );

          // Agent loop
          for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
            console.log(LOG_TAG, `Agent loop iteration ${iteration}/${MAX_ITERATIONS}`);

            // Send iteration start
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'agent_loop_iteration', iteration, maxIterations: MAX_ITERATIONS })}\n\n`
              )
            );

            // Call LLM (non-streaming for loop control)
            const response = await openaiClient.chat.completions.create({
              model: config.model ?? 'gpt-4o-mini',
              messages,
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 2048,
              tools,
              tool_choice: 'auto',
              stream: false,
            });

            const assistantMessage = response.choices[0]?.message;
            if (!assistantMessage) {
              console.log(LOG_TAG, 'No response from LLM, stopping loop');
              break;
            }

            const content = assistantMessage.content || '';
            const toolCalls = assistantMessage.tool_calls || [];

            // Send content if any
            if (content) {
              finalContent += content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                )
              );
            }

            // If no tool calls, we're done
            if (toolCalls.length === 0) {
              console.log(LOG_TAG, 'No tool calls, stopping loop');
              break;
            }

            // Process tool calls
            const processedToolCalls: ProcessedToolCall[] = [];
            let sandboxFailed = false;

            // Create sandbox if needed
            const hasSandboxToolCalls = toolCalls.some(tc => 'function' in tc && tc.function && isSandboxToolName(tc.function.name));
            if (hasSandboxToolCalls && !sandboxId) {
              try {
                console.log(LOG_TAG, 'Creating sandbox...');
                const { sandboxId: newId } = await createSandbox(acontextClient);
                sandboxId = newId;
                console.log(LOG_TAG, 'Sandbox created', { sandboxId });
              } catch (err) {
                console.error(LOG_TAG, 'Failed to create sandbox', err);
              }
            }

            // Process each tool call
            for (const tc of toolCalls) {
              // Skip if not a function tool call
              if (!('function' in tc) || !tc.function) continue;

              const toolName = tc.function.name;
              let args: Record<string, unknown> = {};

              try {
                args = JSON.parse(tc.function.arguments || '{}');
              } catch {
                processedToolCalls.push({
                  name: toolName,
                  arguments: {},
                  applied: false,
                  error: 'Failed to parse arguments',
                });
                continue;
              }

              const isSandbox = isSandboxToolName(toolName);
              console.log(LOG_TAG, 'Tool routing', { name: toolName, isSandbox });

              // Send tool call event
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'agent_loop_tool',
                    toolName,
                    args,
                    status: 'executing',
                  })}\n\n`
                )
              );

              if (isSandbox) {
                if (!sandboxId) {
                  processedToolCalls.push({
                    name: toolName,
                    arguments: args,
                    applied: false,
                    error: 'Sandbox not available',
                  });
                  sandboxFailed = true;
                  continue;
                }

                try {
                  const sandboxCtx = formatSandboxContext(
                    acontextClient,
                    sandboxId,
                    chatSession.acontextDiskId
                  );
                  const result = await executeSandboxTool(sandboxCtx, toolName, args);
                  console.log(LOG_TAG, 'Sandbox tool result', { name: toolName, result });

                  // Check for actual execution failure
                  // - For bash commands: check exit_code (0 = success)
                  // - For other tools: check if error is a meaningful error message
                  const isBashTool = toolName === 'bash_execution_sandbox';
                  const exitCode = result.exit_code as number | undefined;
                  const errorMsg = result.error as string | undefined;

                  // Consider success if:
                  // 1. Bash tool with exit_code 0
                  // 2. No error, or error is just the tool name (SDK quirk)
                  const isActualError = errorMsg &&
                    errorMsg !== toolName &&
                    !errorMsg.includes(toolName) &&
                    exitCode !== 0;

                  if (isActualError) {
                    processedToolCalls.push({
                      name: toolName,
                      arguments: args,
                      applied: false,
                      error: errorMsg,
                      result,
                    });
                    sandboxFailed = true;
                  } else {
                    processedToolCalls.push({
                      name: toolName,
                      arguments: args,
                      applied: true,
                      result,
                    });
                  }
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message : String(err);
                  processedToolCalls.push({
                    name: toolName,
                    arguments: args,
                    applied: false,
                    error: errorMsg,
                  });
                  sandboxFailed = true;
                }
              } else {
                // Edit tool
                if (sandboxFailed) {
                  processedToolCalls.push({
                    name: toolName,
                    arguments: args,
                    applied: false,
                    error: 'Skipped: previous sandbox tool failed',
                  });
                  continue;
                }

                const result = applyEditTool(finalDoc, toolName, args);
                if (result.applied) {
                  finalDoc = result.newMarkdown;
                }
                processedToolCalls.push({
                  name: toolName,
                  arguments: args,
                  applied: result.applied,
                  error: result.error,
                });
              }

              // Send tool result event
              const lastProcessed = processedToolCalls[processedToolCalls.length - 1];
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'agent_loop_tool',
                    toolName,
                    args,
                    status: lastProcessed.applied ? 'success' : 'error',
                    applied: lastProcessed.applied,
                    error: lastProcessed.error,
                    result: lastProcessed.result,
                  })}\n\n`
                )
              );
            }

            allProcessedToolCalls.push(...processedToolCalls);

            // CRITICAL: Store assistant message with tool_calls (per iteration)
            // This ensures Acontext history is complete for next request
            console.log(LOG_TAG, `Storing assistant message for iteration ${iteration}`, {
              contentLength: content.length,
              contentPreview: content.slice(0, 100),
              toolCallsCount: toolCalls.length,
            });
            await storeMessage(acontextClient, chatSession.acontextSessionId, {
              role: 'assistant',
              content: content || ' ',
              tool_calls: toolCalls.map((tc, idx) => ({
                id: tc.id || `tc_${Date.now()}_${idx}`,
                type: 'function' as const,
                function: {
                  name: 'function' in tc ? tc.function.name : '',
                  arguments: 'function' in tc ? tc.function.arguments : '',
                },
              })),
            });

            // Store tool responses for each tool call
            const toolResponses: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
            for (let i = 0; i < toolCalls.length; i++) {
              const tc = toolCalls[i];
              const result = processedToolCalls[i];

              const toolResponseContent = ('function' in tc && isSandboxToolName(tc.function.name))
                ? JSON.stringify({
                    applied: result.applied,
                    result: result.result,
                    error: result.error,
                  })
                : (result.applied
                  ? JSON.stringify({ applied: true, name: result.name, arguments: result.arguments })
                  : JSON.stringify({ applied: false, error: result.error || 'Edit not applied' }));

              const toolResponse = {
                role: 'tool' as const,
                tool_call_id: tc.id,
                content: toolResponseContent,
              };

              await storeMessage(acontextClient, chatSession.acontextSessionId, toolResponse);
              toolResponses.push(toolResponse);
            }

            // Update messages for next iteration
            messages = [
              ...messages,
              {
                role: 'assistant' as const,
                content: content || ' ',
                tool_calls: toolCalls,
              },
              ...toolResponses,
            ];

            console.log(LOG_TAG, `Iteration ${iteration} complete`, {
              toolCallsCount: toolCalls.length,
              contentLen: content.length,
            });
          }

          // CRITICAL: Store final assistant message with accumulated content
          // This handles the case where the last iteration only returns content (no tool_calls)
          // and therefore wasn't stored in the loop
          if (finalContent.trim()) {
            console.log(LOG_TAG, 'Storing final assistant message', {
              contentLength: finalContent.length,
              contentPreview: finalContent.slice(0, 100),
            });
            await storeMessage(acontextClient, chatSession.acontextSessionId, {
              role: 'assistant',
              content: finalContent,
              // No tool_calls here - they were stored in previous iterations
            });
          }

          // Send agent loop end
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'agent_loop_end', iterations: Math.min(MAX_ITERATIONS, allProcessedToolCalls.length + 1) })}\n\n`
            )
          );

          // Get token counts
          const tokenCount = await getTokenCounts(acontextClient, chatSession.acontextSessionId);

          // Send done event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                content: finalContent,
                toolCalls: allProcessedToolCalls,
                documentMarkdown: allProcessedToolCalls.some((tc) => tc.applied && !isSandboxToolName(tc.name))
                  ? finalDoc
                  : undefined,
                tokenCount,
              })}\n\n`
            )
          );

          console.log(LOG_TAG, 'Stream complete', {
            durationMs: Date.now() - start,
            contentLen: finalContent.length,
            toolCallsCount: allProcessedToolCalls.length,
            tokenCount,
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

/**
 * GET endpoint to load chat history
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const acontextConfig = getAcontextConfig();
    if (!acontextConfig) {
      return NextResponse.json({ error: 'Acontext not configured' }, { status: 500 });
    }

    const url = new URL(request.url);
    const chatSessionId = url.searchParams.get('chatSessionId');
    const documentId = url.searchParams.get('documentId');

    if (!chatSessionId && !documentId) {
      return NextResponse.json({ error: 'chatSessionId or documentId is required' }, { status: 400 });
    }

    const acontextClient = createAcontextClient(acontextConfig);

    let query = supabase.from('chat_sessions').select('*').eq('user_id', user.id);

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
      return NextResponse.json({ session: null, messages: [], tokenCount: 0 });
    }

    const messages = await getMessages(acontextClient, sessionData.acontext_session_id, { limit: 100 });
    const tokenCount = await getTokenCounts(acontextClient, sessionData.acontext_session_id);

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
