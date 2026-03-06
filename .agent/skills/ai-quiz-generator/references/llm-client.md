# LLM Client Setup

## Table of Contents

- [Types](#types)
- [Config](#config)
- [Client](#client)
- [Usage](#usage)

## Types

```typescript
// lib/llm/types.ts

export interface LLMConfig {
  endpoint: string;      // API 端点 URL
  apiKey: string;        // API 密钥
  model?: string;        // 模型名称，默认 gpt-4o-mini
  temperature?: number;  // 温度参数 0-1，默认 0.7
  maxTokens?: number;    // 最大 token 数，默认 20000
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
```

## Config

```typescript
// lib/llm/config.ts

import type { LLMConfig } from "./types";

export function getLLMConfig(): LLMConfig {
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;

  if (!endpoint) {
    throw new Error("OPENAI_LLM_ENDPOINT is not set");
  }
  if (!apiKey) {
    throw new Error("OPENAI_LLM_API_KEY is not set");
  }

  return {
    endpoint,
    apiKey,
    model: process.env.OPENAI_LLM_MODEL ?? "gpt-4o-mini",
    temperature: process.env.OPENAI_LLM_TEMPERATURE
      ? parseFloat(process.env.OPENAI_LLM_TEMPERATURE)
      : 0.7,
    maxTokens: process.env.OPENAI_LLM_MAX_TOKENS
      ? parseInt(process.env.OPENAI_LLM_MAX_TOKENS, 10)
      : 20000,
  };
}
```

## Client

```typescript
// lib/llm/client.ts

import OpenAI from "openai";
import type { LLMConfig } from "./types";

export function createOpenAIClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
  });
}
```

## Usage

```typescript
// In API route
import { createOpenAIClient, getLLMConfig } from "@/lib/llm";

const config = getLLMConfig();
const client = createOpenAIClient(config);

const result = await client.chat.completions.create({
  model: config.model ?? "gpt-4o-mini",
  messages: [...],
  tools: [...],
  tool_choice: { type: "function", function: { name: "..." } },
  temperature: config.temperature ?? 0.7,
  max_tokens: config.maxTokens ?? 20000,
});
```

## Compatible APIs

Any OpenAI-compatible API works:

| Provider | Endpoint |
|----------|----------|
| OpenAI | `https://api.openai.com/v1` |
| Azure OpenAI | `https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` |
