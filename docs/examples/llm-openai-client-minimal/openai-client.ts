/**
 * Minimal OpenAI-compatible client: chat + streaming + one optional tool
 * Dependencies: openai (npm install openai)
 * Copy to your project and remove the example tool if you only need plain chat.
 */

import OpenAI from "openai";
import type { ChatMessage, LLMConfig, ToolInvocation } from "./types";

// --- Client ---

export function createOpenAIClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
  });
}

// --- Message format ---

function messagesToOpenAIFormat(
  messages: ChatMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

// --- Example tool: get_current_time (optional; omit tools array for chat-only) ---

const GET_CURRENT_TIME_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_current_time",
    description: "Returns the current date and time in ISO 8601 format (UTC).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

function runGetCurrentTime(): string {
  return new Date().toISOString();
}

function isFunctionToolCall(
  tc: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
  type: "function";
  function: { name: string; arguments: string };
} {
  return tc.type === "function" && !!tc.function;
}

async function executeToolCall(
  toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall
): Promise<unknown> {
  if (!isFunctionToolCall(toolCall)) {
    throw new Error(`Unsupported tool call: ${toolCall.type}`);
  }
  const { name } = toolCall.function;
  if (name === "get_current_time") {
    return runGetCurrentTime();
  }
  throw new Error(`Unknown tool: ${name}`);
}

/** Optional: pass [GET_CURRENT_TIME_SCHEMA] for one tool; [] for chat-only. */
export function getExampleToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [GET_CURRENT_TIME_SCHEMA];
}

// --- Non-streaming chat (with optional tool loop) ---

export async function chatCompletion(
  client: OpenAI,
  messages: ChatMessage[],
  config: LLMConfig,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [],
  maxIterations = 5
): Promise<{ message: string; toolCalls?: ToolInvocation[] }> {
  const openAIMessages = messagesToOpenAIFormat(messages);
  const allToolCalls: ToolInvocation[] = [];
  let currentMessages = openAIMessages;

  for (let i = 0; i < maxIterations; i++) {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: config.model ?? "gpt-4o-mini",
      messages: currentMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
    };
    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    const completion = await client.chat.completions.create(params);
    const assistant = completion.choices[0]?.message;
    if (!assistant) throw new Error("No response from model");

    if (!assistant.tool_calls?.length) {
      return {
        message: assistant.content ?? "",
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      };
    }

    const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
    for (const tc of assistant.tool_calls) {
      if (!isFunctionToolCall(tc)) continue;
      try {
        const result = await executeToolCall(tc);
        allToolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments ?? "{}"),
          result,
          invokedAt: new Date(),
        });
        toolResults.push({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        });
      } catch (err) {
        allToolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments ?? "{}"),
          error: err instanceof Error ? err.message : String(err),
          invokedAt: new Date(),
        });
        toolResults.push({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        });
      }
    }

    currentMessages = [
      ...currentMessages,
      assistant,
      ...toolResults.map((tc) => ({
        role: "tool" as const,
        tool_call_id: tc.id,
        content: JSON.stringify(
          allToolCalls.find((t) => t.id === tc.id)?.result ?? {}
        ),
      })),
    ];
  }

  return {
    message: "Max tool iterations reached.",
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  };
}

// --- Streaming chat (with optional tool loop) ---

export type StreamEvent =
  | { type: "message"; content: string }
  | { type: "tool_call_start"; toolCall: ToolInvocation }
  | { type: "tool_call_complete"; toolCall: ToolInvocation }
  | { type: "tool_call_error"; toolCall: ToolInvocation }
  | { type: "final_message"; message: string; toolCalls?: ToolInvocation[] };

export async function* chatCompletionStream(
  client: OpenAI,
  messages: ChatMessage[],
  config: LLMConfig,
  tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [],
  maxIterations = 5
): AsyncGenerator<StreamEvent> {
  const openAIMessages = messagesToOpenAIFormat(messages);
  const allToolCalls: ToolInvocation[] = [];
  let currentMessages = openAIMessages;

  for (let i = 0; i < maxIterations; i++) {
    const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: config.model ?? "gpt-4o-mini",
      messages: currentMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 2048,
      stream: true,
    };
    if (tools.length > 0) {
      params.tools = tools;
      params.tool_choice = "auto";
    }

    const stream = await client.chat.completions.create(params);
    let content = "";
    const toolCallsAccumulator: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }> = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        yield { type: "message", content: delta.content };
      }
      if (delta.tool_calls) {
        for (const d of delta.tool_calls) {
          const idx = d.index ?? 0;
          if (!toolCallsAccumulator[idx]) {
            toolCallsAccumulator[idx] = {
              id: d.id ?? "",
              type: "function",
              function: {
                name: d.function?.name ?? "",
                arguments: d.function?.arguments ?? "",
              },
            };
          } else {
            toolCallsAccumulator[idx].function.arguments +=
              d.function?.arguments ?? "";
          }
        }
      }
    }

    const assistantToolCalls = toolCallsAccumulator.filter(
      (tc) => tc.id && tc.function.name
    );
    if (assistantToolCalls.length === 0) {
      yield {
        type: "final_message",
        message: content,
        toolCalls:
          allToolCalls.length > 0 ? allToolCalls : undefined,
      };
      return;
    }

    type FunctionToolCall = {
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    };
    const toolResults: FunctionToolCall[] = [];
    for (const tc of assistantToolCalls) {
      const toolCall: FunctionToolCall = {
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      };
      const invocation: ToolInvocation = {
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
        invokedAt: new Date(),
      };
      yield { type: "tool_call_start", toolCall: invocation };

      try {
        const result = await executeToolCall(toolCall);
        invocation.result = result;
        allToolCalls.push(invocation);
        yield { type: "tool_call_complete", toolCall: invocation };
        toolResults.push(toolCall);
      } catch (err) {
        invocation.error = err instanceof Error ? err.message : String(err);
        allToolCalls.push(invocation);
        yield { type: "tool_call_error", toolCall: invocation };
        toolResults.push(toolCall);
      }
    }

    currentMessages = [
      ...currentMessages,
      {
        role: "assistant" as const,
        content,
        tool_calls: toolResults.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: tc.function,
        })),
      },
      ...toolResults.map((tc) => {
        const inv = allToolCalls.find((t) => t.id === tc.id);
        const content = inv?.error
          ? JSON.stringify({ error: inv.error })
          : JSON.stringify(inv?.result ?? {});
        return {
          role: "tool" as const,
          tool_call_id: tc.id,
          content,
        };
      }),
    ];
  }

  yield {
    type: "final_message",
    message: "Max tool iterations reached.",
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  };
}
