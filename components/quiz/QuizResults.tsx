'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, RotateCcw, MessageSquare } from 'lucide-react';
import type { QuizResult, Question } from '@/lib/quiz/types';

interface QuizResultsProps {
  result: QuizResult;
  questions: Question[];
  onRetry?: () => void;
  onViewAnswers?: () => void;
}

export function QuizResults({
  result,
  questions,
  onRetry,
  onViewAnswers,
}: QuizResultsProps) {
  const { score, correctAnswers, totalQuestions, aiComment } = result;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreMessage = (score: number) => {
    if (score === 100) return '满分！太棒了！';
    if (score >= 80) return '优秀！继续保持！';
    if (score >= 60) return '及格，还需努力！';
    return '需要加强学习！';
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">测验完成！</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Display */}
        <div className="text-center space-y-2">
          <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
            {score}%
          </div>
          <div className="text-lg text-muted-foreground">
            {getScoreMessage(score)}
          </div>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{correctAnswers} 正确</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>{totalQuestions - correctAnswers} 错误</span>
            </div>
          </div>
        </div>

        {/* AI Comment */}
        {aiComment && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              AI 评语
            </div>
            <p className="text-sm leading-relaxed">{aiComment}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onViewAnswers && (
            <Button variant="outline" className="flex-1" onClick={onViewAnswers}>
              查看答案
            </Button>
          )}
          {onRetry && (
            <Button className="flex-1" onClick={onRetry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              再试一次
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
