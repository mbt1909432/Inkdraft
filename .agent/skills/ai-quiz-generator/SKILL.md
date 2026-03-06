---
name: ai-quiz-generator
description: |
  AI 驱动的测验生成系统，基于 OpenAI Function Calling 实现结构化输出。
  支持：从文本提取知识点、生成单选题/填空题、角色人设注入、AI评语生成。
  触发场景：(1) 构建测验/考试系统 (2) 知识点自动提取 (3) 个性化导师出题 (4) 学习内容转题库
  关键词：quiz, test, exam, assessment, knowledge extraction, MCQ, 出题, 测验
---

# AI Quiz Generator

基于 OpenAI Function Calling 的结构化测验生成系统，用于 Next.js 应用。

## Architecture

```
User Text → Extract Knowledge → Generate Quiz → User Answers → Generate Summary
                ↓                      ↓                              ↓
         Function Calling       Function Calling              Plain Chat
         { knowledge_points }   { questions }                 { summary }
```

## Quick Start

### Environment

```env
OPENAI_LLM_ENDPOINT=https://api.openai.com/v1
OPENAI_LLM_API_KEY=sk-xxx
OPENAI_LLM_MODEL=gpt-4o-mini
```

### Install

```bash
npm install openai
```

### File Structure

```
lib/
├── llm/           → See [references/llm-client.md](references/llm-client.md)
└── quiz/
    ├── types.ts   → See [references/types.md](references/types.md)
    └── tools/     → See [references/function-tools.md](references/function-tools.md)

app/api/quiz/
├── extract-knowledge/
├── generate-quiz/
└── generate-summary/  → See [references/api-routes.md](references/api-routes.md)
```

## Core Workflow

### Step 1: Extract Knowledge Points

```typescript
const response = await fetch("/api/quiz/extract-knowledge", {
  method: "POST",
  body: JSON.stringify({ content: userText }),
});
const { knowledgePoints } = await response.json();
// → [{ id, title, content }, ...]
```

### Step 2: Generate Quiz

```typescript
const response = await fetch("/api/quiz/generate-quiz", {
  method: "POST",
  body: JSON.stringify({
    points: knowledgePoints,
    character: { name: "孔子", persona: "因材施教...", avatar: "" },
    questionCount: 10,
    quizType: "mixed",
  }),
});
const { questions } = await response.json();
// → [{ id, type, question, options?, answer, explanation }, ...]
```

### Step 3: Generate Summary

```typescript
const response = await fetch("/api/quiz/generate-summary", {
  method: "POST",
  body: JSON.stringify({
    questions,
    userAnswers: { "q-1": "A", "q-2": "答案文本" },
    character,
  }),
});
const { summary } = await response.json();
// → Markdown 格式的 AI 评语
```

## Key Patterns

### Force Structured Output

```typescript
// Always use tool_choice to force specific function call
tools: [GENERATE_QUIZ_TOOL],
tool_choice: {
  type: "function",
  function: { name: "generate_quiz_questions" },
}
```

### Character Persona Injection

```typescript
const systemPrompt = `你现在扮演的角色是：${character.name}。
你的设定是：${character.persona}。

请基于提供的知识点清单，为你的学生生成测验题目。`;
```

### Clean Function Results

```typescript
// MCQ answer must be single letter A/B/C/D
function cleanAnswer(answer: string, type: string): string {
  if (type === "mcq") {
    return answer.match(/^[A-D]/i)?.[0]?.toUpperCase() ?? answer;
  }
  return answer;
}

// Remove option prefixes
function cleanOption(opt: string): string {
  return opt.replace(/^[A-D][.、\s]+/i, "").trim();
}
```

## Character Templates

```typescript
const CHARACTERS = {
  confucius: {
    name: "孔子",
    persona: "因材施教的教育家，善于用比喻和故事讲解，强调学而时习之",
  },
  socrates: {
    name: "苏格拉底",
    persona: "提问式引导的大师，通过连续追问帮助学生自己发现答案",
  },
  einstein: {
    name: "爱因斯坦",
    persona: "思想实验爱好者，善于用生动有趣的比喻解释复杂概念",
  },
};
```

## API Reference

| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/quiz/extract-knowledge` | `{ content: string }` | `{ knowledgePoints: KnowledgePoint[] }` |
| `POST /api/quiz/generate-quiz` | `{ points, character, questionCount, quizType }` | `{ questions: Question[] }` |
| `POST /api/quiz/generate-summary` | `{ questions, userAnswers, character }` | `{ summary: string }` |

## Advanced Topics

- **Streaming Response**: See [references/streaming.md](references/streaming.md) for SSE implementation
- **Large Text Handling**: See [references/large-text.md](references/large-text.md) for chunking strategy
- **Full API Implementation**: See [references/api-routes.md](references/api-routes.md)

## Troubleshooting

**Q: Why Function Calling instead of JSON mode?**

Function Calling with `tool_choice` guarantees the exact structure. JSON mode only suggests format, models may still deviate.

**Q: MCQ answer is not a single letter?**

Clean the result: `answer.match(/^[A-D]/i)?.[0]?.toUpperCase()`

**Q: Options contain "A. " prefix?**

Clean options: `opt.replace(/^[A-D][.、\s]+/i, "").trim()`
