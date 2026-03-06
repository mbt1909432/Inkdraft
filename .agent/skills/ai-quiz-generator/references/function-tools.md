# Function Calling Tools

OpenAI Function Calling 工具定义，用于强制 AI 返回结构化数据。

## Table of Contents

- [Extract Knowledge Tool](#extract-knowledge-tool)
- [Generate Quiz Tool](#generate-quiz-tool)
- [Result Parsing](#result-parsing)

## Extract Knowledge Tool

```typescript
// lib/quiz/tools/extract-knowledge.ts

import type OpenAI from "openai";

export const EXTRACT_KNOWLEDGE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "extract_knowledge_points",
    description: "从原始文本中提炼核心知识点清单。返回知识点数组，每个知识点包含标题和详细内容描述。",
    parameters: {
      type: "object",
      properties: {
        knowledge_points: {
          type: "array",
          description: "从文本中提取的知识点清单",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "知识点的简短标题",
              },
              content: {
                type: "string",
                description: "知识点的详细内容描述",
              },
            },
            required: ["title", "content"],
          },
        },
      },
      required: ["knowledge_points"],
    },
  },
};

export interface ExtractKnowledgeResult {
  knowledge_points: Array<{
    title: string;
    content: string;
  }>;
}

export function parseExtractKnowledgeResult(result: unknown): ExtractKnowledgeResult {
  if (typeof result === "object" && result !== null && "knowledge_points" in result) {
    return result as ExtractKnowledgeResult;
  }
  throw new Error("Invalid extract_knowledge_points result format");
}
```

## Generate Quiz Tool

```typescript
// lib/quiz/tools/generate-quiz.ts

import type OpenAI from "openai";

export const GENERATE_QUIZ_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "generate_quiz_questions",
    description: "根据知识点生成测验题目。每个知识点生成一道题，包含单选题(mcq)和填空题(fib)。单选题必须提供4个选项，答案必须是A/B/C/D字母。选项内容不要包含A. B. C. D.等前缀。",
    parameters: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          description: "生成的测验题目数组",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["mcq", "fib"],
                description: "题目类型：mcq表示单选题，fib表示填空题",
              },
              question: {
                type: "string",
                description: "题目内容",
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "仅单选题需要，包含4个选项的数组，不要包含A. B. C. D.前缀",
              },
              answer: {
                type: "string",
                description: "如果是mcq类型，这里必须是A/B/C/D字母；如果是fib类型，这里是正确答案文本",
              },
              explanation: {
                type: "string",
                description: "题目解析，用角色口吻写",
              },
            },
            required: ["type", "question", "answer", "explanation"],
          },
        },
      },
      required: ["questions"],
    },
  },
};

export interface GenerateQuizResult {
  questions: Array<{
    type: "mcq" | "fib";
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
  }>;
}
```

## Result Parsing

```typescript
// Clean and validate function results

/** 清理选项文本，移除开头的字母前缀 */
function cleanOption(option: string): string {
  return option.replace(/^[A-D][.、\s]+/i, "").trim();
}

/** 清理答案，确保 MCQ 答案只是单个字母 */
function cleanAnswer(answer: string, type: string): string {
  if (type === "mcq") {
    const match = answer.match(/^[A-D]/i);
    return match ? match[0].toUpperCase() : answer.toUpperCase();
  }
  return answer;
}

export function parseGenerateQuizResult(result: unknown): GenerateQuizResult {
  if (typeof result === "object" && result !== null && "questions" in result) {
    const data = result as GenerateQuizResult;

    // Clean each question
    data.questions = data.questions.map((q) => ({
      ...q,
      options: q.options?.map(cleanOption),
      answer: cleanAnswer(q.answer, q.type),
    }));

    return data;
  }
  throw new Error("Invalid generate_quiz_questions result format");
}
```

## Usage Pattern

Always force the model to call the specific function:

```typescript
const result = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [...],
  tools: [GENERATE_QUIZ_TOOL],
  tool_choice: {
    type: "function",
    function: { name: "generate_quiz_questions" },  // Force this function
  },
});

// Extract structured result
const toolCall = result.choices[0]?.message?.tool_calls?.[0];
const parsed = parseGenerateQuizResult(JSON.parse(toolCall.function.arguments));
```
