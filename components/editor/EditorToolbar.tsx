'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDocumentStore } from '@/lib/store/document-store';
import {
  Save,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Cloud,
  CloudOff,
  CloudUpload,
  Loader2,
  LogOut,
  LayoutDashboard,
  Sparkles,
  X,
  Download,
  FileText,
  FileType,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadAsWord } from '@/lib/export/markdown-to-docx';
import { downloadAsPdf } from '@/lib/export/markdown-to-pdf';

interface EditorToolbarProps {
  onSave?: () => Promise<void>;
  onTogglePin?: () => Promise<void>;
  onLogout?: () => void;
  /** Called when draft API returns markdown; e.g. updateCurrentContent(markdown) */
  onDraft?: (markdown: string) => void;
  /** Open AI chat panel for edit-by-chat */
  onOpenChat?: () => void;
}

export function EditorToolbar({ onSave, onTogglePin, onLogout, onDraft, onOpenChat }: EditorToolbarProps) {
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  /** 起稿结果：有值时显示对比视图，用户选择接受或放弃 */
  const [draftResult, setDraftResult] = useState<string | null>(null);
  const {
    currentDocument,
    isSaving,
    hasUnsavedChanges,
    syncStatus,
    outlineOpen,
    toggleOutline,
  } = useDocumentStore();

  // When dialog is open and current document changes, sync title
  useEffect(() => {
    if (currentDocument && draftOpen) setDraftTitle(currentDocument.title);
  }, [currentDocument?.id, currentDocument?.title, draftOpen]);

  const openDraftDialog = () => {
    if (currentDocument) {
      setDraftTitle(currentDocument.title);
      setDraftInstruction('');
      setDraftResult(null);
      setDraftOpen(true);
    }
  };

  const closeDraftDialog = () => {
    setDraftOpen(false);
    setDraftResult(null);
  };

  const handleDraftSubmit = async () => {
    const title = draftTitle.trim();
    if (!title || !onDraft) return;
    setIsDrafting(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          instruction: draftInstruction.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? 'Draft failed');
        return;
      }
      if (data.markdown) {
        setDraftResult(data.markdown);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Draft request failed');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleAcceptDraft = () => {
    if (draftResult && onDraft) {
      onDraft(draftResult);
      closeDraftDialog();
    }
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <CloudUpload className="h-4 w-4 motion-safe:animate-pulse" />;
      case 'offline':
        return <CloudOff className="h-4 w-4" />;
      case 'error':
        return <CloudOff className="h-4 w-4 text-destructive" />;
      case 'synced':
      default:
        return <Cloud className="h-4 w-4" />;
    }
  };

  const getSyncText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Sync error';
      case 'synced':
      default:
        return hasUnsavedChanges ? 'Unsaved changes' : 'Saved';
    }
  };

  if (!currentDocument) return null;

  return (
    <>
    <div className="grid grid-cols-[1fr_auto] gap-3 min-w-0 px-4 py-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 items-center">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/documents" aria-label="返回文档列表">
            <LayoutDashboard className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">文档</span>
          </Link>
        </Button>
        <h1 className="text-lg font-semibold truncate min-w-0">
          {currentDocument.title}
        </h1>
        {currentDocument.is_pinned && (
          <Pin className="h-4 w-4 shrink-0 text-primary fill-primary" />
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Sync status indicator */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">
          {isSaving ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : getSyncIcon()}
          <span className="hidden sm:inline">{getSyncText()}</span>
        </div>

        {/* Toggle outline */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleOutline}
          className={cn(outlineOpen ? 'bg-accent' : '')}
          aria-label={outlineOpen ? 'Hide outline' : 'Show outline'}
          aria-pressed={outlineOpen}
        >
          {outlineOpen ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">Outline</span>
        </Button>

        {/* Pin/Unpin */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onTogglePin}
          aria-label={currentDocument.is_pinned ? 'Unpin document' : 'Pin document'}
        >
          {currentDocument.is_pinned ? (
            <>
              <PinOff className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Unpin</span>
            </>
          ) : (
            <>
              <Pin className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Pin</span>
            </>
          )}
        </Button>

        {/* Draft with LLM */}
        {onDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={openDraftDialog}
            disabled={isDrafting}
            aria-label="起稿"
            aria-busy={isDrafting}
          >
            <Sparkles className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">起稿</span>
          </Button>
        )}

        {/* AI 编辑助手 */}
        {onOpenChat && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenChat}
            aria-label="AI 编辑助手"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">AI 助手</span>
          </Button>
        )}

        {/* Manual save */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          aria-label="Save document"
          aria-busy={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">Save</span>
        </Button>

        {/* 下载：Word / PDF */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="下载文档">
              <Download className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">下载</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                if (currentDocument) {
                  downloadAsWord(currentDocument.content ?? '', currentDocument.title).catch((e) =>
                    alert(e instanceof Error ? e.message : '导出 Word 失败')
                  );
                }
              }}
            >
              <FileType className="h-4 w-4" />
              Word 文档 (.docx)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (currentDocument) {
                  downloadAsPdf(currentDocument.content ?? '', currentDocument.title).catch((e) =>
                    alert(e instanceof Error ? e.message : '导出 PDF 失败')
                  );
                }
              }}
            >
              <FileText className="h-4 w-4" />
              PDF 文档 (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeSwitcher />
        {onLogout && (
          <>
            <span className="w-px h-5 bg-border hidden sm:block" aria-hidden />
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              aria-label="Log out"
              className="border-muted-foreground/30"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1.5">Log out</span>
            </Button>
          </>
        )}
      </div>
    </div>

    {/* 起稿弹窗：表单步骤 | 对比步骤 */}
    {onDraft && draftOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-dialog-title"
        onClick={() => !isDrafting && closeDraftDialog()}
      >
        <div
          className={cn(
            'rounded-lg border border-border bg-background shadow-lg flex flex-col',
            draftResult !== null ? 'w-full max-w-4xl max-h-[85vh] p-4 gap-4' : 'w-full max-w-md p-4 gap-4'
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key === 'Escape' && closeDraftDialog()}
        >
          <div className="flex items-center justify-between shrink-0">
            <h2 id="draft-dialog-title" className="text-lg font-semibold">
              {draftResult !== null ? '对比并选择' : '起稿'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeDraftDialog}
              disabled={isDrafting}
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {draftResult === null ? (
            /* 步骤一：填写标题与说明 */
            <>
              <p className="text-sm text-muted-foreground shrink-0">
                描述你希望生成的内容，AI 将根据标题和说明起稿。
              </p>
              <div className="grid gap-2 shrink-0">
                <Label htmlFor="draft-title">标题</Label>
                <Input
                  id="draft-title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="文档标题"
                  disabled={isDrafting}
                />
              </div>
              <div className="grid gap-2 shrink-0">
                <Label htmlFor="draft-instruction">补充说明（可选）</Label>
                <textarea
                  id="draft-instruction"
                  value={draftInstruction}
                  onChange={(e) => setDraftInstruction(e.target.value)}
                  placeholder="例如：写一篇技术博客大纲、会议纪要结构…"
                  disabled={isDrafting}
                  rows={3}
                  className={cn(
                    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
                    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]'
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 shrink-0">
                <Button variant="outline" onClick={closeDraftDialog} disabled={isDrafting}>
                  取消
                </Button>
                <Button
                  onClick={handleDraftSubmit}
                  disabled={isDrafting || !draftTitle.trim()}
                  aria-busy={isDrafting}
                >
                  {isDrafting ? (
                    <>
                      <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                      生成中…
                    </>
                  ) : (
                    '起稿'
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* 步骤二：当前文档 vs 起稿结果，选择接受或放弃 */
            <>
              <p className="text-sm text-muted-foreground shrink-0">
                请对比当前文档与起稿结果，选择「接受并替换」或「放弃」。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col gap-2 min-h-0">
                  <Label className="text-muted-foreground font-medium">当前文档</Label>
                  <textarea
                    readOnly
                    value={currentDocument?.content ?? ''}
                    className={cn(
                      'flex-1 min-h-[200px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono',
                      'resize-none focus:outline-none'
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                  <Label className="text-muted-foreground font-medium">起稿结果</Label>
                  <textarea
                    readOnly
                    value={draftResult}
                    className={cn(
                      'flex-1 min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono',
                      'resize-none focus:outline-none'
                    )}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 shrink-0">
                <Button variant="outline" onClick={closeDraftDialog}>
                  放弃
                </Button>
                <Button onClick={handleAcceptDraft}>
                  接受并替换
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
