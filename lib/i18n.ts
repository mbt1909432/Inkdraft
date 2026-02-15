/**
 * i18n: load messages and resolve nested keys.
 */

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
 */
export function getByPath(obj: unknown, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}
