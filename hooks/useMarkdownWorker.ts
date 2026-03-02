'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Singleton worker instance
let workerInstance: Worker | null = null;
let workerRefcount = 0;
let messageId = 0;

// Pending promises waiting for worker response
const pendingCallbacks = new Map<number, { resolve: (html: string) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('@/lib/chat/markdown.worker.ts', import.meta.url)
    );

    workerInstance.onmessage = (e) => {
      const { id, html, error } = e.data;
      const callbacks = pendingCallbacks.get(id);
      if (callbacks) {
        pendingCallbacks.delete(id);
        if (error) {
          callbacks.reject(new Error(error));
        } else {
          callbacks.resolve(html);
        }
      }
    };

    workerInstance.onerror = (e) => {
      console.error('[MarkdownWorker] Worker error:', e);
    };
  }
  workerRefcount++;
  return workerInstance;
}

function releaseWorker() {
  workerRefcount--;
  if (workerRefcount === 0 && workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}

/**
 * Hook for async Markdown parsing with Web Worker
 * - Parses in background thread (doesn't block UI)
 * - Debounced to avoid excessive parsing
 * - Returns plain text during streaming for instant display
 */
export function useMarkdownWorker(
  content: string,
  options: {
    /** Is content still being streamed? If true, shows plain text first */
    isStreaming?: boolean;
    /** Debounce delay in ms (default: 150) */
    debounceMs?: number;
  } = {}
) {
  const { isStreaming = false, debounceMs = 150 } = options;

  const [html, setHtml] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef('');

  // Initialize worker
  useEffect(() => {
    workerRef.current = getWorker();
    return () => {
      releaseWorker();
    };
  }, []);

  // Parse markdown with debounce
  useEffect(() => {
    latestContentRef.current = content;

    // During streaming, don't parse - just show plain text
    if (isStreaming || !content?.trim()) {
      setHtml('');
      setIsParsing(false);
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the parsing
    debounceTimerRef.current = setTimeout(async () => {
      if (!workerRef.current || latestContentRef.current !== content) return;

      setIsParsing(true);
      const id = ++messageId;

      // Create promise for this request
      const parsePromise = new Promise<string>((resolve, reject) => {
        pendingCallbacks.set(id, { resolve, reject });
      });

      // Send to worker
      workerRef.current.postMessage({ id, text: content });

      try {
        // Wait for result with timeout
        const result = await Promise.race([
          parsePromise,
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000)
          ),
        ]);
        setHtml(result);
      } catch (err) {
        console.error('[useMarkdownWorker] Parse failed:', err);
        setHtml(''); // Fallback to plain text
      } finally {
        setIsParsing(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, isStreaming, debounceMs]);

  return { html, isParsing };
}

export default useMarkdownWorker;
