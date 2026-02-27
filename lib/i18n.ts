/**
 * i18n: load messages and resolve nested keys.
 */

import { cache } from 'react';

export type Locale = 'zh' | 'en';

export type Messages = Record<string, unknown>;

const COOKIE_NAME = 'NEXT_LOCALE';

export function getLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return 'zh';
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : '';
  return value === 'en' ? 'en' : 'zh';
}

export function setLocaleCookie(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=${locale};path=/;max-age=31536000`;
}

/**
 * Get value at path (e.g. "home.hero.tagline") from a nested object.
 * Uses React.cache for per-request deduplication on server, and
 * a module-level cache for client-side lookups.
 */

// Client-side cache for translation lookups
const clientCache = new Map<string, string | undefined>();

function getByPathUncached(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

// Server-side cached version
export const getByPathCached = cache((obj: unknown, path: string, locale: Locale): string | undefined => {
  return getByPathUncached(obj, path);
});

// Client-side cached version
export function getByPath(obj: unknown, path: string, locale?: Locale): string | undefined {
  // Use React.cache on server
  if (typeof window === 'undefined' && locale) {
    return getByPathCached(obj, path, locale);
  }

  // Use module-level cache on client
  const cacheKey = `${locale || 'zh'}:${path}`;
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  const result = getByPathUncached(obj, path);
  clientCache.set(cacheKey, result);

  // Limit cache size to prevent memory issues
  if (clientCache.size > 1000) {
    const firstKey = clientCache.keys().next().value;
    if (firstKey) clientCache.delete(firstKey);
  }

  return result;
}
