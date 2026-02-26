'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useDocument } from '@/hooks/useDocument';
import { useFolder } from '@/hooks/useFolder';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useSync } from '@/hooks/useSync';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MobileSidebar } from '@/components/sidebar/MobileSidebar';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { MobileToolbar } from '@/components/editor/MobileToolbar';
import { OutlineView } from '@/components/sidebar/OutlineView';
import { MobileOutline } from '@/components/sidebar/MobileOutline';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentStore } from '@/lib/store/document-store';
import { cn } from '@/lib/utils';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { SaveToast, type SaveToastType } from '@/components/SaveToast';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { MobileChat } from '@/components/chat/MobileChat';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useTranslations } from '@/contexts/LocaleContext';

/** Supabase document id is UUID; reject placeholders like %%drp:id:xxx%% */
function isValidDocumentId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // WORKAROUND: useParams() is returning incorrect values in production.
  // Parse the document ID directly from the URL pathname instead.
  const documentId = useMemo(() => {
    if (typeof window === 'undefined') {
      return params.id as string; // SSR fallback
    }
    const pathname = window.location.pathname;
    const match = pathname.match(/\/document\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
    if (match) {
      return match[1];
    }
    // Fallback to useParams if no match
    return params.id as string;
  }, [params.id]);

  // Debug: log the actual URL and params
  console.log('[document] render', {
    url: typeof window !== 'undefined' ? window.location.href : 'SSR',
    paramsId: params.id,
    resolvedId: documentId,
    isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saveToast, setSaveToast] = useState<SaveToastType>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const {
    currentDocument,
    loadDocuments,
    loadDocument,
    createNewDocument,
    saveDocument,
    removeDocument,
    pinDocument,
    renameDocument,
  } = useDocument();
  const { loadFolders, createNewFolder, renameFolder, removeFolder } = useFolder();
  const {
    sidebarOpen,
    outlineOpen,
    sidebarWidth,
    outlineWidth,
    chatPanelWidth,
    resizeSidebarBy,
    resizeOutlineBy,
    resizeChatPanelBy,
    updateCurrentContent,
  } = useDocumentStore();

  // Auto-save hook（带保存提示）
  const { save, isSaving } = useAutoSave({
    interval: 30000,
    enabled: true,
    onSavingStart: () => setSaveToast('saving'),
    onSaveSuccess: () => {
      setSaveToast('saved');
      setTimeout(() => setSaveToast(null), 2000);
    },
    onSaveError: () => {
      setSaveToast('error');
      setTimeout(() => setSaveToast(null), 3000);
    },
  });

  // Realtime sync
  useSync({ enabled: true });

  // Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  // Load document
  useEffect(() => {
    const init = async () => {
      console.log('[document] useEffect triggered', { documentId });

      // Invalid id (e.g. placeholder %%drp:id:xxx%%) causes PostgreSQL 22P02; redirect early
      if (!isValidDocumentId(documentId)) {
        console.log('[document] Invalid ID, redirecting to /documents');
        router.replace('/documents');
        setIsLoading(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log('[document] getUser result', {
        documentId,
        hasUser: !!user,
        userId: user?.id?.slice(0, 8),
      });

      if (!user) {
        console.log('[document] No user, redirecting to /login');
        router.push('/login');
        return;
      }

      try {
        console.log('[document] Loading data...');
        const [docs, , doc] = await Promise.all([
          loadDocuments(),
          loadFolders(),
          loadDocument(documentId),
        ]);

        console.log('[document] Load result', {
          documentId,
          docFound: !!doc,
          documentsCount: docs?.length ?? 0,
        });

        if (!doc) {
          console.log('[document] Doc not found, checking docs list...');
          // Stale link or no access: redirect to list if we have other docs or none
          if (!docs?.length || !docs.some((d) => d.id === documentId)) {
            console.log('[document] Redirecting to /documents');
            router.replace('/documents');
            return;
          }
          setNotFound(true);
        }
      } catch (error) {
        console.error('[document] Load error:', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const handleCreateDocument = async (folderId?: string | null, template?: { name: string; content: string }) => {
    try {
      const doc = await createNewDocument(folderId, template ? { title: template.name, content: template.content } : undefined);
      // Use window.location.href for a full page load to avoid client-side routing issues
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };

  const handleCreateFolder = async (parentId?: string | null) => {
    const name = prompt('Enter folder name:');
    if (name?.trim()) {
      try {
        await createNewFolder(name.trim(), parentId);
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const handleImportMarkdown = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    e.target.value = '';

    // Check file extension
    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
      toast.error(t('documents.importFailed') + ': ' + (file.name.endsWith('.txt') ? 'Please use .md or .markdown file' : 'Invalid file type'));
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(t('documents.importing'));

    try {
      let content = await file.text();

      // Fix code blocks without language identifier
      // Match ``` followed by optional whitespace and newline (no language)
      content = content.replace(/^```\s*$/gm, '```text');

      // Extract title from filename (remove extension)
      const title = file.name.replace(/\.(md|markdown)$/i, '');

      const doc = await createNewDocument(null, { title, content });
      toast.success(t('documents.importSuccess'), { id: toastId });

      // Navigate to the new document
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error importing markdown:', error);
      toast.error(t('documents.importFailed') + ': ' + (error instanceof Error ? error.message : 'Unknown error'), { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectDocument = (id: string) => {
    // Use window.location.href for a full page load to avoid client-side routing issues
    window.location.href = `/document/${id}`;
  };

  const handleDeleteDocument = async (id: string) => {
    console.log('[handleDeleteDocument] Called with id:', id);
    if (confirm('Are you sure you want to delete this document?')) {
      const toastId = toast.loading('Deleting document...');
      try {
        console.log('[handleDeleteDocument] User confirmed, deleting...');
        await removeDocument(id);
        console.log('[handleDeleteDocument] Delete successful');
        toast.success('Document deleted', { id: toastId });
        if (currentDocument?.id === id) {
          router.push('/documents');
        }
      } catch (error) {
        console.error('Error deleting document:', error);
        toast.error('Failed to delete document', { id: toastId });
      }
    } else {
      console.log('[handleDeleteDocument] User cancelled');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirm('Are you sure you want to delete this folder?')) {
      try {
        await removeFolder(id);
      } catch (error) {
        console.error('Error deleting folder:', error);
      }
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await renameFolder(id, name);
    } catch (error) {
      console.error('Error renaming folder:', error);
    }
  };

  const handleRenameDocument = async (id: string, title: string) => {
    try {
      await renameDocument(id, title);
    } catch (error) {
      console.error('Error renaming document:', error);
    }
  };

  const handleSave = async () => {
    await save();
  };

  const handleTogglePin = async () => {
    if (currentDocument) {
      try {
        await pinDocument(currentDocument.id);
      } catch (error) {
        console.error('Error toggling pin:', error);
      }
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Document not found</h2>
          <p className="text-muted-foreground mb-4">
            This document doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button onClick={() => router.push('/documents')}>返回文档列表</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <MobileSidebar
          onCreateDocument={handleCreateDocument}
          onCreateFolder={handleCreateFolder}
          onImportMarkdown={handleImportMarkdown}
          onDeleteDocument={handleDeleteDocument}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          onRenameDocument={handleRenameDocument}
          onSelectDocument={handleSelectDocument}
        />
      )}

      {/* Desktop Sidebar column (width persisted, drag to resize) */}
      {!isMobile && (
        <>
          <div
            style={{ width: sidebarOpen ? sidebarWidth : 0 }}
            className="flex shrink-0 overflow-hidden transition-[width] duration-200"
          >
            <Sidebar
              onCreateDocument={handleCreateDocument}
              onCreateFolder={handleCreateFolder}
              onImportMarkdown={handleImportMarkdown}
              onDeleteDocument={handleDeleteDocument}
              onDeleteFolder={handleDeleteFolder}
              onRenameFolder={handleRenameFolder}
              onRenameDocument={handleRenameDocument}
              onSelectDocument={handleSelectDocument}
            />
          </div>
          {sidebarOpen && (
            <ResizeHandle onResize={resizeSidebarBy} direction="right" />
          )}
        </>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        isMobile && "pb-14" // Space for bottom nav
      )}>
        {/* Desktop Toolbar */}
        {!isMobile && (
          <EditorToolbar
            onSave={handleSave}
            onTogglePin={handleTogglePin}
            onLogout={handleLogout}
            onDraft={(markdown) => updateCurrentContent(markdown)}
            onOpenChat={() => setChatOpen((v) => !v)}
            documentId={documentId}
          />
        )}

        {/* Mobile Toolbar */}
        {isMobile && (
          <MobileToolbar
            onSave={handleSave}
            onTogglePin={handleTogglePin}
            onLogout={handleLogout}
            onDraft={(markdown) => updateCurrentContent(markdown)}
            onOpenChat={() => setChatOpen((v) => !v)}
            documentId={documentId}
          />
        )}

        <div className="flex-1 overflow-auto">
          <MarkdownEditor className="h-full" />
        </div>
      </main>

      {/* Desktop Outline column */}
      {!isMobile && outlineOpen && (
        <>
          <ResizeHandle onResize={resizeOutlineBy} direction="right" />
          <div
            style={{ width: outlineWidth }}
            className="shrink-0 overflow-hidden flex flex-col z-10 bg-background/95"
          >
            <OutlineView className="flex-1 min-h-0" />
          </div>
        </>
      )}

      {/* Desktop AI Chat Panel */}
      {!isMobile && chatOpen && (
        <>
          <ResizeHandle onResize={resizeChatPanelBy} direction="right" />
          <div
            style={{ width: chatPanelWidth }}
            className="shrink-0 flex flex-col border-l border-border bg-background z-10"
          >
            <ChatPanel
              getMarkdown={() => currentDocument?.content ?? ''}
              setMarkdown={updateCurrentContent}
              documentId={documentId}
              useAcontext={true}
              saveDocument={save}
              onClose={() => setChatOpen(false)}
              className="h-full min-h-0"
            />
          </div>
        </>
      )}

      {/* Mobile AI Chat (Dialog) */}
      {isMobile && (
        <MobileChat
          getMarkdown={() => currentDocument?.content ?? ''}
          setMarkdown={updateCurrentContent}
          documentId={documentId}
          saveDocument={save}
        />
      )}

      {/* Mobile Outline (Bottom Sheet) */}
      {isMobile && <MobileOutline />}

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileBottomNav
          onDraft={() => {/* TODO: trigger draft modal */}}
        />
      )}

      {/* 保存状态提示 */}
      <SaveToast type={saveToast} />

      {/* Hidden file input for markdown import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
