/**
 * Types for AI Quiz Generator
 */

// Question types
export type QuestionType = 'mcq' | 'fib';

// Single choice question (Multiple Choice Question)
export interface MCQQuestion {
  id: string;
  type: 'mcq';
  question: string;
  options: string[];      // 4 options
  answer: string;         // A/B/C/D
  explanation?: string;
}

// Fill in the blank question
export interface FIBQuestion {
  id: string;
  type: 'fib';
  question: string;       // With ___ placeholder
  answer: string;         // Correct answer
  explanation?: string;
}

// Union type for all question types
export type Question = MCQQuestion | FIBQuestion;

// Knowledge point extracted from document
export interface KnowledgePoint {
  id: string;
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
}

// Complete quiz
export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  knowledgePoints?: KnowledgePoint[];
  createdAt: string;
}

// User's answer to a question
export interface UserAnswer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
}

// Quiz result after completion
export interface QuizResult {
  quizId: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;          // Percentage (0-100)
  answers: UserAnswer[];
  aiComment?: string;     // AI-generated feedback
  completedAt: string;
}

// Quiz state for UI
export type QuizState = 'idle' | 'loading' | 'ready' | 'in_progress' | 'completed';

// Tool call argument types
export interface ExtractKnowledgeArgs {
  document_content: string;
  focus_areas?: string[];
}

export interface GenerateQuizArgs {
  knowledge_points: KnowledgePoint[];
  question_count?: number;
  question_types?: QuestionType[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

// API request/response types
export interface GenerateQuizRequest {
  documentId: string;
  documentContent: string;
  questionCount?: number;
  questionTypes?: QuestionType[];
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'zh' | 'en';
}

export interface GenerateQuizResponse {
  success: boolean;
  quiz?: Quiz;
  error?: string;
}

export interface EvaluateQuizRequest {
  quizId: string;
  answers: UserAnswer[];
  questions: Question[];
  language?: 'zh' | 'en';
}

export interface EvaluateQuizResponse {
  success: boolean;
  result?: QuizResult;
  error?: string;
}
