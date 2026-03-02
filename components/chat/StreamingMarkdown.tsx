'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/chat/sanitize-html';

const LOG_TAG = '[StreamingMarkdown]';
const DEBUG = true;

function log(...args: unknown[]) {
  if (DEBUG) console.log(LOG_TAG, ...args);
}

interface StreamingMarkdownProps {
  /** The full content received from backend (accumulated) */
  content: string;
  /** Is content still being streamed? */
  isStreaming: boolean;
  /** Speed: 1=slow, 5=normal, 10=instant (default: 5) */
  speed?: number;
  /** Document ID for disk:: URL transformation */
  documentId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when typing completes */
  onComplete?: () => void;
}

// Collapse 3+ consecutive blank lines into 2 to avoid huge gaps during streaming
function normalizeNewlines(text: string): string {
  // Treat lines containing only whitespace as blank lines
  // e.g. "\n   \n\n" -> two newlines
  return text
    .replace(/(\n[ \t]*){3,}/g, '\n\n')
    .replace(/\n{3,}$/g, '\n\n');
}

/**
 * StreamingMarkdown - Smooth typewriter effect with adaptive speed
 *
 * Algorithm:
 * - Uses requestAnimationFrame for smooth 60fps updates
 * - Adaptive speed: faster when more content is buffered
 * - Minimum display rate ensures smooth appearance even with slow backend
 */
export function StreamingMarkdown({
  content,
  isStreaming,
  speed = 5,
  documentId,
  className,
  onComplete,
}: StreamingMarkdownProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [html, setHtml] = useState('');

  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const displayedLenRef = useRef<number>(0);
  const isCompleteRef = useRef(false);
  const statsRef = useRef({ startTime: 0, frames: 0 });

  // Reset when content is cleared
  useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      setHtml('');
      displayedLenRef.current = 0;
      isCompleteRef.current = false;
      statsRef.current = { startTime: 0, frames: 0 };
      return;
    }
  }, [content]);

  // Animation loop
  useEffect(() => {
    if (!content) return;

    // Start timer
    if (statsRef.current.startTime === 0) {
      statsRef.current.startTime = Date.now();
      log('🚀 Animation started');
    }

    let running = true;

    const animate = (timestamp: number) => {
      if (!running) return;

      const targetLen = content.length;
      const currentLen = displayedLenRef.current;

      // If we've caught up and streaming is done
      if (currentLen >= targetLen) {
        if (!isStreaming && !isCompleteRef.current) {
          isCompleteRef.current = true;
          const duration = Date.now() - statsRef.current.startTime;
          log('✅ Complete', {
            duration: `${duration}ms`,
            totalChars: targetLen,
            frames: statsRef.current.frames,
            avgSpeed: `${Math.round(targetLen / (duration / 1000))} chars/sec`,
          });
          onComplete?.();
        }
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate adaptive speed based on user setting
      // speed: 1=slow(1char), 5=normal(3chars), 10=instant(all)
      const buffer = targetLen - currentLen;
      const elapsed = timestamp - lastUpdateRef.current;

      // If speed is 10 (instant), show everything immediately
      if (speed >= 10) {
        displayedLenRef.current = targetLen;
        setDisplayedContent(normalizeNewlines(content));
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Update at least every 16ms (60fps) for smooth animation
      const minInterval = 16;

      if (elapsed >= minInterval) {
        lastUpdateRef.current = timestamp;
        statsRef.current.frames++;

        // Speed calculation: 1-10 scale
        // speed 1: 1 char per 3 frames (very slow)
        // speed 5: 1-3 chars per frame (normal)
        // speed 9: 5-15 chars per frame (fast)
        const speedFactor = speed / 5; // 0.2 to 1.8

        // Base chars per frame from speed setting
        const baseChars = Math.max(1, Math.round(speedFactor * 2));

        // Adaptive: speed up when buffer is large
        let charsToAdd = baseChars;
        if (buffer > 100) {
          charsToAdd = Math.min(baseChars * 4, Math.ceil(buffer / 30));
        } else if (buffer > 50) {
          charsToAdd = Math.min(baseChars * 2, Math.ceil(buffer / 25));
        } else if (buffer > 20) {
          charsToAdd = baseChars + 1;
        }

        // For slow speed (1-2), skip frames to slow down
        if (speed <= 2 && statsRef.current.frames % 3 !== 0) {
          charsToAdd = 0;
        } else if (speed <= 4 && statsRef.current.frames % 2 !== 0) {
          charsToAdd = 0;
        }

        if (charsToAdd > 0) {
          const newLen = Math.min(currentLen + charsToAdd, targetLen);
          const rawContent = content.slice(0, newLen);
          const newContent = normalizeNewlines(rawContent);

          displayedLenRef.current = newLen;
          setDisplayedContent(newContent);

          // Log every 20 frames
          if (statsRef.current.frames % 20 === 0) {
            log('⌨️ Typewriter', {
              displayed: newLen,
              target: targetLen,
              buffer,
              speedSetting: speed,
              charsPerFrame: charsToAdd,
              progress: `${Math.round((newLen / targetLen) * 100)}%`,
            });
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [content, isStreaming, speed, onComplete]);

  // Render Markdown when displayed content changes
  useEffect(() => {
    if (!displayedContent) {
      setHtml('');
      return;
    }

    let cancelled = false;
    const parseStart = Date.now();

    (async () => {
      try {
        const transformedContent = documentId
          ? transformDiskUrls(displayedContent, documentId)
          : displayedContent;

        const out = await marked.parse(transformedContent, { breaks: true, gfm: true });
        const parseTime = Date.now() - parseStart;

        if (!cancelled) {
          setHtml(sanitizeHtml(typeof out === 'string' ? out : ''));

          if (statsRef.current.frames % 30 === 0) {
            log('📝 Markdown parsed', {
              contentLen: displayedContent.length,
              parseTime: `${parseTime}ms`,
            });
          }
        }
      } catch (err) {
        console.error(LOG_TAG, 'Parse error:', err);
        if (!cancelled) setHtml('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayedContent, documentId]);

  // Show cursor during streaming or when catching up
  const showCursor = isStreaming || displayedContent.length < content.length;

  return (
    <div className={cn('streaming-markdown', className)}>
      {html ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap
            prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span className="whitespace-pre-wrap break-words">{displayedContent}</span>
      )}
      {showCursor && (
        <span className="inline-block w-0.5 h-[1.1em] ml-0.5 bg-current align-middle animate-[blink_1s_step-end_infinite]" />
      )}
    </div>
  );
}

/**
 * Transform disk:: URLs to proxy URLs
 */
function transformDiskUrls(content: string, documentId: string): string {
  return content.replace(
    /!\[([^\]]*)\]\(disk::([^)]+)\)/g,
    (match, alt, path) => {
      const proxyUrl = `/api/images/proxy?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}`;
      return `![${alt}](${proxyUrl})`;
    }
  );
}

export default StreamingMarkdown;
