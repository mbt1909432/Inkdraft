'use client';

import { useEffect, useMemo, useRef } from 'react';
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
import { selectionToolbarPlugin } from './selectionToolbarPlugin';
import '@mdxeditor/editor/style.css';
import { uploadImage, diskUrlToProxyUrl, isDiskUrl } from '@/lib/upload-image';

interface MDXEditorCoreProps {
  className?: string;
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  documentId: string;
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
 * Transform proxy URLs back to disk:: URLs for storage
 */
function transformProxyUrlsToDisk(markdown: string, documentId: string): string {
  // Match proxy URLs and convert back to disk::
  const proxyPattern = `/api/images/proxy\\?path=([^&]+)&documentId=${encodeURIComponent(documentId)}`;

  return markdown.replace(
    new RegExp(`!\\[([^\\]]*)\\]\\(${proxyPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
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

  // Transform content for rendering (disk:: -> proxy URLs)
  const renderedContent = useMemo(() => {
    return transformDiskUrlsToProxy(content, documentId);
  }, [content, documentId]);

  // Handle content changes - transform proxy URLs back to disk::
  const handleChange = (markdown: string) => {
    const originalMarkdown = transformProxyUrlsToDisk(markdown, documentId);
    onChange(originalMarkdown);
  };

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
          const url = await uploadImage(file, documentId);
          // If it's a disk URL, convert to proxy URL for rendering
          if (isDiskUrl(url)) {
            return diskUrlToProxyUrl(url, documentId);
          }
          return url;
        },
      }),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'javascript' }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          js: 'JavaScript',
          ts: 'TypeScript',
          tsx: 'TypeScript (React)',
          jsx: 'JavaScript (React)',
          css: 'CSS',
          html: 'HTML',
          json: 'JSON',
          python: 'Python',
          bash: 'Bash',
          markdown: 'Markdown',
          sql: 'SQL',
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
    <div className={`markdown-editor-wrapper ${className}`}>
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
