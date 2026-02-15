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
import { uploadImage } from '@/lib/upload-image';

interface MDXEditorCoreProps {
  className?: string;
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  documentId: string;
}

export function MDXEditorCore({
  className,
  content,
  onChange,
  readOnly = false,
  documentId,
}: MDXEditorCoreProps) {
  const editorRef = useRef<MDXEditorMethods>(null);

  // Sync store content into editor when document switches or content is set externally (e.g. draft)
  useEffect(() => {
    if (!editorRef.current) return;
    const value = typeof content === 'string' ? content : '';
    const currentEditorContent = editorRef.current.getMarkdown();
    if (currentEditorContent !== value) {
      editorRef.current.setMarkdown(value);
    }
  }, [documentId, content]);

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
          return uploadImage(file, documentId);
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
        markdown={content}
        onChange={onChange}
        plugins={plugins}
        contentEditableClassName="prose prose-lg dark:prose-invert max-w-none min-h-[500px] px-8 py-6 focus:outline-none"
        readOnly={readOnly}
        className="min-h-full"
      />
    </div>
  );
}
