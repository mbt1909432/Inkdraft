# Large Text Handling

对于超过 4000 字符的长文本，使用分块处理策略。

## Strategy

```
Original Text (10000 chars)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Chunk 1 (0-4000)     │  Overlap (3500-4000)       │
│                       │        ↓                    │
│                       │  Chunk 2 (3500-7500) │ Overlap (7000-7500)
│                       │                      │     ↓
│                       │                      │ Chunk 3 (7000-10000)
└─────────────────────────────────────────────────────┘
    │
    ▼
Extract from each chunk (max 3 concurrent)
    │
    ▼
Deduplicate by title similarity
    │
    ▼
Final Knowledge Points
```

## Configuration

```typescript
const CHUNK_SIZE = 4000;   // 每块字符数
const OVERLAP = 500;        // 重叠字符数，保持上下文连续性
const MAX_CONCURRENT = 3;   // 最大并发请求数
```

## Implementation

```typescript
// app/api/quiz/extract-knowledge/route.ts

/** 分块函数 */
function splitIntoChunks(content: string, chunkSize: number, overlap: number): string[] {
  if (content.length <= chunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push(content.slice(start, end));
    start += chunkSize - overlap;  // 重叠部分
  }

  return chunks;
}

/** 相似度计算 (Jaccard) */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));

  return intersection.size / (setA.size + setB.size - intersection.size);
}

/** 去重 */
function deduplicateKnowledgePoints(points: KnowledgePoint[]): KnowledgePoint[] {
  const seen = new Map<string, KnowledgePoint>();

  for (const point of points) {
    const normalizedTitle = point.title.toLowerCase().trim();

    // 检查是否存在相似标题
    let foundSimilar = false;
    for (const [existingTitle, existingPoint] of seen) {
      // 标题包含关系或相似度 > 0.7
      if (
        normalizedTitle.includes(existingTitle) ||
        existingTitle.includes(normalizedTitle) ||
        calculateSimilarity(normalizedTitle, existingTitle) > 0.7
      ) {
        // 保留内容更完整的
        if (point.content.length > existingPoint.content.length) {
          seen.delete(existingTitle);
          seen.set(normalizedTitle, point);
        }
        foundSimilar = true;
        break;
      }
    }

    if (!foundSimilar) {
      seen.set(normalizedTitle, point);
    }
  }

  return Array.from(seen.values());
}

/** 批量处理 */
async function processChunksInBatches(
  chunks: string[],
  config: LLMConfig,
  onProgress: (current: number, total: number, message: string) => void
): Promise<KnowledgePoint[]> {
  const results: KnowledgePoint[] = [];

  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT);

    onProgress(
      i + 1,
      chunks.length,
      `正在处理第 ${i + 1}-${Math.min(i + MAX_CONCURRENT, chunks.length)} / ${chunks.length} 段...`
    );

    // 并行处理当前批次
    const batchResults = await Promise.all(
      batch.map((chunk, idx) => extractFromChunk(chunk, i + idx, chunks.length, config))
    );

    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }
  }

  return results;
}
```

## Streaming with Progress

```typescript
// 返回 SSE 流式响应
const stream = new ReadableStream({
  async start(controller) {
    const send = (type: string, data: Record<string, unknown>) => {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
      );
    };

    // 发送进度
    send("progress", {
      current: 0,
      total: chunks.length,
      message: `开始处理 ${chunks.length} 个分段...`,
    });

    // 分批处理
    const allPoints = await processChunksInBatches(chunks, config, (current, total, message) => {
      send("progress", { current, total, message });
    });

    // 去重
    send("progress", {
      current: chunks.length,
      total: chunks.length,
      message: `正在去重和整合 ${allPoints.length} 个知识点...`,
    });

    const deduplicated = deduplicateKnowledgePoints(allPoints);

    // 完成
    send("complete", {
      knowledgePoints: deduplicated,
      stats: {
        totalChunks: chunks.length,
        rawPoints: allPoints.length,
        deduplicatedPoints: deduplicated.length,
      },
    });

    controller.close();
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  },
});
```

## Client Usage

```typescript
const response = await fetch("/api/quiz/extract-knowledge", {
  method: "POST",
  body: JSON.stringify({ content: largeText }),
});

// 检查是否是流式响应
if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
  const reader = response.body.getReader();
  // ... 处理 SSE 事件
}
```
