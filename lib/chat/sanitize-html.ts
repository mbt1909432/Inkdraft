/**
 * Minimal HTML sanitizer for chat message content (marked output).
 * Removes script, iframe, event handlers, and javascript: links.
 */

const FORBIDDEN_TAGS = /<\/?(script|iframe|object|embed|form|input|button|style|link)(\s[^>]*)?>/gi;
const EVENT_ATTRS = /\s+on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_LINKS = /href\s*=\s*["']\s*javascript:[^"']*["']/gi;

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(FORBIDDEN_TAGS, '')
    .replace(EVENT_ATTRS, '')
    .replace(JAVASCRIPT_LINKS, '');
}
