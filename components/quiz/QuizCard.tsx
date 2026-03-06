'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import type { MCQQuestion, FIBQuestion, Question } from '@/lib/quiz/types';

interface QuizCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (questionId: string, answer: string) => void;
  userAnswer?: string;
  showResult?: boolean;
  isCorrect?: boolean;
}

export function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  userAnswer,
  showResult = false,
  isCorrect,
}: QuizCardProps) {
  const [fibAnswer, setFibAnswer] = useState(userAnswer ?? '');

  // Sync fibAnswer with userAnswer when question changes
  useEffect(() => {
    setFibAnswer(userAnswer ?? '');
  }, [question.id, userAnswer]);

  const handleMCQSelect = (option: string) => {
    if (!showResult) {
      onAnswer(question.id, option);
    }
  };

  const handleFIBSubmit = () => {
    if (fibAnswer.trim() && !showResult) {
      onAnswer(question.id, fibAnswer.trim());
    }
  };

  if (question.type === 'mcq') {
    const mcqQuestion = question as MCQQuestion;
    const options = ['A', 'B', 'C', 'D'];

    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {questionNumber} / {totalQuestions}
            </span>
            {showResult && (
              <span className="flex items-center gap-1">
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </span>
            )}
          </div>
          <CardTitle className="text-base leading-relaxed">
            {mcqQuestion.question}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {options.map((letter, idx) => {
            const optionText = mcqQuestion.options[idx];
            const isSelected = userAnswer === letter;
            const isCorrectAnswer = mcqQuestion.answer === letter;

            let optionStyle = 'border-border hover:border-primary/50 hover:bg-primary/5';

            if (showResult) {
              if (isCorrectAnswer) {
                optionStyle = 'border-green-500 bg-green-50 dark:bg-green-950/30';
              } else if (isSelected && !isCorrect) {
                optionStyle = 'border-red-500 bg-red-50 dark:bg-red-950/30';
              }
            } else if (isSelected) {
              optionStyle = 'border-primary bg-primary/10';
            }

            return (
              <button
                key={letter}
                onClick={() => handleMCQSelect(letter)}
                disabled={showResult}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  'flex items-start gap-3',
                  optionStyle,
                  showResult && 'cursor-default'
                )}
              >
                <span className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-sm font-medium',
                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
                )}>
                  {letter}
                </span>
                <span className="text-sm leading-relaxed">{optionText}</span>
              </button>
            );
          })}
          {showResult && mcqQuestion.explanation && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
              <span className="font-medium">解析：</span>
              {mcqQuestion.explanation}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fill in the blank question
  const fibQuestion = question as FIBQuestion;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {questionNumber} / {totalQuestions}
          </span>
          {showResult && (
            <span className="flex items-center gap-1">
              {isCorrect ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </span>
          )}
        </div>
        <CardTitle className="text-base leading-relaxed">
          {fibQuestion.question}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={fibAnswer}
            onChange={(e) => setFibAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFIBSubmit()}
            disabled={showResult}
            placeholder="输入答案..."
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border bg-background text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              showResult && !isCorrect && userAnswer
                ? 'border-red-500'
                : showResult && isCorrect
                  ? 'border-green-500'
                  : 'border-input'
            )}
          />
          {!showResult && (
            <Button onClick={handleFIBSubmit} disabled={!fibAnswer.trim()}>
              确认
            </Button>
          )}
        </div>
        {showResult && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">正确答案：</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {fibQuestion.answer}
              </span>
            </div>
            {fibQuestion.explanation && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <span className="font-medium">解析：</span>
                {fibQuestion.explanation}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
