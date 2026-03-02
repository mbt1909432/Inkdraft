'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TypewriterOptions {
  /** Characters per frame when speed = 1 (slowest) */
  minCharsPerFrame?: number;
  /** Characters per frame when speed = 10 (fastest) */
  maxCharsPerFrame?: number;
}

const DEFAULT_OPTIONS: Required<TypewriterOptions> = {
  minCharsPerFrame: 1,
  maxCharsPerFrame: 20,
};

/**
 * Custom hook for smooth typewriter effect with buffered content.
 * Uses requestAnimationFrame for smooth 60fps animation.
 *
 * - Content is buffered internally and displayed progressively
 * - Speed control: 1 (slow) to 10 (instant)
 * - Automatically flushes remaining buffer when speed is max
 */
export function useTypewriter(
  incomingContent: string,
  speed: number = 5,
  options: TypewriterOptions = {}
) {
  const { minCharsPerFrame, maxCharsPerFrame } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const [displayedContent, setDisplayedContent] = useState('');
  const bufferRef = useRef('');
  const displayRef = useRef('');
  const speedRef = useRef(speed);
  const rafIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Keep speed ref updated
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Add incoming content to buffer
  useEffect(() => {
    if (incomingContent) {
      bufferRef.current = incomingContent;
    }
  }, [incomingContent]);

  // Process buffer using requestAnimationFrame for smooth animation
  useEffect(() => {
    let running = true;

    const processFrame = (timestamp: number) => {
      if (!running) return;

      const buffer = bufferRef.current;
      const displayed = displayRef.current;

      // If buffer has more content than displayed, show more
      if (buffer.length > displayed.length) {
        // Throttle updates to ~30fps for better performance
        // (updating DOM too frequently can cause jank)
        const elapsed = timestamp - lastUpdateRef.current;

        if (elapsed >= 33) { // ~30fps
          lastUpdateRef.current = timestamp;

          const remaining = buffer.length - displayed.length;

          // Calculate chars to add based on speed (1-10)
          // speed 1 = minCharsPerFrame, speed 10 = maxCharsPerFrame
          const speedFactor = (speedRef.current - 1) / 9; // 0 to 1
          const charsToAdd = Math.ceil(
            minCharsPerFrame + speedFactor * (maxCharsPerFrame - minCharsPerFrame)
          );

          // How many chars we can actually add
          const toAdd = Math.min(charsToAdd, remaining);

          // Update displayed content
          const newDisplayed = buffer.slice(0, displayed.length + toAdd);
          displayRef.current = newDisplayed;
          setDisplayedContent(newDisplayed);
        }
      }

      // Continue animation loop
      rafIdRef.current = requestAnimationFrame(processFrame);
    };

    // Start animation loop
    rafIdRef.current = requestAnimationFrame(processFrame);

    return () => {
      running = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [minCharsPerFrame, maxCharsPerFrame]);

  // Reset when content is cleared
  useEffect(() => {
    if (!incomingContent) {
      bufferRef.current = '';
      displayRef.current = '';
      setDisplayedContent('');
    }
  }, [incomingContent]);

  // Force flush all buffered content
  const flush = useCallback(() => {
    if (bufferRef.current) {
      displayRef.current = bufferRef.current;
      setDisplayedContent(bufferRef.current);
    }
  }, []);

  return {
    displayedContent,
    flush,
    bufferLength: bufferRef.current.length,
    displayedLength: displayRef.current.length,
    isBufferEmpty: bufferRef.current.length === displayRef.current.length,
  };
}

export default useTypewriter;
