# Minimal LLM OpenAI Client (Chat + Streaming + One Tool)

Standalone example for migrating the “LLM request” block to another project. Supports **chat-only**, **streaming**, and **one optional tool** (`get_current_time`).

## Files to Copy

| File            | Purpose                          |
|-----------------|-----------------------------------|
| `types.ts`      | `ChatMessage`, `LLMConfig`, `ToolInvocation` |
| `config.ts`     | `getLLMConfig()` from env         |
| `openai-client.ts` | Client, chat, stream, optional tool |

## Dependencies

```bash
npm install openai
```

## Environment Variables

```env
OPENAI_LLM_ENDPOINT=https://api.openai.com/v1
OPENAI_LLM_API_KEY=sk-...
OPENAI_LLM_MODEL=gpt-4o-mini
OPENAI_LLM_TEMPERATURE=0.7
OPENAI_LLM_MAX_TOKENS=2048
```

Use any OpenAI-compatible endpoint (e.g. Azure, local proxy).

## Usage

### 1. Chat only (no tools, non-streaming)

```ts
import { getLLMConfig } from "./config";
import { createOpenAIClient, chatCompletion } from "./openai-client";

const config = getLLMConfig();
const client = createOpenAIClient(config);

const { message } = await chatCompletion(client, [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
], config, []); // empty tools = chat only

console.log(message);
```

### 2. Chat + streaming (no tools)

```ts
import { chatCompletionStream } from "./openai-client";

for await (const event of chatCompletionStream(client, messages, config, [])) {
  if (event.type === "message") process.stdout.write(event.content);
  if (event.type === "final_message") {
    console.log("\nDone:", event.message);
  }
}
```

### 3. With one simple tool (streaming)

```ts
import {
  chatCompletionStream,
  getExampleToolSchema,
} from "./openai-client";

const tools = getExampleToolSchema(); // [get_current_time]

for await (const event of chatCompletionStream(client, messages, config, tools)) {
  switch (event.type) {
    case "message":
      process.stdout.write(event.content);
      break;
    case "tool_call_start":
      console.log("\n[Tool]", event.toolCall.name);
      break;
    case "tool_call_complete":
      console.log("  Result:", event.toolCall.result);
      break;
    case "tool_call_error":
      console.log("  Error:", event.toolCall.error);
      break;
    case "final_message":
      console.log("\nDone:", event.message);
      break;
  }
}
```

### 4. SSE API route (Next.js example)

```ts
// app/api/chat/route.ts
import { getLLMConfig } from "@/lib/config";
import {
  createOpenAIClient,
  chatCompletionStream,
  getExampleToolSchema,
} from "@/lib/openai-client";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const config = getLLMConfig();
  const client = createOpenAIClient(config);
  const tools = getExampleToolSchema(); // or []

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const event of chatCompletionStream(client, messages, config, tools)) {
          if (event.type === "message") send("message", { content: event.content });
          if (event.type === "tool_call_start") send("tool_call_start", { toolCall: event.toolCall });
          if (event.type === "tool_call_complete") send("tool_call_complete", { toolCall: event.toolCall });
          if (event.type === "tool_call_error") send("tool_call_error", { toolCall: event.toolCall });
          if (event.type === "final_message") {
            send("done", { message: event.message });
            break;
          }
        }
      } catch (e) {
        send("error", { error: String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## Adding Your Own Tool

1. Define the schema (OpenAI function format) and add it to a `tools` array.
2. In `executeToolCall`, add a branch: `if (name === "your_tool") return yourHandler(args);`
3. Pass the tools into `chatCompletion` / `chatCompletionStream`.

## Chat-only: Remove the example tool

- Omit `getExampleToolSchema` and always pass `[]` as `tools`.
- You can delete `executeToolCall`, `GET_CURRENT_TIME_SCHEMA`, and `runGetCurrentTime` from `openai-client.ts` if you never use tools.
