'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import { useDocumentStore } from '@/lib/store/document-store';
import {
  Save,
  Pin,
  PinOff,
  Cloud,
  CloudOff,
  CloudUpload,
  Loader2,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Download,
  FileText,
  FileType,
  FileCode,
  Copy,
  MessageSquare,
  Eye,
  EyeOff,
  MoreHorizontal,
  ChevronLeft,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadAsWord } from '@/lib/export/markdown-to-docx';
import { downloadAsPdf } from '@/lib/export/markdown-to-pdf';
import { toast } from 'sonner';
import { useMobileStore } from '@/lib/store/mobile-store';
import { DiskFileBrowser } from '@/components/disk/DiskFileBrowser';

// Download markdown as .md file
function downloadAsMarkdown(content: string, title: string) {
  const filename = `${title.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface MobileToolbarProps {
  onSave?: () => Promise<void>;
  onTogglePin?: () => Promise<void>;
  onLogout?: () => void;
  onDraft?: (markdown: string) => void;
  onOpenChat?: () => void;
  documentId?: string;
}

export function MobileToolbar({
  onSave,
  onTogglePin,
  onLogout,
  onDraft,
  onOpenChat,
  documentId,
}: MobileToolbarProps) {
  const t = useTranslations();
  const { currentDocument, isSaving, hasUnsavedChanges, syncStatus, outlineOpen, toggleOutline } = useDocumentStore();
  const { toggleChatSheet } = useMobileStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [diskBrowserOpen, setDiskBrowserOpen] = useState(false);

  // Sync status
  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <CloudUpload className="h-4 w-4 motion-safe:animate-pulse" />;
      case 'offline':
      case 'error':
        return <CloudOff className="h-4 w-4 text-destructive" />;
      default:
        return <Cloud className="h-4 w-4" />;
    }
  };

  if (!currentDocument) return null;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-2 min-w-0 px-3 py-2 border-b border-border bg-background/95 backdrop-blur shrink-0 items-center">
      {/* Left: Back button */}
      <Button variant="ghost" size="icon" asChild className="shrink-0">
        <Link href="/documents" aria-label={t('editor.docList')}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </Button>

      {/* Center: Document title + sync status */}
      <div className="flex items-center gap-2 min-w-0 justify-center">
        <h1 className="text-base font-semibold truncate max-w-[150px]">
          {currentDocument.title}
        </h1>
        {currentDocument.is_pinned && (
          <Pin className="h-3.5 w-3.5 shrink-0 text-primary fill-primary" />
        )}
        <div className="flex items-center text-muted-foreground" aria-live="polite">
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
          ) : (
            getSyncIcon()
          )}
        </div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onOpenChat?.();
            toggleChatSheet();
          }}
          aria-label={t('editor.aiAssistant')}
        >
          <MessageSquare className="h-5 w-5" />
        </Button>

        {/* Outline toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleOutline}
          aria-label={outlineOpen ? t('editor.hideOutline') : t('editor.showOutline')}
          className="hidden"
        >
          {outlineOpen ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </Button>

        {/* More menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="更多操作">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Save */}
            <DropdownMenuItem
              onClick={onSave}
              disabled={isSaving || !hasUnsavedChanges}
            >
              <Save className="h-4 w-4 mr-2" />
              {t('editor.save')}
              {hasUnsavedChanges && (
                <span className="ml-auto text-xs text-muted-foreground">•</span>
              )}
            </DropdownMenuItem>

            {/* Pin/Unpin */}
            <DropdownMenuItem onClick={onTogglePin}>
              {currentDocument.is_pinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  {t('editor.unpin')}
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  {t('editor.pin')}
                </>
              )}
            </DropdownMenuItem>

            {/* AI Draft */}
            {onDraft && (
              <DropdownMenuItem onClick={() => {/* trigger draft modal */}}>
                <Sparkles className="h-4 w-4 mr-2" />
                {t('editor.draft')}
              </DropdownMenuItem>
            )}

            {/* Disk Files - close menu first, then open dialog */}
            {documentId && (
              <DropdownMenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setTimeout(() => setDiskBrowserOpen(true), 100);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Disk Files
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Export */}
            <DropdownMenuItem
              onClick={async () => {
                if (currentDocument?.content) {
                  await navigator.clipboard.writeText(currentDocument.content);
                  toast.success(t('editor.copySuccess') || 'Copied to clipboard');
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              {t('editor.copyMarkdown') || 'Copy Markdown'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (currentDocument) {
                  downloadAsMarkdown(currentDocument.content ?? '', currentDocument.title);
                }
              }}
            >
              <FileCode className="h-4 w-4 mr-2" />
              {t('editor.markdownFile')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                downloadAsWord(currentDocument.content ?? '', currentDocument.title, documentId)
                  .then(() => toast.success(t('editor.exportWordSuccess')))
                  .catch((e) => toast.error(e.message));
              }}
            >
              <FileType className="h-4 w-4 mr-2" />
              {t('editor.wordDoc')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                downloadAsPdf(currentDocument.content ?? '', currentDocument.title, documentId)
                  .then(() => toast.success(t('editor.exportPdfSuccess')))
                  .catch((e) => toast.error(e.message));
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              {t('editor.pdfDoc')}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Logout */}
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              {t('editor.logOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Disk File Browser - controlled externally */}
        {documentId && (
          <DiskFileBrowser
            documentId={documentId}
            open={diskBrowserOpen}
            onOpenChange={setDiskBrowserOpen}
          />
        )}
      </div>
    </div>
  );
}
