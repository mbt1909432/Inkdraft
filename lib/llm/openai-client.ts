/**
 * OpenAI-compatible client for draft: chat + tool call (output_draft)
 * Uses forced tool_choice so the model must call output_draft.
 */

import OpenAI from 'openai';
import type { ChatMessage, LLMConfig, ToolInvocation } from './types';

export function createOpenAIClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
  });
}

function messagesToOpenAIFormat(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

// --- Draft tool: output_draft(markdown) ---

const OUTPUT_DRAFT_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'output_draft',
    description:
      'Output the final draft as a single Markdown document. Call this once when you have finished writing the full draft. Put the complete Markdown in the markdown parameter.',
    parameters: {
      type: 'object',
      properties: {
        markdown: {
          type: 'string',
          description: 'The complete Markdown content of the draft.',
        },
      },
      required: ['markdown'],
    },
  },
};

export function getDraftToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [OUTPUT_DRAFT_SCHEMA];
}

// --- Text action tool: output_text_result(result) for 润色/扩写/缩写/翻译/总结/纠错 ---

const OUTPUT_TEXT_RESULT_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'output_text_result',
    description:
      'Output the result of the text action (polish, expand, shrink, translate, summarize, or correct). Put the final text in the result parameter. No explanation or prefix.',
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: 'The resulting text after the requested action.',
        },
      },
      required: ['result'],
    },
  },
};

export function getTextActionToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [OUTPUT_TEXT_RESULT_SCHEMA];
}

// --- Chat edit tools: search_replace, insert_after (Cursor-style local edits) ---

const SEARCH_REPLACE_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_replace',
    description:
      'Replace a segment of the document. Find the first exact occurrence of old_string in the document and replace it with new_string. Use when the user wants to change existing content.',
    parameters: {
      type: 'object',
      properties: {
        old_string: {
          type: 'string',
          description:
            'The exact segment to replace (must appear verbatim in the document, including newlines/spaces). Prefer a unique segment.',
        },
        new_string: {
          type: 'string',
          description: 'The new content to replace it with. Use empty string to delete that segment.',
        },
      },
      required: ['old_string', 'new_string'],
    },
  },
};

const INSERT_AFTER_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'insert_after',
    description:
      'Insert content after a segment of the document. The content is inserted immediately after the first occurrence of after_string.',
    parameters: {
      type: 'object',
      properties: {
        after_string: {
          type: 'string',
          description:
            'The exact segment after which to insert (must appear verbatim in the document). Typically the end of a paragraph or heading line.',
        },
        content: {
          type: 'string',
          description: 'Markdown content to insert. Start with \\n\\n if you want a blank line before it.',
        },
      },
      required: ['after_string', 'content'],
    },
  },
};

export function getChatEditToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [SEARCH_REPLACE_SCHEMA, INSERT_AFTER_SCHEMA];
}

// --- Web search tool ---

const WEB_SEARCH_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the internet for up-to-date information. Use when the user asks about current events, news, latest data, or information you are uncertain about. Returns search results with titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Use concise, specific keywords.',
        },
      },
      required: ['query'],
    },
  },
};

export function getWebSearchToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [WEB_SEARCH_SCHEMA];
}

const CHAT_EDIT_TOOL_NAMES = new Set(['search_replace', 'insert_after']);

export type OneRoundResult = {
  content: string;
  tool_calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined;
  assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam;
};

/**
 * One round of chat completion: no loop, no edit-tool early return.
 * Caller can execute edit tools on document and loop with assistant + tool results.
 */
export async function createChatCompletionOneRound(
  client: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  config: LLMConfig,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[]
): Promise<OneRoundResult> {
  const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model: config.model ?? 'gpt-4o-mini',
    messages,
    temperature: config.temperature ?? 0.7,
    max_tokens: config.maxTokens ?? 2048,
    tools,
    tool_choice: 'auto',
  };
  const completion = await client.chat.completions.create(params);
  const assistant = completion.choices[0]?.message;
  if (!assistant) throw new Error('No response from model');
  const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
    role: 'assistant',
    content: assistant.content ?? '',
    ...(assistant.tool_calls?.length
      ? {
          tool_calls: assistant.tool_calls.map((tc) => {
            const fn = (tc as { function?: { name: string; arguments?: string } }).function;
            return {
              id: tc.id,
              type: 'function' as const,
              function: { name: fn?.name ?? '', arguments: fn?.arguments ?? '{}' },
            };
          }),
        }
      : {}),
  };
  return {
    content: assistant.content ?? '',
    tool_calls: assistant.tool_calls,
    assistantMessage,
  };
}

function isFunctionToolCall(
  tc: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
  type: 'function';
  function: { name: string; arguments: string };
} {
  return tc.type === 'function' && !!tc.function;
}

const LOG_TAG = '[llm/openai-client]';

