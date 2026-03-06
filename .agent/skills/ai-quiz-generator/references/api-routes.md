# API Routes Implementation

完整的 Next.js API Route 实现代码。

## Table of Contents

- [Extract Knowledge](#extract-knowledge)
- [Generate Quiz](#generate-quiz)
- [Generate Summary](#generate-summary)

## Extract Knowledge

`app/api/quiz/extract-knowledge/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient, getLLMConfig } from "@/lib/llm";
import {
  EXTRACT_KNOWLEDGE_TOOL,
  parseExtractKnowledgeResult,
} from "@/lib/quiz/tools/extract-knowledge";
import type { KnowledgePoint } from "@/lib/quiz/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const config = getLLMConfig();
    const client = createOpenAIClient(config);

    const result = await client.chat.completions.create({
      model: config.model ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `你是一名资深教育专家，擅长从文本中提炼核心知识点。
请分析用户提供的文本，提取出所有重要的知识点。
每个知识点需要包含：
1. title: 简练的标题
2. content: 详细的内容描述

请确保：
- 覆盖文本中的所有关键考点
- 每个知识点都要简练且包含核心概念
- 尽量保持知识点的独立性，便于后续出题`,
        },
        {
          role: "user",
          content: `请从以下文本中提炼核心知识点清单：\n\n${content}`,
        },
      ],
      tools: [EXTRACT_KNOWLEDGE_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "extract_knowledge_points" },
      },
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 20000,
    });

    const toolCalls = result.choices[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return NextResponse.json({ error: "Failed to extract knowledge" }, { status: 500 });
    }

    const functionToolCall = toolCalls[0];
    if (functionToolCall.type !== "function" || !functionToolCall.function) {
      return NextResponse.json({ error: "Invalid tool call" }, { status: 500 });
    }

    const toolResult = JSON.parse(functionToolCall.function.arguments);
    const parsed = parseExtractKnowledgeResult(toolResult);

    const knowledgePoints: KnowledgePoint[] = parsed.knowledge_points.map((kp, i) => ({
      id: `kp-${Date.now()}-${i}`,
      title: kp.title,
      content: kp.content,
    }));

    return NextResponse.json({ knowledgePoints });
  } catch (error) {
    console.error("Extract knowledge error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Generate Quiz

`app/api/quiz/generate-quiz/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient, getLLMConfig, type ChatMessage } from "@/lib/llm";
import {
  GENERATE_QUIZ_TOOL,
  parseGenerateQuizResult,
} from "@/lib/quiz/tools/generate-quiz";
import type { KnowledgePoint, CharacterInfo, Question, QuizType } from "@/lib/quiz/types";
import { QuestionType } from "@/lib/quiz/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { points, character, knowledgePointCount, questionCount, quizType } = body as {
      points: KnowledgePoint[];
      character: CharacterInfo;
      knowledgePointCount: number;
      questionCount: number;
      quizType: QuizType;
    };

    // Validation
    if (!points?.length) {
      return NextResponse.json({ error: "Knowledge points required" }, { status: 400 });
    }
    if (!character?.name || !character?.persona) {
      return NextResponse.json({ error: "Character info required" }, { status: 400 });
    }

    const config = getLLMConfig();
    const client = createOpenAIClient(config);

    // Select knowledge points
    const shuffled = [...points].sort(() => 0.5 - Math.random());
    const selectedPoints = shuffled.slice(0, Math.min(knowledgePointCount, shuffled.length));
    const questionsPerPoint = Math.ceil(questionCount / selectedPoints.length);

    // Quiz type instruction
    const quizTypeInstruction = {
      mcq: `5. **题型要求：全部为单选题（mcq）** - 所有题目 type 字段必须是 "mcq"`,
      fib: `5. **题型要求：全部为填空题（fib）** - 用 _____ 标记填空位置`,
      mixed: `5. **题型要求：单选题和填空题各占一半**`,
    };

    const systemPrompt = `你现在扮演的角色是：${character.name}。
你的设定是：${character.persona}。

请基于提供的知识点清单，为你的学生生成测验题目。

【重要要求】
1. 总共需要生成 **大约 ${questionCount} 道题目**
2. 当前有 ${selectedPoints.length} 个知识点，平均每个知识点生成约 ${questionsPerPoint} 道题
3. 题目可以覆盖多个知识点，也可以针对单个知识点深入出题
4. **所有内容都要用 ${character.name} 的口吻和语气来写**，包括题目、选项、解析
${quizTypeInstruction[quizType || "mixed"]}
6. 对于单选题（mcq）：
   - "answer" 字段必须且只能是正确选项对应的字母（A/B/C/D）
   - 必须提供 4 个选项在 "options" 数组中
7. 对于填空题（fib）：
   - "answer" 字段是正确答案的文本
   - 不需要 "options" 字段`;

    const userPrompt = `请基于以下 ${selectedPoints.length} 个知识点，生成大约 ${questionCount} 道测验题目。

知识点清单：
${selectedPoints.map((p, i) => `${i + 1}. ${p.title}: ${p.content}`).join("\n")}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const result = await client.chat.completions.create({
      model: config.model ?? "gpt-4o-mini",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [GENERATE_QUIZ_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "generate_quiz_questions" },
      },
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 20000,
    });

    const toolCalls = result.choices[0]?.message?.tool_calls;
    if (!toolCalls?.length) {
      return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
    }

    const functionToolCall = toolCalls[0];
    if (functionToolCall.type !== "function" || !functionToolCall.function) {
      return NextResponse.json({ error: "Invalid tool call" }, { status: 500 });
    }

    const toolResult = JSON.parse(functionToolCall.function.arguments);
    const parsed = parseGenerateQuizResult(toolResult);

    const questions: Question[] = parsed.questions.map((q, index) => ({
      id: `q-${Date.now()}-${index}`,
      type: q.type === "mcq" ? QuestionType.MCQ : QuestionType.FIB,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    }));

    return NextResponse.json({
      requested: questionCount,
      generated: questions.length,
      knowledgePointsUsed: selectedPoints.length,
      questions,
    });
  } catch (error) {
    console.error("Generate quiz error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

## Generate Summary

`app/api/quiz/generate-summary/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createOpenAIClient, getLLMConfig, type ChatMessage } from "@/lib/llm";
import type { Question, CharacterInfo } from "@/lib/quiz/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions, userAnswers, character } = body as {
      questions: Question[];
      userAnswers: Record<string, string>;
      character: CharacterInfo;
    };

    if (!questions?.length) {
      return NextResponse.json({ error: "Questions required" }, { status: 400 });
    }
    if (!character?.name || !character?.persona) {
      return NextResponse.json({ error: "Character info required" }, { status: 400 });
    }

    // Calculate performance
    const performanceData = questions.map((q, index) => {
      const userAnswer = userAnswers[q.id] || "未作答";
      const isCorrect = q.type === "mcq"
        ? userAnswer?.trim().toUpperCase() === q.answer.trim().toUpperCase()
        : userAnswer?.trim().toLowerCase() === q.answer.trim().toLowerCase();

      return {
        题号: index + 1,
        题目: q.question,
        题型: q.type === "mcq" ? "单选题" : "填空题",
        选项: q.options,
        学生答案: userAnswer,
        正确答案: q.answer,
        是否正确: isCorrect ? "✓ 正确" : "✗ 错误",
        题目解析: q.explanation,
      };
    });

    const wrongAnswers = performanceData.filter((p) => p.是否正确 === "✗ 错误");
    const correctCount = performanceData.filter((p) => p.是否正确 === "✓ 正确").length;
    const score = Math.round((correctCount / questions.length) * 100);

    const config = getLLMConfig();
    const client = createOpenAIClient(config);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `你现在扮演的角色是：${character.name}。
你的设定是：${character.persona}。

你是一名资深导师，正在批改学生的测验卷子。请根据学生的答题情况，给出详细的个性化评语。

【评语结构要求】
1. **总体评价**（2-3句话）- 总分和正确率，整体表现简评
2. **逐题分析错误**（重点！）- 对于每道错题：题号、题目、学生答案、正确答案、错误原因分析、正确理解方式
3. **学习建议**（2-3条具体建议）

【语气要求】
- 全程使用 ${character.name} 的说话风格和口吻
- 语调积极鼓励，但对错误要严肃指出
- 用 markdown 格式输出，结构清晰`,
      },
      {
        role: "user",
        content: `请批改这份测验并给出详细评语：

## 测验概况
- 总得分：${score}分 (${correctCount}/${questions.length} 正确)
- 答错：${wrongAnswers.length} 题

## 错题详情
${wrongAnswers.map((p) => `
### 第 ${p.题号} 题 (${p.题型})
**题目**：${p.题目}
${p.选项 ? `**选项**：\n${p.选项.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}` : ""}
**学生答案**：${p.学生答案}
**正确答案**：${p.正确答案}
**题目解析**：${p.题目解析}
`).join("\n---\n")}

请给出详细评语，**必须逐题分析每一道错题的原因**。直接输出 markdown 格式。`,
      },
    ];

    const result = await client.chat.completions.create({
      model: config.model ?? "gpt-4o-mini",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 20000,
    });

    const summary = result.choices[0]?.message?.content;

    if (!summary) {
      return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Generate summary error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```
