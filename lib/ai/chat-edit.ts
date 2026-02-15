/**
 * Chat with edit tools: search_replace, insert_after (Cursor-style local edits).
 * Model can reply in text and/or call tools to edit the current document.
 * When a tool fails (e.g. old_string not found), we re-read the document and
 * feed errors back to the LLM in a loop until it returns no tool calls.
 */

import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import {
  createOpenAIClient,
  createChatCompletionOneRound,
  getChatEditToolSchema,
} from '@/lib/llm/openai-client';
import type { ChatMessage } from '@/lib/llm/types';
import type { ToolInvocation } from '@/lib/llm/types';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';

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

const LOG_TAG = '[llm/chat-edit]';

const MAX_EDIT_LOOP_ITERATIONS = 8;

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

export interface RunChatWithEditToolsOptions {
  messages: ChatMessage[];
  documentMarkdown: string;
  selectionMarkdown?: string | null;
}

export interface RunChatWithEditToolsResult {
  message: string;
  toolCalls?: ToolInvocation[];
  /** Final document after server-side edit loop (when tool calls were applied). */
  documentMarkdown?: string;
}

export async function runChatWithEditTools(
  options: RunChatWithEditToolsOptions
): Promise<RunChatWithEditToolsResult> {
  const { messages, documentMarkdown, selectionMarkdown } = options;

  const config = getLLMConfig();
  const client = createOpenAIClient(config);
  const tools = getChatEditToolSchema();

  const userConversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  let currentDoc = documentMarkdown;
  const allToolCalls: ToolInvocation[] = [];
  let conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = userConversation;

  console.log(LOG_TAG, 'Run', {
    messageCount: messages.length,
    docLen: documentMarkdown.length,
    hasSelection: !!selectionMarkdown?.trim(),
  });

  for (let iter = 0; iter < MAX_EDIT_LOOP_ITERATIONS; iter++) {
    const systemContent = buildSystemContent(currentDoc, selectionMarkdown);
    const fullMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      ...conversationMessages,
    ];

    console.log(LOG_TAG, 'Loop', { iter: iter + 1, docLen: currentDoc.length });

    const result = await createChatCompletionOneRound(client, fullMessages, config, tools);

    if (!result.tool_calls?.length) {
      console.log(LOG_TAG, 'Done', { messageLen: result.content?.length ?? 0, toolCallsTotal: allToolCalls.length });
      return {
        message: result.content ?? '',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        documentMarkdown: allToolCalls.length > 0 ? currentDoc : undefined,
      };
    }

    const toolResultMessages: { role: 'tool'; tool_call_id: string; content: string }[] = [];
    const isFunctionToolCall = (
      tc: (typeof result.tool_calls)[number]
    ): tc is (typeof result.tool_calls)[number] & { function: { name: string; arguments: string } } =>
      tc.type === 'function' && !!tc.function;

    for (const tc of result.tool_calls) {
      if (!isFunctionToolCall(tc)) continue;
      const name = tc.function.name;
      const args = (() => {
        try {
          return JSON.parse(tc.function.arguments ?? '{}') as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      const appliedResult = applyEditTool(currentDoc, name, args);
      if (appliedResult.applied) currentDoc = appliedResult.newMarkdown;

      const toolResult = appliedResult.applied
        ? { applied: true as const }
        : { applied: false as const, error: appliedResult.error ?? 'unknown' };
      toolResultMessages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult),
      });
      allToolCalls.push({
        id: tc.id,
        name,
        arguments: args,
        result: toolResult,
        ...(appliedResult.applied ? {} : { error: appliedResult.error }),
        invokedAt: new Date(),
      });
    }

    conversationMessages = [
      ...conversationMessages,
      result.assistantMessage,
      ...toolResultMessages,
    ];
  }

  console.log(LOG_TAG, 'Done (max iterations)', { toolCallsTotal: allToolCalls.length });
  return {
    message: '已达到最大重试轮数，请查看上方工具调用结果。',
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    documentMarkdown: allToolCalls.length > 0 ? currentDoc : undefined,
  };
}
