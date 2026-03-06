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
  uploadImage,
} from '@/lib/acontext';
import type { ContentPart } from '@/lib/acontext/types';
import { getOrCreateChatSession } from '@/lib/acontext/session-store';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';
import {
  getSandboxToolSchemas,
  isSandboxToolName,
  executeSandboxTool,
  formatSandboxContext,
  createSandbox,
} from '@/lib/acontext/sandbox-tools';
import { getWebSearchToolSchema } from '@/lib/llm/openai-client';

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

const CHAT_EDIT_SYSTEM_PROMPT = CRITICAL_RULES + `你的名字是墨元(Moyuan)，你是一个AI文档编辑助手。

You are an AI document editor with Python code execution capabilities. Your job is to DIRECTLY EDIT the user's Markdown document based on their requests. Do NOT just give advice or explain what to do - actually use the edit tools to make changes.

**Core Principle**: When users describe what they want (e.g., "help me write a CV for HKU application", "translate this to English", "add a section about my research"), you should IMMEDIATELY use tools to edit the document. Be proactive, not reactive.

**IMPORTANT - READ THE DOCUMENT FIRST**: Before responding, ALWAYS check the "Current document (Markdown)" section below. The document content is provided to you - you don't need to ask for it or search for files. When user asks about "the document" or refers to content by name (like "Day 01"), they mean the content in the "Current document" section.

**Document context**: You will receive the current document content (and optionally the user's selected text). Use it to understand what to change.

**IMPORTANT - User uploaded files**:
- Users may upload files (PDF, images, etc.). These will be labeled as "[用户上传的文件: filename]" in their message.
- **The uploaded file content is NOT the current document!** It is reference material the user wants to discuss or incorporate.
- When user says "write this to document" or "add to document", they mean add the uploaded content TO the current (possibly empty) document.
- **NEVER search for after_string or old_string in the uploaded file content!** Only search in the "Current document" section below.

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

**Web search tool** (for getting up-to-date information):
6. **web_search**: Search the internet for current information.
   - query: The search query (use concise, specific keywords)
   - Returns: Search results with titles, URLs, and snippets
   - Use when user asks about: current events, news, latest data, recent developments, or information you're uncertain about
   - After searching, cite your sources in the response using [1], [2] format and list the sources at the end

**When to use tools**:
- User asks to modify, add, remove, or restructure content → USE EDIT TOOLS
- User provides personal info to fill in → USE EDIT TOOLS to replace placeholders
- User wants translation, formatting changes, or improvements → USE EDIT TOOLS
- User wants to run Python code or generate charts → USE SANDBOX TOOLS (create file first!)
- User asks about current events, news, or latest information → USE WEB SEARCH, then cite sources [1][2]
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
      ? `\n\n---\n\n## 📄 CURRENT DOCUMENT CONTENT (Markdown)\n\nThe user's document is below. When they ask about "the document" or refer to content by name, this is what they mean:\n\n\`\`\`markdown\n${documentMarkdown}\n\`\`\`\n\n---`
      : '\n\n---\n\n## 📄 CURRENT DOCUMENT IS EMPTY\n\nTo add content to an empty document, use insert_after with after_string="" (empty string) to insert at the beginning.\n\n---';
  const selectionBlock =
    selectionMarkdown?.trim()
      ? `\n\n**User has selected this part of the document:**\n\`\`\`\n${selectionMarkdown}\n\`\`\``
      : '';
  return CHAT_EDIT_SYSTEM_PROMPT + documentBlock + selectionBlock;
}

interface Body {
  content: string;
  /** Multimodal content parts (images + text) */
  contentParts?: ContentPart[];
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
    if (!body.content?.trim() && !body.contentParts?.length) {
      return NextResponse.json({ error: 'content or contentParts is required' }, { status: 400 });
    }

    const documentMarkdown = typeof body.documentMarkdown === 'string' ? body.documentMarkdown : '';
    const selectionMarkdown = typeof body.selectionMarkdown === 'string' ? body.selectionMarkdown : null;
    const documentId = body.documentId;

