'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuizCard } from './QuizCard';
import { QuizProgress } from './QuizProgress';
import { QuizResults } from './QuizResults';
import type { Quiz, QuizState, UserAnswer, QuizResult, Question } from '@/lib/quiz/types';

interface QuizContainerProps {
  quiz: Quiz;
  onComplete?: (result: QuizResult) => void;
  onRetry?: () => void;
}

export function QuizContainer({ quiz, onComplete, onRetry }: QuizContainerProps) {
  const [state, setState] = useState<QuizState>('ready');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [result, setResult] = useState<QuizResult | null>(null);
  const [viewingAnswers, setViewingAnswers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = quiz.questions[currentIndex];
  const totalQuestions = quiz.questions.length;
  const answeredCount = answers.size;

  const handleStart = () => {
    setState('in_progress');
    setCurrentIndex(0);
    setAnswers(new Map());
    setResult(null);
    setViewingAnswers(false);
  };

  const handleAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, answer);
      return next;
    });
  }, []);

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (answers.size < totalQuestions) {
      // Not all questions answered - could show warning
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/quiz/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          answers: Array.from(answers.entries()).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
          questions: quiz.questions,
          language: 'zh',
        }),
      });

      const data = await response.json();

      if (data.success && data.result) {
        setResult(data.result);
        setState('completed');
        onComplete?.(data.result);
      } else {
        console.error('Failed to evaluate quiz:', data.error);
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setState('ready');
    setCurrentIndex(0);
    setAnswers(new Map());
    setResult(null);
    setViewingAnswers(false);
    onRetry?.();
  };

  const handleViewAnswers = () => {
    setViewingAnswers(true);
    setState('in_progress');
    setCurrentIndex(0);
  };

  // Ready state - show start button
  if (state === 'ready') {
    return (
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">{quiz.title}</CardTitle>
          {quiz.description && (
            <p className="text-sm text-muted-foreground">{quiz.description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span>{totalQuestions} 道题目</span>
            <span>·</span>
            <span>预计 2-3 分钟</span>
          </div>
          <Button className="w-full" onClick={handleStart}>
            <Play className="h-4 w-4 mr-2" />
            开始测验
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Completed state - show results
  if (state === 'completed' && result && !viewingAnswers) {
    return (
      <QuizResults
        result={result}
        questions={quiz.questions}
        onRetry={handleRetry}
        onViewAnswers={handleViewAnswers}
      />
    );
  }

  // In progress state - show question
  const userAnswer = answers.get(currentQuestion.id);
  const userAnswerData = result?.answers.find((a) => a.questionId === currentQuestion.id);
  const showResult = viewingAnswers && !!result;
  const isCorrect = showResult ? userAnswerData?.isCorrect : undefined;
  const allAnswered = answers.size === totalQuestions;

  return (
    <div className="w-full space-y-4">
      <QuizProgress
        current={currentIndex + 1}
        total={totalQuestions}
        answeredCount={answeredCount}
      />

      <QuizCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={totalQuestions}
        onAnswer={handleAnswer}
        userAnswer={userAnswer}
        showResult={showResult}
        isCorrect={isCorrect}
      />

      {/* Show answered status for each question */}
      {!viewingAnswers && (
        <div className="flex gap-1.5 justify-center flex-wrap">
          {quiz.questions.map((q, idx) => {
            const isAnswered = answers.has(q.id);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  'w-8 h-8 rounded-full text-xs font-medium transition-all',
                  isCurrent && 'ring-2 ring-primary ring-offset-2',
                  isAnswered
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          上一题
        </Button>

        {viewingAnswers ? (
          // When viewing answers, show next button or return to results
          currentIndex === totalQuestions - 1 ? (
            <Button
              variant="outline"
              onClick={() => {
                setViewingAnswers(false);
                setState('completed');
              }}
            >
              返回结果
            </Button>
          ) : (
            <Button onClick={handleNext}>
              下一题
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )
        ) : currentIndex === totalQuestions - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            className={!allAnswered ? 'opacity-50' : ''}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            提交答案
            {!allAnswered && ` (${answeredCount}/${totalQuestions})`}
          </Button>
        ) : (
          <Button onClick={handleNext}>
            下一题
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Hint when not all answered */}
      {!allAnswered && !viewingAnswers && currentIndex === totalQuestions - 1 && (
        <p className="text-xs text-center text-muted-foreground">
          请回答所有题目后提交（单选题点击选项，填空题需点击「确认」）
        </p>
      )}
    </div>
  );
}
