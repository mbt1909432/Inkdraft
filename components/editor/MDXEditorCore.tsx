'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  DiffSourceToggleWrapper,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  ListsToggle,
  UndoRedo,
  Separator,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import { toast } from 'sonner';
import { selectionToolbarPlugin } from './selectionToolbarPlugin';
import '@mdxeditor/editor/style.css';
import { uploadImage, diskUrlToProxyUrl, isDiskUrl } from '@/lib/upload-image';
import { unescapeMarkdown } from '@/lib/unescape-markdown';

interface MDXEditorCoreProps {
  className?: string;
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  documentId: string;
}

/**
 * Check if text contains markdown syntax patterns
 */
function containsMarkdownSyntax(text: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+.+$/m,           // Headings: # ## ### etc.
    /^\s*[-*+]\s+.+$/m,         // Unordered lists
    /^\s*\d+\.\s+.+$/m,         // Ordered lists
    /\*\*.+?\*\*/,              // Bold
    /\*.+?\*/,                  // Italic (single asterisk)
    /__.+?__/,                  // Bold (underscore)
    /_.+?_/,                    // Italic (underscore)
    /`[^`]+`/,                  // Inline code
    /^```/m,                    // Code block
    /\[.+?\]\(.+?\)/,           // Links
    /!\[.*?\]\(.+?\)/,          // Images
    /^>\s+.+$/m,                // Blockquotes
    /^---+$/m,                  // Horizontal rules
    /^\|.+\|$/m,                // Tables
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Transform disk:: URLs to proxy URLs for rendering
 */
function transformDiskUrlsToProxy(markdown: string, documentId: string): string {
  // Match markdown image syntax: ![alt](disk::path)
  return markdown.replace(
    /!\[([^\]]*)\]\(disk::([^)]+)\)/g,
    (match, alt, path) => {
      const proxyUrl = `/api/images/proxy?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}`;
      return `![${alt}](${proxyUrl})`;
    }
  );
}

/**
 * Normalize code block language identifiers
 * Convert unsupported languages to supported equivalents
 */
function normalizeCodeBlockLanguages(markdown: string): string {
  return markdown.replace(/```(\w+)\n/g, (match, lang) => {
    // Map unsupported languages to supported equivalents
    const languageMap: Record<string, string> = {
      'text': 'markdown',
      'plaintext': 'markdown',
      'textfile': 'markdown',
      'jsonc': 'json',  // JSON with comments → plain JSON
    };
    const normalizedLang = languageMap[lang.toLowerCase()] || lang;
    return '```' + normalizedLang + '\n';
  });
}

/**
 * Transform proxy URLs back to disk:: URLs for storage
 */