    console.log(LOG_TAG, 'Request', {
      userId: user.id.slice(0, 8),
      documentId,
      contentLen: body.content.length,
      hasContentParts: !!body.contentParts?.length,
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

    // Process multimodal content - prepare images for Vision API
    // Note: We pass base64 data URLs directly to the LLM (Vision API supports this)
    // Upload to Acontext disk is done asynchronously for storage
    let messageContent: string | ContentPart[] = body.content;

    if (body.contentParts && body.contentParts.length > 0) {
      const processedParts: ContentPart[] = [];

      for (const part of body.contentParts) {
        if (part.type === 'text') {
          processedParts.push(part);
        } else if (part.type === 'image_url' && part.image_url?.url) {
          const imageUrl = part.image_url.url;

          // For Vision API, we can use base64 data URLs directly
          // This avoids the need to upload to Acontext first
          if (imageUrl.startsWith('data:')) {
            // Use the base64 data URL directly for Vision API
            processedParts.push({
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: part.image_url.detail || 'auto',
              },
            });

            // Try to upload to Acontext disk for storage (async, don't wait)
            uploadImage(acontextClient, chatSession.acontextDiskId, {
              filename: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
              content: Buffer.from(imageUrl.split(',')[1], 'base64'),
              mimeType: 'image/png',
              path: '/chat-images/',
            }).then(result => {
              console.log(LOG_TAG, 'Image uploaded to disk', { publicUrl: result.publicUrl });
            }).catch(uploadErr => {
              console.error(LOG_TAG, 'Failed to upload image to disk (non-critical)', uploadErr.message || uploadErr);
            });
          } else {
            // Already a URL, use as-is
            processedParts.push(part);
          }
        }
      }

      messageContent = processedParts;
    }

    // Store user message (with multimodal support)
    try {
      await storeMessage(acontextClient, chatSession.acontextSessionId, {
        role: 'user',
        content: messageContent,
      });
      console.log(LOG_TAG, 'User message stored', {
        isMultimodal: Array.isArray(messageContent),
        contentPreview: Array.isArray(messageContent)
          ? JSON.stringify(messageContent).substring(0, 200)
          : (messageContent as string).substring(0, 100)
      });
    } catch (err) {
      console.error(LOG_TAG, 'Failed to store user message', err);
      throw err;
    }

    // Load message history from Acontext
    let history: Array<{
      role: string;
      content: string | ContentPart[];
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
    }> = [];
    try {
      history = await getMessages(acontextClient, chatSession.acontextSessionId, { limit: 50 });
      console.log(LOG_TAG, 'History loaded', {
        count: history.length,
        firstMsgIsMultimodal: history.length > 0 && Array.isArray(history[0].content),
        firstMsgContentPreview: history.length > 0
          ? (Array.isArray(history[0].content)
              ? JSON.stringify(history[0].content).substring(0, 200)
              : String(history[0].content).substring(0, 100))
          : 'no history'
      });
    } catch (err) {
      console.error(LOG_TAG, 'Failed to load history', err);
    }

    // Build initial messages for OpenAI
    const systemContent = buildSystemContent(documentMarkdown, selectionMarkdown);

    // Build history messages from Acontext (text-only, multimodal may be corrupted)
    const historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = history.map((m, idx) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m.tool_call_id || '',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        };
      }
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant' as const,
          content: typeof m.content === 'string' ? m.content : '',
          tool_calls: m.tool_calls as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
        };
      }
      // Handle multimodal user messages
      if (m.role === 'user' && Array.isArray(m.content)) {
        const multimodalContent = m.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text || '' };
          } else if (part.type === 'image_url') {
            console.log(LOG_TAG, `History message ${idx} has image_url`, {
              urlLength: part.image_url?.url?.length || 0,
              urlPrefix: part.image_url?.url?.substring(0, 50) || 'empty',
            });
            return {
              type: 'image_url' as const,
              image_url: {
                url: part.image_url?.url || '',
                detail: part.image_url?.detail || 'auto' as const,
              },
            };
          }
          return { type: 'text' as const, text: '' };
        });
        console.log(LOG_TAG, `History message ${idx} is multimodal`, {
          partsCount: multimodalContent.length,
          hasImage: multimodalContent.some(p => p.type === 'image_url'),
        });
        return {
          role: 'user' as const,
          content: multimodalContent,
        };
      }
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: typeof m.content === 'string' ? m.content : '',
      };
    });

    // Build messages array
    // NOTE: Acontext may corrupt multimodal content when loading history,
    // so we add the current multimodal message directly instead of relying on history
    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...historyMessages,
    ];

    // If current message is multimodal, replace/append it directly
    // (Acontext history loading may have corrupted the multimodal content)
    if (Array.isArray(messageContent) && messageContent.some(p => p.type === 'image_url')) {
      // Find if there's a user message at the end that should be multimodal
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'user') {
        // Replace the last user message with the actual multimodal content
        messages[messages.length - 1] = {
          role: 'user' as const,
          content: messageContent.map(part => {
            if (part.type === 'text') {
              return { type: 'text' as const, text: part.text || '' };
            } else if (part.type === 'image_url') {
              return {
                type: 'image_url' as const,
                image_url: {
                  url: part.image_url?.url || '',
                  detail: part.image_url?.detail || 'auto' as const,
                },
              };
            }
            return { type: 'text' as const, text: '' };
          }),
        };
        console.log(LOG_TAG, 'Replaced last user message with multimodal content', {
          partsCount: messageContent.length,
          hasImage: messageContent.some(p => p.type === 'image_url'),
        });
      }
    }

    // Debug: Log final messages structure
    console.log(LOG_TAG, 'Final messages for LLM', {
      totalMessages: messages.length,
      lastUserMessageIsMultimodal: messages.length > 1 && messages[messages.length - 1].role === 'user'
        && Array.isArray(messages[messages.length - 1].content),
      lastUserMessagePreview: messages.length > 0
        ? JSON.stringify(messages[messages.length - 1].content).substring(0, 300)
        : 'no messages'
    });

    const editTools = getChatEditToolSchema();
    const sandboxTools = getSandboxToolSchemas();
    const webSearchTools = getWebSearchToolSchema();
    const tools = [...editTools, ...sandboxTools, ...webSearchTools] as OpenAI.Chat.Completions.ChatCompletionTool[];

    // Create SSE encoder
    const encoder = new TextEncoder();

    // Accumulated state across iterations
    let finalContent = '';
    let finalDoc = documentMarkdown;
    const allProcessedToolCalls: ProcessedToolCall[] = [];
    let sandboxId: string | undefined;

    const readable = new ReadableStream({
      type: 'bytes',
      autoAllocateChunkSize: 1024,
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

            // Call LLM with streaming for typewriter effect
            // Debug: Log the messages being sent to OpenAI
            const systemContent = messages[0]?.content;
            console.log(LOG_TAG, 'Sending to OpenAI', {
              messageCount: messages.length,
              systemMessageLength: typeof systemContent === 'string' ? systemContent.length : 0,
              systemMessagePreview: typeof systemContent === 'string' ? systemContent.substring(0, 500) : 'non-string content',
              lastUserMessageRole: messages[messages.length - 1]?.role,
              lastUserMessageIsArray: Array.isArray(messages[messages.length - 1]?.content),
              lastUserMessageContent: messages[messages.length - 1]?.content
                ? JSON.stringify(messages[messages.length - 1].content).substring(0, 500)
                : 'empty',
              documentMarkdownLength: documentMarkdown?.length || 0,
            });

            const stream = await openaiClient.chat.completions.create({
              model: config.model ?? 'gpt-4o-mini',
              messages,
              temperature: config.temperature ?? 0.7,
              max_tokens: config.maxTokens ?? 2048,
              tools,
              tool_choice: 'auto',
              stream: true,
            });

            let content = '';
            const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

            // Process stream chunk by chunk
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta;
              if (!delta) continue;

              // Stream content immediately
              if (delta.content) {
                content += delta.content;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`
                  )
                );
                // Yield to event loop to allow immediate flushing
                await new Promise(resolve => setImmediate(resolve));
              }

              // Accumulate tool calls
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index;
                  if (!toolCallsMap.has(idx)) {
                    toolCallsMap.set(idx, { id: '', name: '', arguments: '' });
                  }
                  const existing = toolCallsMap.get(idx)!;
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name = tc.function.name;
                  if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                }
              }
            }

            // Convert tool calls map to array
            const toolCalls = Array.from(toolCallsMap.values()).map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            }));

            // Update final content
            if (content) {
              finalContent += content;
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
              const isWebSearch = toolName === 'web_search';
              console.log(LOG_TAG, 'Tool routing', { name: toolName, isSandbox, isWebSearch });

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
              } else if (isWebSearch) {
                // Web search tool
                try {
                  const searchQuery = args.query as string;
                  if (!searchQuery) {
                    processedToolCalls.push({
                      name: toolName,
                      arguments: args,
                      applied: false,
                      error: 'Missing query parameter',
                    });
                    continue;
                  }

                  console.log(LOG_TAG, 'Executing web search', { query: searchQuery });

                  // Call DuckDuckGo API
                  const searchRes = await fetch(
                    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/web-search?q=${encodeURIComponent(searchQuery)}`
                  );

                  if (!searchRes.ok) {
                    throw new Error(`Search API error: ${searchRes.status}`);
                  }

                  const searchData = await searchRes.json();
                  console.log(LOG_TAG, 'Web search result', {
                    query: searchQuery,
                    resultsCount: searchData.results?.length || 0,
                  });

                  processedToolCalls.push({
                    name: toolName,
                    arguments: args,
                    applied: true,
                    result: searchData,
                  });

                  // Send search results to frontend
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'web_search_result',
                        query: searchQuery,
                        results: searchData.results || [],
                        rawAbstract: searchData.rawAbstract,
                      })}\n\n`
                    )
                  );
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message : String(err);
                  console.error(LOG_TAG, 'Web search error', errorMsg);
                  processedToolCalls.push({
                    name: toolName,
                    arguments: args,
                    applied: false,
                    error: errorMsg,
                  });
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
              const toolName = 'function' in tc ? tc.function.name : '';

              let toolResponseContent: string;
              if (toolName === 'web_search') {
                // Web search results - pass back to LLM for generating response
                toolResponseContent = JSON.stringify({
                  applied: result.applied,
                  query: result.arguments?.query,
                  results: result.result?.results || [],
                  rawAbstract: result.result?.rawAbstract || '',
                  error: result.error,
                });
              } else if (isSandboxToolName(toolName)) {
                toolResponseContent = JSON.stringify({
                  applied: result.applied,
                  result: result.result,
                  error: result.error,
                });
              } else {
                // Edit tools
                toolResponseContent = result.applied
                  ? JSON.stringify({ applied: true, name: result.name, arguments: result.arguments })
                  : JSON.stringify({ applied: false, error: result.error || 'Edit not applied' });
              }

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
