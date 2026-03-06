/**
 * API route for evaluating quiz answers and generating AI feedback
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig } from '@/lib/llm/config';
import { getEvaluationSystemPrompt } from '@/lib/quiz/prompts';
import type {
  Question,
  UserAnswer,
  QuizResult,
  EvaluateQuizRequest,
  EvaluateQuizResponse,
} from '@/lib/quiz/types';

const LOG_TAG = '[api/quiz/evaluate]';

function checkAnswer(question: Question, userAnswer: string): boolean {
  if (question.type === 'mcq') {
    // MCQ: Compare answer letter (A/B/C/D)
    return question.answer.toUpperCase() === userAnswer.toUpperCase();
  } else {
    // FIB: Case-insensitive comparison, trim whitespace
    const correctAnswer = question.answer.toLowerCase().trim();
    const submittedAnswer = userAnswer.toLowerCase().trim();
    return correctAnswer === submittedAnswer;
  }
}

function buildEvaluationPrompt(
  questions: Question[],
  answers: UserAnswer[],
  score: number,
  language: 'zh' | 'en'
): string {
  const resultDetails = questions.map((q, idx) => {
    const userAnswer = answers.find((a) => a.questionId === q.id);
    const isCorrect = userAnswer?.isCorrect ?? false;

    if (language === 'zh') {
      return `题目 ${idx + 1}: ${q.question}
用户答案: ${userAnswer?.answer ?? '未作答'}
正确答案: ${q.answer}
结果: ${isCorrect ? '✓ 正确' : '✗ 错误'}
${q.explanation ? `解析: ${q.explanation}` : ''}`;
    } else {
      return `Question ${idx + 1}: ${q.question}
User answer: ${userAnswer?.answer ?? 'Not answered'}
Correct answer: ${q.answer}
Result: ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
${q.explanation ? `Explanation: ${q.explanation}` : ''}`;
    }
  }).join('\n\n');

  if (language === 'zh') {
    return `请根据以下测验结果生成个性化评语。

总分: ${score}%
正确: ${answers.filter((a) => a.isCorrect).length}/${questions.length}

详细结果:
${resultDetails}

请生成一段 100-200 字的评语，包括：
1. 对整体表现的总结
2. 指出掌握较好的知识点
3. 指出需要加强的地方
4. 提供具体的学习建议`;
  } else {
    return `Please generate personalized feedback based on the following quiz results.

Score: ${score}%
Correct: ${answers.filter((a) => a.isCorrect).length}/${questions.length}

Detailed results:
${resultDetails}

Please generate a 100-200 word feedback including:
1. Summary of overall performance
2. Well-mastered knowledge points
3. Areas that need improvement
4. Specific learning suggestions`;
  }
}

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn(LOG_TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as EvaluateQuizRequest;

    if (!body.quizId || !Array.isArray(body.answers) || !Array.isArray(body.questions)) {
      return NextResponse.json(
        { error: 'quizId, answers, and questions are required' },
        { status: 400 }
      );
    }

    const language = body.language ?? 'zh';

    console.log(LOG_TAG, 'Request', {
      quizId: body.quizId,
      answerCount: body.answers.length,
      questionCount: body.questions.length,
      language,
    });

    // Check each answer
    const evaluatedAnswers: UserAnswer[] = body.answers.map((answer) => {
      const question = body.questions.find((q) => q.id === answer.questionId);
      if (!question) {
        return { ...answer, isCorrect: false };
      }
      return {
        ...answer,
        isCorrect: checkAnswer(question, answer.answer),
      };
    });

    const correctCount = evaluatedAnswers.filter((a) => a.isCorrect).length;
    const totalQuestions = body.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    // Generate AI feedback if score is not 100%
    let aiComment: string | undefined;

    if (score < 100) {
      try {
        const config = getLLMConfig();
        const client = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.endpoint,
        });

        const systemPrompt = getEvaluationSystemPrompt(language);
        const userPrompt = buildEvaluationPrompt(
          body.questions,
          evaluatedAnswers,
          score,
          language
        );

        const completion = await client.chat.completions.create({
          model: config.model ?? 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        aiComment = completion.choices[0]?.message?.content ?? undefined;
      } catch (err) {
        console.warn(LOG_TAG, 'Failed to generate AI comment', { error: err });
        // Continue without AI comment
      }
    } else {
      // Perfect score - simple congratulation message
      aiComment =
        language === 'zh'
          ? '太棒了！你完美地掌握了这篇文档的所有知识点！继续保持这种学习状态。'
          : 'Excellent! You have perfectly mastered all the knowledge points in this document! Keep up the great work.';
    }

    const result: QuizResult = {
      quizId: body.quizId,
      totalQuestions,
      correctAnswers: correctCount,
      score,
      answers: evaluatedAnswers,
      aiComment,
      completedAt: new Date().toISOString(),
    };

    const duration = Date.now() - start;
    console.log(LOG_TAG, 'Success', {
      durationMs: duration,
      score,
      correctCount,
    });

    const response: EvaluateQuizResponse = {
      success: true,
      result,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isConfig =
      message.includes('OPENAI_LLM_') || message.includes('is not set');
    console.error(LOG_TAG, 'Error', { error: message, durationMs: Date.now() - start });
    return NextResponse.json(
      {
        success: false,
        error: isConfig
          ? 'LLM not configured. Set OPENAI_LLM_* in .env.local.'
          : message,
      },
      { status: isConfig ? 503 : 500 }
    );
  }
}
