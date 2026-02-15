'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDocument } from '@/hooks/useDocument';
import { useFolder } from '@/hooks/useFolder';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { OutlineView } from '@/components/sidebar/OutlineView';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { LogOut, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentStore } from '@/lib/store/document-store';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { useTranslations } from '@/contexts/LocaleContext';

export default function EditorPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const { currentDocument, loadDocuments, loadDocument, createNewDocument, saveDocument, removeDocument, pinDocument, renameDocument } = useDocument();
  const { loadFolders, createNewFolder, renameFolder, removeFolder } = useFolder();
  const { sidebarOpen, outlineOpen, sidebarWidth, resizeSidebarBy } =
    useDocumentStore();
  const redirectingToLogin = useRef(false);

  // Auto-save hook
  useAutoSave({
    interval: 30000,
    enabled: true,
  });

  // Initial data load（无用户时 replace 到 login，避免 403 时 documents↔login 循环）
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!redirectingToLogin.current) {
          redirectingToLogin.current = true;
          router.replace('/login');
        }
        setIsLoading(false);
        return;
      }

      try {
        await Promise.all([loadDocuments(), loadFolders()]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [loadDocuments, loadFolders, router]);

  const handleCreateDocument = async (folderId?: string | null) => {
    try {
      console.log('[handleCreateDocument] Creating document...');
      const doc = await createNewDocument(folderId);
      console.log('[handleCreateDocument] Document created:', { id: doc.id, title: doc.title });
      console.log('[handleCreateDocument] Navigating to:', `/document/${doc.id}`);
      // Use window.location.href for a full page load to avoid client-side routing issues
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error creating document:', error);
    }
  };

  const handleCreateFolder = async (parentId?: string | null) => {
    const name = prompt('输入文件夹名称:');
    if (name?.trim()) {
      try {
        await createNewFolder(name.trim(), parentId);
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const handleSelectDocument = (id: string) => {
    // Use window.location.href for a full page load to avoid client-side routing issues
    window.location.href = `/document/${id}`;
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('确定要删除这个文档吗？')) {
      try {
        await removeDocument(id);
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirm('确定要删除这个文件夹吗？')) {
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
    try {
      await saveDocument();
    } catch (error) {
      console.error('Error saving:', error);
    }
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
          <FileText className="h-12 w-12 mx-auto mb-4 animate-pulse text-muted-foreground" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar column (drag to resize) */}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2">
            {!sidebarOpen && <FileText className="h-5 w-5" />}
            <h1 className="font-semibold">{t('common.brand')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeSwitcher />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">{t('common.logout')}</span>
            </Button>
          </div>
        </header>

        {/* Welcome screen */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">{t('documents.welcome')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('documents.welcomeDesc')}
            </p>
            <Button onClick={() => handleCreateDocument()} size="lg">
              {t('documents.createDocument')}
            </Button>
          </div>
        </div>
      </main>

      {/* Outline view (hidden when no document) */}
      {outlineOpen && <OutlineView className="hidden" />}
    </div>
  );
}
