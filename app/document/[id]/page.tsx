'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDocument } from '@/hooks/useDocument';
import { useFolder } from '@/hooks/useFolder';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useSync } from '@/hooks/useSync';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutlineView } from '@/components/sidebar/OutlineView';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentStore } from '@/lib/store/document-store';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { SaveToast, type SaveToastType } from '@/components/SaveToast';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function DocumentPage() {
  const params = useParams();
  const documentId = params.id as string;
  const router = useRouter();
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
      const debug =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('debug') === '1';

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (debug) {
        console.log('[document] init', {
          documentId,
          hasUser: !!user,
          userId: user?.id?.slice(0, 8),
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        });
      }

      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const [docs, , doc] = await Promise.all([
          loadDocuments(),
          loadFolders(),
          loadDocument(documentId),
        ]);

        if (debug) {
          console.log('[document] load result', {
            documentId,
            docFound: !!doc,
            documentsCount: docs?.length ?? 0,
            documentIds: docs?.map((d) => d.id)?.slice(0, 5),
          });
        }

        if (!doc) {
          // Stale link or no access: redirect to list if we have other docs or none
          if (!docs?.length || !docs.some((d) => d.id === documentId)) {
            router.replace('/documents');
            return;
          }
          setNotFound(true);
        }
      } catch (error) {
        if (debug) console.error('[document] load error', error);
        console.error('Error loading document:', error);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [documentId, loadDocuments, loadFolders, loadDocument, router]);

  const handleCreateDocument = async (folderId?: string | null) => {
    try {
      const doc = await createNewDocument(folderId);
      router.push(`/document/${doc.id}`);
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

  const handleSelectDocument = (id: string) => {
    router.push(`/document/${id}`);
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await removeDocument(id);
        if (currentDocument?.id === id) {
          router.push('/documents');
        }
      } catch (error) {
        console.error('Error deleting document:', error);
      }
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
      {/* Sidebar column (width persisted, drag to resize) */}
      <div
        style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        className="flex shrink-0 overflow-hidden transition-[width] duration-200"
      >
        <Sidebar
          onCreateDocument={handleCreateDocument}
          onCreateFolder={handleCreateFolder}
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

      {/* Main content（min-w-0 + overflow-hidden 避免与右侧 Outline 重叠） */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <EditorToolbar
          onSave={handleSave}
          onTogglePin={handleTogglePin}
          onLogout={handleLogout}
          onDraft={(markdown) => updateCurrentContent(markdown)}
          onOpenChat={() => setChatOpen((v) => !v)}
        />
        <div className="flex-1 overflow-auto">
          <MarkdownEditor className="h-full" />
        </div>
      </main>

      {/* Outline column（z-10 避免被主内容遮挡） */}
      {outlineOpen && (
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

      {/* AI 编辑助手面板（可拖拽调整宽度） */}
      {chatOpen && (
        <>
          <ResizeHandle onResize={resizeChatPanelBy} direction="right" />
          <div
            style={{ width: chatPanelWidth }}
            className="shrink-0 flex flex-col border-l border-border bg-background z-10"
          >
            <ChatPanel
              getMarkdown={() => currentDocument?.content ?? ''}
              setMarkdown={updateCurrentContent}
              onClose={() => setChatOpen(false)}
              className="h-full min-h-0"
            />
          </div>
        </>
      )}

      {/* 保存状态提示（自动保存 / 手动保存） */}
      <SaveToast type={saveToast} />
    </div>
  );
}
