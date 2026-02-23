/**
 * Server-only: build Word document from markdown with Buffer for images.
 * Use in API route; Node Packer.toBuffer + Buffer images work reliably.
 */

import {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  Packer,
  HeadingLevel,
  type IParagraphOptions,
} from 'docx';

const PLACEHOLDER_PREFIX = '<<<DOCX_IMG_';
const PLACEHOLDER_SUFFIX = '>>>';
/** 黑色文字（docx 需在 TextRun 上设 color，段落级 run 不生效） */
const BLACK = '000000';
function blackText(text: string): TextRun {
  return new TextRun({ text, color: BLACK });
}

function extractDataUrlImages(markdown: string): { markdownWithoutImages: string; dataUrls: string[] } {
  const dataUrls: string[] = [];
  const re = /!\[[^\]]*\]\((data:image\/(?:png|jpeg|jpg|gif|bmp);base64,[^)]+)\)/gi;
  const markdownWithoutImages = markdown.replace(re, (_, dataUrl) => {
    dataUrls.push(dataUrl);
    return PLACEHOLDER_PREFIX + (dataUrls.length - 1) + PLACEHOLDER_SUFFIX;
  });
  console.log('[markdown-to-docx-server] extractDataUrlImages: dataUrls.length=', dataUrls.length, 'markdown.length=', markdown.length);
  if (dataUrls.length > 0) {
    dataUrls.forEach((u, i) => console.log('[markdown-to-docx-server] dataUrl', i, 'length=', u.length, 'prefix=', u.slice(0, 50)));
  }
  if (markdown.includes('data:image') && dataUrls.length === 0) {
    throw new Error(
      '文档中含有 data:image 图片但未能解析（可能请求体被截断，请尝试缩小图片后重试）'
    );
  }
  return { markdownWithoutImages, dataUrls };
}

const PLACEHOLDER_RE = new RegExp(PLACEHOLDER_PREFIX + '(\\d+)' + PLACEHOLDER_SUFFIX, 'g');
/** 剥离占位符用（含无下划线等变体，避免漏掉） */
const STRIP_PLACEHOLDER_RE = /<<<DOCX_?IMG_?\d*\s*>>>/g;

type ImageType = 'png' | 'jpg' | 'gif' | 'bmp';

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

function getImageTypeFromDataUrl(dataUrl: string): ImageType | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp)/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  return mime === 'jpg' ? 'jpg' : (mime as ImageType);
}

/** Get image dimensions and compute display size.
 *  - Max 400px on longer side for large images (downscale only)
 *  - Keep original size for small images (no upscale)
 *  - Keep aspect ratio
 */
async function getDisplaySize(buffer: Buffer): Promise<{ width: number; height: number }> {
  const DEFAULT = { width: 240, height: 180 };
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) return DEFAULT;

    const max = 400;

    // Only downscale if image is larger than max, don't upscale small images
    if (w <= max && h <= max) {
      // Image is smaller than max, use original size
      return { width: w, height: h };
    }

    // Image is larger than max, scale down proportionally
    if (w >= h) {
      return { width: max, height: Math.round((max * h) / w) };
    }
    return { width: Math.round((max * w) / h), height: max };
  } catch {
    return DEFAULT;
  }
}

/** Decode data URL to Buffer; optionally resize large images so docx can embed them. */
async function dataUrlToBuffer(dataUrl: string): Promise<{ buffer: Buffer; type: ImageType } | null> {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,([\s\S]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const type: ImageType = mime === 'jpg' ? 'jpg' : (mime as ImageType);
  const base64 = match[2].replace(/\s/g, '');
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch (e) {
    console.error('[markdown-to-docx-server] dataUrlToBuffer decode error:', e);
    return null;
  }
  console.log('[markdown-to-docx-server] dataUrlToBuffer: decoded length=', buffer.length, 'type=', type);

  const MAX_EMBED_BYTES = 800 * 1024;
  if (buffer.length <= MAX_EMBED_BYTES) return { buffer, type };

  try {
    const sharp = (await import('sharp')).default;
    const resized = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    console.log('[markdown-to-docx-server] dataUrlToBuffer: resized to', resized.length, 'bytes (jpg)');
    return { buffer: resized, type: 'jpg' };
  } catch (e) {
    console.warn('[markdown-to-docx-server] sharp resize failed, using original:', e);
    return { buffer, type };
  }
}

function splitLineWithPlaceholders(line: string): Array<{ type: 'text'; value: string } | { type: 'image'; index: number }> {
  const segments: Array<{ type: 'text'; value: string } | { type: 'image'; index: number }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(line)) !== null) {
    if (m.index > lastIndex) segments.push({ type: 'text', value: line.slice(lastIndex, m.index) });
    segments.push({ type: 'image', index: parseInt(m[1], 10) });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < line.length) segments.push({ type: 'text', value: line.slice(lastIndex) });
  return segments;
}

function hasImagePlaceholder(segments: ReturnType<typeof splitLineWithPlaceholders>): boolean {
  return segments.some((s) => s.type === 'image');
}

