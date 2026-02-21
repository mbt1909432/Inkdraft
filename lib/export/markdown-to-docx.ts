/**
 * Client: trigger Word download via server API (images work reliably in Node).
 * PDF remains client-side.
 */

import { resolveImageUrlsForExport } from './resolve-image-urls';

export async function downloadAsWord(markdown: string, filename: string, documentId?: string): Promise<void> {
  const title = filename.endsWith('.docx') ? filename.slice(0, -5) : filename;

  // Resolve disk:: and proxy URLs to public URLs before export
  let resolvedMarkdown = markdown;
  if (documentId) {
    try {
      resolvedMarkdown = await resolveImageUrlsForExport(markdown, documentId);
    } catch (error) {
      console.warn('[downloadAsWord] Failed to resolve image URLs:', error);
    }
  }

  const res = await fetch('/api/export/word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content: resolvedMarkdown }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = title.endsWith('.docx') ? title : `${title}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
