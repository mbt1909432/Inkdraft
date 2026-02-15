import type { OutlineItem } from '@/lib/types';

export function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split('\n');
  const outline: OutlineItem[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      let text = match[2].trim();
      // 标题里是图片或 data URL 时显示占位，避免大纲里一长串 base64
      if (/!\[.*\]\(.*\)/.test(text) || /^data:image\//i.test(text) || text.length > 120) {
        text = text.startsWith('!') || text.startsWith('data:') ? '[图片]' : text.slice(0, 80) + (text.length > 80 ? '…' : '');
      }
      const id = `heading-${index}-${String(text).toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;
      outline.push({
        id,
        level,
        text,
        line: index + 1,
      });
    }
  });

  return outline;
}

export function scrollToHeading(editorRef: React.RefObject<{ setMarkdown: (md: string) => void } | null>, line: number): void {
  // This will be implemented to scroll to a specific heading in the editor
  const headingElement = document.querySelector(`[data-line="${line}"]`);
  if (headingElement) {
    headingElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
