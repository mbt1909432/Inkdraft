# SSE Streaming Response

对于耗时操作，使用 Server-Sent Events 返回实时进度。

## Server Side

```typescript
// app/api/quiz/generate-quiz-stream/route.ts

import { NextRequest } from "next/server";
import { createOpenAIClient, getLLMConfig } from "@/lib/llm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { points, character, questionCount } = body;

  const config = getLLMConfig();
  const client = createOpenAIClient(config);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
      };

      try {
        // 发送进度
        send("status", { message: "正在生成题目..." });

        const result = await client.chat.completions.create({
          model: config.model ?? "gpt-4o-mini",
          messages: [...],
          tools: [GENERATE_QUIZ_TOOL],
          tool_choice: { type: "function", function: { name: "generate_quiz_questions" } },
        });

        // 发送警告（如果数量不匹配）
        if (questions.length !== questionCount) {
          send("warning", {
            message: `请求 ${questionCount} 题，实际生成 ${questions.length} 题`,
          });
        }

        // 发送完成
        send("complete", { questions });
        controller.close();
      } catch (error) {
        send("error", { error: error instanceof Error ? error.message : "Unknown error" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

## Client Side

```typescript
// hooks/useQuizApi.ts

function generateQuizStream(
  points: KnowledgePoint[],
  character: CharacterInfo,
  questionCount: number,
  onStatus: (msg: string) => void,
  onComplete: (questions: Question[]) => void,
  onError: (error: string) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    const response = await fetch("/api/quiz/generate-quiz-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, character, questionCount }),
      signal: controller.signal,
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case "status":
                onStatus(data.message);
                break;
              case "warning":
                console.warn(data.message);
                break;
              case "complete":
                onComplete(data.questions);
                break;
              case "error":
                onError(data.error);
                break;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  })();

  // 返回取消函数
  return () => controller.abort();
}
```

## Usage

```typescript
const cancel = generateQuizStream(
  knowledgePoints,
  character,
  10,
  (msg) => setStatus(msg),           // "正在生成题目..."
  (questions) => setQuestions(questions),
  (error) => console.error(error)
);

// 取消请求
// cancel();
```
