'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { LogOut, FileText, Plus, FileStack, Loader2, Upload, FileUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentStore } from '@/lib/store/document-store';
import { ResizeHandle } from '@/components/ui/resize-handle';
import { useTranslations } from '@/contexts/LocaleContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TemplatePicker } from '@/components/templates/TemplatePicker';
import type { DocumentTemplate } from '@/lib/templates';

export default function EditorPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isImportingPDF, setIsImportingPDF] = useState(false);
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

  const handleCreateDocument = async (folderId?: string | null, options?: { title?: string; content?: string }) => {
    setIsCreating(true);
    const toastId = toast.loading('创建文档中...');
    try {
      console.log('[handleCreateDocument] Creating document...', options ? 'with options' : 'blank');
      const doc = await createNewDocument(folderId, options);
      console.log('[handleCreateDocument] Document created:', { id: doc.id, title: doc.title });
      toast.success('文档创建成功', { id: toastId });
      console.log('[handleCreateDocument] Navigating to:', `/document/${doc.id}`);
      // Use window.location.href for a full page load to avoid client-side routing issues
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error creating document:', error);
      toast.error('创建文档失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectTemplate = async (template: DocumentTemplate) => {
    await handleCreateDocument(null, { title: template.nameZh, content: template.content });
    setTemplatePickerOpen(false);
  };

  const handleBlankDocument = async () => {
    await handleCreateDocument();
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
      toast.error(t('documents.importFailed') + ': ' + (file.name.endsWith('.txt') ? '请使用 .md 或 .markdown 文件' : 'Invalid file type'));
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(t('documents.importing'));

    try {
      let content = await file.text();

      // Normalize line endings to \n
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Fix code blocks without language identifier
      // Process line by line to distinguish opening from closing delimiters
      const lines = content.split('\n');
      let inCodeBlock = false;
      const processedLines = lines.map(line => {
        // Check if this is a code block delimiter
        if (line.match(/^```\s*$/)) {
          if (!inCodeBlock) {
            // Opening delimiter without language - use 'markdown' (CodeMirror has it loaded)
            inCodeBlock = true;
            return '```markdown';
          } else {
            // Closing delimiter - keep as is
            inCodeBlock = false;
            return line;
          }
        }
        // Check if this is an opening delimiter WITH a language
        if (line.match(/^```\w+/)) {
          inCodeBlock = true;
        }
        return line;
      });
      content = processedLines.join('\n');

      // Extract title from filename (remove extension)
      const title = file.name.replace(/\.(md|markdown)$/i, '');

      const doc = await createNewDocument(null, { title, content });
      toast.success(t('documents.importSuccess'), { id: toastId });

      // Navigate to the new document
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error importing markdown:', error);
      toast.error(t('documents.importFailed') + ': ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportPDF = () => {
    pdfInputRef.current?.click();
  };

  const handlePDFChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be selected again
    e.target.value = '';

    // Check file type
    if (file.type !== 'application/pdf') {
      toast.error('请选择 PDF 文件');
      return;
    }

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('PDF 文件太大，最大 50MB');
      return;
    }

    setIsImportingPDF(true);
    const toastId = toast.loading('正在解析 PDF...');

    try {
      // Dynamically import PDF parsing functions
      const { parsePDF } = await import('@/lib/pdf');

      // Parse PDF
      const result = await parsePDF(file, {
        mode: 'auto',
        imageScale: 1.5,
        maxPages: 50,
      });

      let content = '';
      let title = file.name.replace(/\.pdf$/i, '');

      if (result.type === 'markdown') {
        content = result.content;
        toast.loading(`已提取文本 (${result.content.length} 字符)`, { id: toastId });
      } else {
        // For image-based PDFs, we can't directly create a markdown document
        // Show a message to the user
        toast.error('此 PDF 为图片型，暂不支持直接创建文档。请在聊天中上传并使用 AI 分析。', { id: toastId, duration: 5000 });
        setIsImportingPDF(false);
        return;
      }

      // Create document with extracted content
      const doc = await createNewDocument(null, { title, content });
      toast.success('文档创建成功', { id: toastId });

      // Navigate to the new document
      window.location.href = `/document/${doc.id}`;
    } catch (error) {
      console.error('Error importing PDF:', error);
      toast.error('导入 PDF 失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
    } finally {
      setIsImportingPDF(false);
    }
  };

  const handleCreateFolder = async (parentId?: string | null) => {
    const name = prompt('输入文件夹名称:');
    if (name?.trim()) {
      const toastId = toast.loading('创建文件夹中...');
      try {
        await createNewFolder(name.trim(), parentId);
        toast.success('文件夹创建成功', { id: toastId });
      } catch (error) {
        console.error('Error creating folder:', error);
        toast.error('创建文件夹失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
      }
    }
  };

  const handleSelectDocument = (id: string) => {
    // Use window.location.href for a full page load to avoid client-side routing issues
    window.location.href = `/document/${id}`;
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('确定要删除这个文档吗？')) {
      const toastId = toast.loading('删除中...');
      try {
        await removeDocument(id);
        toast.success('文档已删除', { id: toastId });
      } catch (error) {
        console.error('Error deleting document:', error);
        toast.error('删除失败', { id: toastId });
      }
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`确定要删除 ${ids.length} 个文档吗？`)) return;

    const toastId = toast.loading(`正在删除 ${ids.length} 个文档...`);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await removeDocument(id);
        successCount++;
      } catch (error) {
        console.error('Error deleting document:', id, error);
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success(`已删除 ${successCount} 个文档`, { id: toastId });
    } else {
      toast.error(`成功 ${successCount} 个，失败 ${failCount} 个`, { id: toastId });
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (confirm('确定要删除这个文件夹吗？')) {
      const toastId = toast.loading('删除中...');
      try {
        await removeFolder(id);
        toast.success('文件夹已删除', { id: toastId });
      } catch (error) {
        console.error('Error deleting folder:', error);
        toast.error('删除失败', { id: toastId });
      }
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const toastId = toast.loading('重命名中...');
    try {
      await renameFolder(id, name);
      toast.success('文件夹已重命名', { id: toastId });
    } catch (error) {
      console.error('Error renaming folder:', error);
      toast.error('重命名失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
    }
  };

  const handleRenameDocument = async (id: string, title: string) => {
    const toastId = toast.loading('重命名中...');
    try {
      await renameDocument(id, title);
      toast.success('文档已重命名', { id: toastId });
    } catch (error) {
      console.error('Error renaming document:', error);
      toast.error('重命名失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
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
      const toastId = toast.loading('切换置顶中...');
      try {
        await pinDocument(currentDocument.id);
        toast.success('置顶状态已更新', { id: toastId });
      } catch (error) {
        console.error('Error toggling pin:', error);
        toast.error('操作失败: ' + (error instanceof Error ? error.message : '未知错误'), { id: toastId });
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
          onImportMarkdown={handleImportMarkdown}
          onImportPDF={handleImportPDF}
          onDeleteDocument={handleDeleteDocument}
          onBatchDelete={handleBatchDelete}
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
            <div className="flex gap-2 justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" disabled={isCreating || isImporting}>
                    {isCreating || isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {t('documents.createDocument')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-48">
                  <DropdownMenuItem onClick={handleBlankDocument}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('documents.blankDocument')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTemplatePickerOpen(true)}>
                    <FileStack className="h-4 w-4 mr-2" />
                    {t('documents.fromTemplate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImportMarkdown} disabled={isImporting}>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('documents.importMarkdown')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImportPDF} disabled={isImportingPDF}>
                    <FileUp className="h-4 w-4 mr-2" />
                    {t('documents.importPDF')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Template Picker */}
        <TemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          onSelect={handleSelectTemplate}
        />
      </main>

      {/* Hidden file input for markdown import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden file input for PDF import */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePDFChange}
        className="hidden"
      />

      {/* Outline view (hidden when no document) */}
      {outlineOpen && <OutlineView className="hidden" />}
    </div>
  );
}
