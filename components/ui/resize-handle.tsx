'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  onResize: (deltaPx: number) => void;
  className?: string;
  /** 'right' = drag right increases left panel; 'left' = drag left increases right panel */
  direction?: 'left' | 'right';
}

export function ResizeHandle({
  onResize,
  className,
  direction = 'right',
}: ResizeHandleProps) {
  const startX = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX.current;
      startX.current = moveEvent.clientX;
      const sign = direction === 'right' ? 1 : -1;
      onResizeRef.current(delta * sign);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize"
      onMouseDown={handleMouseDown}
      className={cn(
        'w-1 shrink-0 cursor-col-resize touch-none relative',
        'bg-border hover:bg-primary/20 active:bg-primary/30',
        'transition-colors flex items-center justify-center',
        'group',
        className
      )}
    >
      <span
        className="w-0.5 h-8 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </div>
  );
}
