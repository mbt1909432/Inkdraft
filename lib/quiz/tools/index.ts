/**
 * Quiz-related OpenAI function calling tools
 */

import type OpenAI from 'openai';
import type { KnowledgePoint, Question, Quiz } from '../types';

// Tool schema for outputting quiz
export const OUTPUT_QUIZ_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'output_quiz',
    description:
      'Output the generated quiz with questions. Call this when you have finished generating quiz questions based on the document content.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the quiz (e.g., "文档知识点检测" or "Document Knowledge Check")',
        },
        description: {
          type: 'string',
          description: 'Optional description of what the quiz covers',
        },
        knowledge_points: {
          type: 'array',
          description: 'Key knowledge points extracted from the document',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the knowledge point',
              },
              title: {
                type: 'string',
                description: 'Title or label of the knowledge point',
              },
              content: {
                type: 'string',
                description: 'Description of the knowledge point',
              },
              importance: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                description: 'Importance level of this knowledge point',
              },
            },
            required: ['id', 'title', 'content', 'importance'],
          },
        },
        questions: {
          type: 'array',
          description: 'Array of quiz questions',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for the question (e.g., "q1", "q2")',
              },
              type: {
                type: 'string',
                enum: ['mcq', 'fib'],
                description: 'Type of question: mcq (multiple choice) or fib (fill in the blank)',
              },
              question: {
                type: 'string',
                description: 'The question text. For fill-in-blank, use ___ for blanks',
              },
              options: {
                type: 'array',
                description: 'Array of 4 options for MCQ questions (only for type: mcq)',
                items: {
                  type: 'string',
                },
              },
              answer: {
                type: 'string',
                description: 'The correct answer: A/B/C/D for MCQ, or the exact answer text for FIB',
              },
              explanation: {
                type: 'string',
                description: 'Brief explanation of why the answer is correct',
              },
            },
            required: ['id', 'type', 'question', 'answer'],
          },
        },
      },
      required: ['title', 'questions'],
    },
  },
};

export function getQuizToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [OUTPUT_QUIZ_SCHEMA];
}

// Type for the output_quiz tool arguments
export interface OutputQuizArgs {
  title: string;
  description?: string;
  knowledge_points?: Array<{
    id: string;
    title: string;
    content: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  questions: Array<{
    id: string;
    type: 'mcq' | 'fib';
    question: string;
    options?: string[];
    answer: string;
    explanation?: string;
  }>;
}

// Parse quiz from tool call arguments
export function parseQuizFromArgs(args: OutputQuizArgs): Quiz {
  const quizId = `quiz_${Date.now()}`;

  const questions: Question[] = args.questions.map((q) => {
    if (q.type === 'mcq') {
      return {
        id: q.id,
        type: 'mcq',
        question: q.question,
        options: q.options || ['', '', '', ''],
        answer: q.answer,
        explanation: q.explanation,
      };
    } else {
      return {
        id: q.id,
        type: 'fib',
        question: q.question,
        answer: q.answer,
        explanation: q.explanation,
      };
    }
  });

  const knowledgePoints: KnowledgePoint[] | undefined = args.knowledge_points?.map((kp) => ({
    id: kp.id,
    title: kp.title,
    content: kp.content,
    importance: kp.importance,
  }));

  return {
    id: quizId,
    title: args.title,
    description: args.description,
    questions,
    knowledgePoints,
    createdAt: new Date().toISOString(),
  };
}
