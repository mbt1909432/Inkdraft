'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, SpellCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypoSuggestion {
  original: string;
  suggestions: string[];
  message: string;
  offset: number;
  length: number;
}

interface TypoCheckerProps {
  text: string;
  onApplyCorrection: (correctedText: string) => void;
  className?: string;
}

export function TypoChecker({ text, onApplyCorrection, className }: TypoCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [typos, setTypos] = useState<TypoSuggestion[]>([]);
  const [activeTypo, setActiveTypo] = useState<TypoSuggestion | null>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const checkForTypos = useCallback(async () => {
    if (!text.trim()) {
      setTypos([]);
      return;
    }

    setIsChecking(true);
    try {
      const response = await fetch('/api/ai/typo-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        const data = await response.json();
        setTypos(data.typos || []);
      }
    } catch (error) {
      console.error('Error checking typos:', error);
    } finally {
      setIsChecking(false);
    }
  }, [text]);

  const handleApplyCorrection = (typo: TypoSuggestion, suggestion: string) => {
    const correctedText =
      text.slice(0, typo.offset) +
      suggestion +
      text.slice(typo.offset + typo.length);
    onApplyCorrection(correctedText);
    setTypos((prev) => prev.filter((t) => t.offset !== typo.offset));
    setActiveTypo(null);
  };

  const handleTypoClick = (typo: TypoSuggestion, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setPopupPosition({
      top: rect.bottom + 5,
      left: rect.left,
    });
    setActiveTypo(typo);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setActiveTypo(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={checkForTypos}
        disabled={isChecking}
        title="Check for typos"
      >
        {isChecking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SpellCheck className="h-4 w-4" />
        )}
        <span className="ml-1 hidden sm:inline">Check</span>
        {typos.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
            {typos.length}
          </span>
        )}
      </Button>

      {/* Typo suggestions popup */}
      {activeTypo && (
        <div
          className="typo-suggestion-popup animate-fade-in"
          style={{
            position: 'fixed',
            top: popupPosition.top,
            left: popupPosition.left,
            zIndex: 100,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {activeTypo.message}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setActiveTypo(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {activeTypo.suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="typo-suggestion-item w-full text-left"
                onClick={() => handleApplyCorrection(activeTypo, suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Text highlighter component for displaying typos in text
interface TypoHighlighterProps {
  text: string;
  typos: TypoSuggestion[];
  onTypoClick: (typo: TypoSuggestion, event: React.MouseEvent) => void;
}

export function TypoHighlighter({ text, typos, onTypoClick }: TypoHighlighterProps) {
  if (typos.length === 0) {
    return <span>{text}</span>;
  }

  // Sort typos by offset
  const sortedTypos = [...typos].sort((a, b) => a.offset - b.offset);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedTypos.forEach((typo, index) => {
    // Add text before typo
    if (typo.offset > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>
          {text.slice(lastIndex, typo.offset)}
        </span>
      );
    }

    // Add highlighted typo
    parts.push(
      <span
        key={`typo-${index}`}
        className="typo-highlight"
        onClick={(e) => onTypoClick(typo, e)}
      >
        {text.slice(typo.offset, typo.offset + typo.length)}
      </span>
    );

    lastIndex = typo.offset + typo.length;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}
