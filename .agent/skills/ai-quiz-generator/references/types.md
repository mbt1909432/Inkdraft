# Quiz Types

## Table of Contents

- [Core Types](#core-types)
- [API Types](#api-types)
- [State Types](#state-types)

## Core Types

```typescript
// lib/quiz/types.ts

/** 题目类型 */
export enum QuestionType {
  MCQ = "mcq",  // 单选题
  FIB = "fib",  // 填空题
}

/** 题目 */
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];     // 仅 MCQ 需要，4个选项
  answer: string;         // MCQ: A/B/C/D, FIB: 答案文本
  explanation: string;    // 题目解析
}

/** 知识点 */
export interface KnowledgePoint {
  id: string;
  title: string;
  content: string;
}

/** 角色信息 */
export interface CharacterInfo {
  name: string;       // 角色名称
  avatar: string;     // 头像 URL 或 Base64
  persona: string;    // 角色设定/性格描述
}

/** 题型模式 */
export type QuizType = "mcq" | "fib" | "mixed";
```

## API Types

```typescript
/** 提取知识点请求 */
export interface ExtractKnowledgeRequest {
  content: string;
}

/** 提取知识点响应 */
export interface ExtractKnowledgeResponse {
  knowledgePoints: KnowledgePoint[];
}

/** 生成测验请求 */
export interface GenerateQuizRequest {
  points: KnowledgePoint[];
  character: CharacterInfo;
  knowledgePointCount: number;  // 使用多少个知识点
  questionCount: number;        // 生成多少道题
  quizType: QuizType;
}

/** 生成测验响应 */
export interface GenerateQuizResponse {
  requested: number;        // 请求的题目数
  generated: number;        // 实际生成的题目数
  knowledgePointsUsed: number;
  questions: Question[];
}

/** 生成评语请求 */
export interface GenerateSummaryRequest {
  questions: Question[];
  userAnswers: Record<string, string>;
  character: CharacterInfo;
}

/** 生成评语响应 */
export interface GenerateSummaryResponse {
  summary: string;  // Markdown 格式
}
```

## State Types

```typescript
/** 视图状态 */
export type ViewState =
  | "home"
  | "setup"
  | "knowledge"
  | "quiz"
  | "result"
  | "library";

/** Quiz 状态 */
export interface QuizState {
  view: ViewState;
  questions: Question[];
  knowledgePoints: KnowledgePoint[];
  currentIdx: number;
  userAnswers: Record<string, string>;
  isFinished: boolean;
  isLoading: boolean;
  isSummarizing: boolean;
  character: CharacterInfo | null;
  summary?: string;
  error?: string;
}

/** Quiz Actions */
export type QuizAction =
  | { type: "SET_VIEW"; payload: ViewState }
  | { type: "SET_CHARACTER"; payload: CharacterInfo }
  | { type: "SET_KNOWLEDGE_POINTS"; payload: KnowledgePoint[] }
  | { type: "SET_QUESTIONS"; payload: Question[] }
  | { type: "SET_ANSWER"; payload: { questionId: string; answer: string } }
  | { type: "NEXT_QUESTION" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SUMMARIZING"; payload: boolean }
  | { type: "SET_SUMMARY"; payload: string }
  | { type: "SET_ERROR"; payload: string | undefined }
  | { type: "FINISH_QUIZ" }
  | { type: "RESET" };
```