async function executeToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): Promise<unknown> {
  if (!isFunctionToolCall(toolCall)) {
    throw new Error(`Unsupported tool call: ${toolCall.type}`);
  }
  const { name, arguments: argsStr } = toolCall.function;
  const args = JSON.parse(argsStr ?? '{}') as Record<string, unknown>;

  if (name === 'output_draft') {
    const out = typeof args.markdown === 'string' ? args.markdown : '';
    console.log(LOG_TAG, 'Tool', { name, resultLen: out.length });
    return out;
  }
  if (name === 'output_text_result') {
    const out = typeof args.result === 'string' ? args.result : '';
    console.log(LOG_TAG, 'Tool', { name, resultLen: out.length });
    return out;
  }
  // Chat edit tools: pass through args so the client can apply them
  if (name === 'search_replace') {
    const old_string = typeof args.old_string === 'string' ? args.old_string : '';
    const new_string = typeof args.new_string === 'string' ? args.new_string : '';
    console.log(LOG_TAG, 'Tool', { name, oldLen: old_string.length, newLen: new_string.length });
    return { old_string, new_string };
  }
  if (name === 'insert_after') {
    const after_string = typeof args.after_string === 'string' ? args.after_string : '';
    const content = typeof args.content === 'string' ? args.content : '';
    console.log(LOG_TAG, 'Tool', { name, afterLen: after_string.length, contentLen: content.length });
    return { after_string, content };
  }
  throw new Error(`Unknown tool: ${name}`);
}

// --- Non-streaming chat with optional forced tool ---

export async function chatCompletion(
  client: OpenAI,
  messages: ChatMessage[],
  config: LLMConfig,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [],
  options?: {
    maxIterations?: number;
    /** Force the model to call this function (e.g. "output_draft"). */
    forcedToolName?: string;
  }
): Promise<{ message: string; toolCalls?: ToolInvocation[] }> {
  const maxIterations = options?.maxIterations ?? 5;
  const forcedToolName = options?.forcedToolName;

  const openAIMessages = messagesToOpenAIFormat(messages);
  const allToolCalls: ToolInvocation[] = [];
  let currentMessages = openAIMessages;

  const MAX_LOG_CONTENT = 4000;
  const trunc = (s: string) =>
    s.length <= MAX_LOG_CONTENT ? s : s.slice(0, MAX_LOG_CONTENT) + '...[truncated]';

  for (let i = 0; i < maxIterations; i++) {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: config.model ?? 'gpt-4o-mini',
      messages: currentMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
    };
    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = forcedToolName
        ? { type: 'function', function: { name: forcedToolName } }
        : 'auto';
    }

    console.log(LOG_TAG, '--- Request (iteration ' + (i + 1) + ') ---');
    console.log(LOG_TAG, 'model', params.model);
    console.log(LOG_TAG, 'messages', currentMessages.map((m) => ({
      role: m.role,
      contentLength: typeof m.content === 'string' ? m.content.length : 0,
      content: typeof m.content === 'string' ? trunc(m.content) : m.content,
    })));
    console.log(LOG_TAG, 'temperature', params.temperature);
    console.log(LOG_TAG, 'max_tokens', params.max_tokens);
    if (params.tools?.length) {
      console.log(LOG_TAG, 'tools', JSON.stringify(params.tools, null, 2));
      console.log(LOG_TAG, 'tool_choice', JSON.stringify(params.tool_choice));
    }

    const completion = await client.chat.completions.create(params);
    const assistant = completion.choices[0]?.message;
    if (!assistant) throw new Error('No response from model');

    if (!assistant.tool_calls?.length) {
      console.log(LOG_TAG, '--- Response: no tool_calls, content ---', trunc(assistant.content ?? ''));
      return {
        message: assistant.content ?? '',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    }

    console.log(LOG_TAG, '--- Response: tool_calls ---');
    for (const tc of assistant.tool_calls) {
      if (!isFunctionToolCall(tc)) continue;
      console.log(LOG_TAG, 'tool_call', {
        name: tc.function.name,
        arguments: trunc(tc.function.arguments ?? '{}'),
      });
    }

    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    for (const tc of assistant.tool_calls) {
      if (!isFunctionToolCall(tc)) continue;
      try {
        const result = await executeToolCall(tc);
        allToolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments ?? '{}'),
          result,
          invokedAt: new Date(),
        });
        toolResults.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments },
        });
      } catch (err) {
        allToolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments ?? '{}'),
          error: err instanceof Error ? err.message : String(err),
          invokedAt: new Date(),
        });
        toolResults.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments },
        });
      }
    }

    // When we force a single tool (e.g. output_draft / output_text_result), one successful call is enough — don't loop again.
    if (forcedToolName) {
      const invoked = allToolCalls.find((t) => t.name === forcedToolName && t.result !== undefined);
      if (invoked) {
        console.log(LOG_TAG, 'Forced tool invoked, returning after 1 iteration');
        return {
          message: typeof invoked.result === 'string' ? invoked.result : '',
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        };
      }
    }

    // When all tool calls are edit tools (search_replace / insert_after), return to client — do not loop (client applies edits).
    const allEditTools =
      assistant.tool_calls?.length > 0 &&
      assistant.tool_calls.every((tc) =>
        isFunctionToolCall(tc) ? CHAT_EDIT_TOOL_NAMES.has(tc.function.name) : false
      );
    if (allEditTools) {
      console.log(LOG_TAG, 'Edit tools only, returning to client');
      return {
        message: assistant.content ?? '',
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    }

    currentMessages = [
      ...currentMessages,
      assistant,
      ...toolResults.map((tc) => ({
        role: 'tool' as const,
        tool_call_id: tc.id,
        content: JSON.stringify(
          allToolCalls.find((t) => t.id === tc.id)?.result ?? {}
        ),
      })),
    ];
  }

  return {
    message: 'Max tool iterations reached.',
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  };
}