function transformProxyUrlsToDisk(markdown: string, documentId: string): string {
  // Match proxy URLs and convert back to disk::
  // Handle both & and \& (MDXEditor may escape the ampersand)
  const escapedDocId = encodeURIComponent(documentId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const proxyPattern = `/api/images/proxy\\?path=([^&\\\\]+)(?:\\\\)?&documentId=${escapedDocId}`;

  return markdown.replace(
    new RegExp(`!\\[([^\\]]*)\\]\\(${proxyPattern}\\)`, 'g'),
    (match, alt, encodedPath) => {
      const path = decodeURIComponent(encodedPath);
      return `![${alt}](disk::${path})`;
    }
  );
}

export function MDXEditorCore({
  className,
  content,
  onChange,
  readOnly = false,
  documentId,
}: MDXEditorCoreProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isProcessingPaste = useRef(false);

  // Transform content for rendering (disk:: -> proxy URLs, normalize languages)
  const renderedContent = useMemo(() => {
    let transformed = transformDiskUrlsToProxy(content, documentId);
    transformed = normalizeCodeBlockLanguages(transformed);
    return transformed;
  }, [content, documentId]);

  // Handle content changes - transform proxy URLs back to disk:: and unescape HTML entities
  const handleChange = (markdown: string) => {
    // Skip if we're processing a paste to avoid double conversion
    if (isProcessingPaste.current) return;
    // MDXEditor may produce HTML entities like &#x20; for spaces in tables/code blocks
    const unescapedMarkdown = unescapeMarkdown(markdown);
    const originalMarkdown = transformProxyUrlsToDisk(unescapedMarkdown, documentId);
    onChange(originalMarkdown);
  };

  // Handle paste event to convert markdown syntax
  useEffect(() => {
    const container = containerRef.current;
    if (!container || readOnly) return;

    const handlePaste = async (e: Event) => {
      const clipboardEvent = e as ClipboardEvent;
      const pastedText = clipboardEvent.clipboardData?.getData('text/plain');
      if (!pastedText || !containsMarkdownSyntax(pastedText)) return;

      // Let the paste happen normally first, then re-parse
      // Wait for the paste to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the current markdown (which now includes pasted text as raw text)
      const currentMarkdown = editorRef.current?.getMarkdown() || '';

      // Re-set to trigger markdown parsing
      isProcessingPaste.current = true;
      editorRef.current?.setMarkdown(currentMarkdown);

      // Reset flag after a short delay
      setTimeout(() => {
        isProcessingPaste.current = false;
      }, 100);
    };

    // Find the content editable element
    const contentEditable = container.querySelector('[contenteditable="true"]');
    if (contentEditable) {
      contentEditable.addEventListener('paste', handlePaste);
      return () => contentEditable.removeEventListener('paste', handlePaste);
    }
  }, [readOnly]);

  // Sync store content into editor when document switches or content is set externally (e.g. draft)
  useEffect(() => {
    if (!editorRef.current) return;
    const value = typeof renderedContent === 'string' ? renderedContent : '';
    const currentEditorContent = editorRef.current.getMarkdown();
    // Compare transformed content
    const currentOriginal = transformProxyUrlsToDisk(currentEditorContent, documentId);
    if (currentOriginal !== content) {
      editorRef.current.setMarkdown(value);
    }
  }, [documentId, content, renderedContent]);

  // Plugins configuration - memoized to prevent recreation
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({
        imageUploadHandler: async (file: File) => {
          const toastId = toast.loading('正在上传图片...');
          try {
            const url = await uploadImage(file, documentId);
            // If it's a disk URL, convert to proxy URL for rendering
            if (isDiskUrl(url)) {
              toast.success('图片上传成功', { id: toastId });
              return diskUrlToProxyUrl(url, documentId);
            }
            toast.success('图片上传成功', { id: toastId });
            return url;
          } catch (error) {
            toast.error('图片上传失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
            throw error;
          }
        },
      }),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'markdown' }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          text: 'Plain Text',
          plaintext: 'Plain Text',
          markdown: 'Markdown',
          js: 'JavaScript',
          javascript: 'JavaScript',
          ts: 'TypeScript',
          typescript: 'TypeScript',
          tsx: 'TypeScript (React)',
          jsx: 'JavaScript (React)',
          css: 'CSS',
          html: 'HTML',
          json: 'JSON',
          python: 'Python',
          py: 'Python',
          bash: 'Bash',
          shell: 'Shell',
          sh: 'Shell',
          sql: 'SQL',
          yaml: 'YAML',
          yml: 'YAML',
          xml: 'XML',
          java: 'Java',
          go: 'Go',
          rust: 'Rust',
          c: 'C',
          cpp: 'C++',
        },
      }),
      diffSourcePlugin({ viewMode: 'rich-text' }),
      selectionToolbarPlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={['rich-text', 'source']}>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <Separator />
            <BoldItalicUnderlineToggles />
            <Separator />
            <ListsToggle />
            <Separator />
            <CreateLink />
            <InsertImage />
            <Separator />
            <InsertTable />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [documentId]
  );

  return (
    <div ref={containerRef} className={`markdown-editor-wrapper ${className}`}>
      <MDXEditor
        ref={editorRef}
        markdown={renderedContent}
        onChange={handleChange}
        plugins={plugins}
        contentEditableClassName="prose prose-lg dark:prose-invert max-w-none min-h-[500px] px-8 py-6 focus:outline-none"
        readOnly={readOnly}
        className="min-h-full"
      />
    </div>
  );
}
