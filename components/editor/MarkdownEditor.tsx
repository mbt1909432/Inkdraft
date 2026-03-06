'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useDocumentStore } from '@/lib/store/document-store';
import { extractOutline } from '@/lib/editor/outline-utils';

// Types
interface MarkdownEditorProps {
  className?: string;
  readOnly?: boolean;
}

// Loading placeholder
function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center text-muted-foreground">
        <p className="text-sm">加载编辑器...</p>
      </div>
    </div>
  );
}

// No document placeholder
function NoDocumentSelected({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center text-muted-foreground">
        <p className="text-lg">No document selected</p>
        <p className="text-sm">Create or select a document to start editing</p>
      </div>
    </div>
  );
}

// Dynamically import the heavy editor component
const MDXEditorLazy = dynamic(
  () => import('./MDXEditorCore').then((mod) => mod.MDXEditorCore),
  {
    ssr: false,
    loading: () => <EditorSkeleton className="h-full" />,
  }
);

export function MarkdownEditor({ className, readOnly = false }: MarkdownEditorProps) {
  const { currentDocument, updateCurrentContent, setOutline, hasUnsavedChanges } =
    useDocumentStore();

  // Extract outline from content whenever it changes
  const updateOutline = useCallback(
    (markdown: string) => {
      const outline = extractOutline(markdown);
      setOutline(outline);
    },
    [setOutline]
  );

  // Handle content changes
  const handleChange = useCallback(
    (markdown: string) => {
      updateCurrentContent(markdown);
      updateOutline(markdown);
    },
    [updateCurrentContent, updateOutline]
  );

  // Initialize/update outline when document or content changes
  useEffect(() => {
    if (currentDocument?.content) {
      updateOutline(currentDocument.content);
    }
  }, [currentDocument?.id, currentDocument?.content, updateOutline]);

  if (!currentDocument) {
    return <NoDocumentSelected className={className} />;
  }

  return (
    <MDXEditorLazy
      className={className}
      content={currentDocument.content}
      onChange={handleChange}
      readOnly={readOnly}
      documentId={currentDocument.id}
    />
  );
}