async function parseMarkdownToBlocks(markdownWithoutImages: string, dataUrls: string[]): Promise<IParagraphOptions[]> {
  const blocks: IParagraphOptions[] = [];
  const lines = markdownWithoutImages.split(/\r?\n/);

  const makeImageRun = async (dataUrl: string): Promise<ImageRun | TextRun> => {
    const result = await dataUrlToBuffer(dataUrl);
    if (!result || result.buffer.length === 0) return blackText('[图片]');
    const { width, height } = await getDisplaySize(result.buffer);
    console.log('[markdown-to-docx-server] makeImageRun: embedding type=', result.type, 'buffer=', result.buffer.length, 'display=', width, 'x', height);
    return new ImageRun({
      data: result.buffer,
      type: result.type,
      transformation: { width, height },
    });
  };

  const segmentsToChildren = async (segments: ReturnType<typeof splitLineWithPlaceholders>) => {
    const children: (TextRun | ImageRun)[] = [];
    for (const s of segments) {
      if (s.type === 'text') {
        const t = stripInlineMarkdown(s.value).replace(STRIP_PLACEHOLDER_RE, '').trim();
        if (t) children.push(blackText(t));
        continue;
      }
      const run =
        dataUrls[s.index] != null ? await makeImageRun(dataUrls[s.index]) : blackText('[图片]');
      children.push(run);
    }
    return children;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (line.includes(PLACEHOLDER_PREFIX)) {
      console.log('[markdown-to-docx-server] line', i, 'contains placeholder, length=', line.length);
    }

    if (!trimmed) {
      blocks.push({ children: [new TextRun({ text: '' })], spacing: { after: 120 } });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const headingContent = headingMatch[2].trim();
      const text = stripInlineMarkdown(headingContent).replace(STRIP_PLACEHOLDER_RE, '').trim();
      const headingLevels = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ] as const;
      blocks.push({ children: [blackText(text || ' ')], heading: headingLevels[level - 1], spacing: { after: 240 } });
      // If heading contained image placeholders, emit image paragraphs (heading branch otherwise skips them)
      if (headingContent.includes(PLACEHOLDER_PREFIX)) {
        let m: RegExpExecArray | null;
        PLACEHOLDER_RE.lastIndex = 0;
        while ((m = PLACEHOLDER_RE.exec(headingContent)) !== null) {
          const idx = parseInt(m[1], 10);
          if (dataUrls[idx] != null) {
            const run = await makeImageRun(dataUrls[idx]);
            blocks.push({ children: [run], spacing: { after: 120 } });
          }
        }
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const rest = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');
      const segments = splitLineWithPlaceholders(rest);
      if (!hasImagePlaceholder(segments)) {
        blocks.push({
          children: [blackText(`• ${stripInlineMarkdown(rest).replace(STRIP_PLACEHOLDER_RE, '')}`)],
          indent: { left: 720 },
          spacing: { after: 120 },
        });
      } else {
        const children = await segmentsToChildren(segments);
        blocks.push({
          children: children.length ? children : [blackText('• ')],
          indent: { left: 720 },
          spacing: { after: 120 },
        });
      }
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const rest = trimmed.slice(2);
      const segments = splitLineWithPlaceholders(rest);
      if (!hasImagePlaceholder(segments)) {
        blocks.push({
          children: [blackText(stripInlineMarkdown(rest).replace(STRIP_PLACEHOLDER_RE, ''))],
          indent: { left: 720 },
          spacing: { after: 120 },
        });
      } else {
        const children = await segmentsToChildren(segments);
        blocks.push({
          children: children.length ? children : [blackText(' ')],
          indent: { left: 720 },
          spacing: { after: 120 },
        });
      }
      continue;
    }

    const segments = splitLineWithPlaceholders(trimmed);
    if (!hasImagePlaceholder(segments)) {
      const plain = stripInlineMarkdown(trimmed).replace(STRIP_PLACEHOLDER_RE, '').trim();
      blocks.push({ children: [blackText(plain || ' ')], spacing: { after: 120 } });
      continue;
    }

    console.log('[markdown-to-docx-server] building image block for line', i, 'segments=', segments.length);
    const children = await segmentsToChildren(segments);
    blocks.push({
      children: children.length ? children : [blackText(' ')],
      spacing: { after: 120 },
    });
  }

  return blocks;
}

/** Build docx as Buffer (Node only). Use in API route. */
export async function buildWordBuffer(markdown: string): Promise<Buffer> {
  console.log('[markdown-to-docx-server] buildWordBuffer: markdown.length=', markdown.length);
  const { markdownWithoutImages, dataUrls } = extractDataUrlImages(markdown);
  const hasPlaceholder = markdownWithoutImages.includes(PLACEHOLDER_PREFIX);
  console.log('[markdown-to-docx-server] buildWordBuffer: hasPlaceholder in text=', hasPlaceholder, 'sample=', markdownWithoutImages.slice(0, 200));
  const blocks = await parseMarkdownToBlocks(markdownWithoutImages, dataUrls);
  console.log('[markdown-to-docx-server] buildWordBuffer: blocks=', blocks.length, 'dataUrls=', dataUrls.length);
  const children = blocks.map((opts) => new Paragraph(opts));
  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return (await Packer.toBuffer(doc)) as Buffer;
}
