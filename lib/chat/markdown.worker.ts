// Web Worker for Markdown parsing
// This runs in a separate thread to avoid blocking the UI

import { marked } from 'marked';

// Configure marked for better performance
marked.setOptions({
  gfm: true,
  breaks: true,
});

self.onmessage = async (e) => {
  const { id, text } = e.data;

  if (!text?.trim()) {
    self.postMessage({ id, html: '' });
    return;
  }

  try {
    const html = await marked.parse(text);
    self.postMessage({ id, html: typeof html === 'string' ? html : '' });
  } catch (err) {
    console.error('[MarkdownWorker] Parse error:', err);
    self.postMessage({ id, html: '', error: String(err) });
  }
};

export {};
