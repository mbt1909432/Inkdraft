/**
 * Unescape markdown that was over-escaped (e.g. by LLM returning \- \*\* instead of - **).
 * Normalize so headings are on their own line (## / ### only render when at line start).
 */
export function unescapeMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let out = text
    .replace(/\\-/g, '-')
    .replace(/\\\*/g, '*')
    .replace(/\\#/g, '#')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/&#x20;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  // 标题（## / ###）必须单独成行：句号/问号等后紧跟 # 时，前面加空行
  out = out.replace(/([。！？.!?])(\s*)(#{1,6}\s)/g, '$1\n\n$3');
  return out;
}
