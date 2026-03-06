'use client';

import { cn } from '@/lib/utils';

interface QuizProgressProps {
  current: number;
  total: number;
  answeredCount: number;
}

export function QuizProgress({ current, total, answeredCount }: QuizProgressProps) {
  const progress = (answeredCount / total) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>进度</span>
        <span>{answeredCount} / {total} 已作答</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {Array.from({ length: total }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              idx + 1 === current
                ? 'bg-primary'
                : idx + 1 < current
                  ? 'bg-primary/60'
                  : 'bg-muted'
            )}
          />
        ))}
      </div>
    </div>
  );
}
