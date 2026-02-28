'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDocumentStore } from '@/lib/store/document-store';
import {
  Plus,
  FolderPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  Edit2,
  Pin,
  Loader2,
  FileStack,
  Upload,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentList } from './DocumentList';
import { TemplatePicker } from '@/components/templates/TemplatePicker';
import type { Document, Folder as FolderType } from '@/lib/types';
import type { DocumentTemplate } from '@/lib/templates';

interface SidebarProps {
  onCreateDocument?: (folderId?: string | null, template?: { name: string; content: string }) => Promise<void>;
  onCreateFolder?: (parentId?: string | null) => Promise<void>;
  onImportMarkdown?: (folderId?: string | null) => void;
  onDeleteDocument?: (id: string) => Promise<void>;
  onBatchDelete?: (ids: string[]) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onRenameFolder?: (id: string, name: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
  onSelectDocument?: (id: string) => void;
}

export function Sidebar({
  onCreateDocument,
  onCreateFolder,
  onImportMarkdown,
  onDeleteDocument,
  onBatchDelete,
  onDeleteFolder,
  onRenameFolder,
  onRenameDocument,
  onSelectDocument,
}: SidebarProps) {
  const t = useTranslations();
  const {
    sidebarOpen,
    toggleSidebar,
    documents,
    folders,
    currentDocument,
    activeFolderId,
    setActiveFolderId,
  } = useDocumentStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Derive filtered documents during render, not in effect
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      // Filter by active folder
      return activeFolderId
        ? documents.filter((doc) => doc.parent_folder_id === activeFolderId)
        : documents.filter((doc) => !doc.parent_folder_id);
    }
    const query = searchQuery.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query)
    );
  }, [searchQuery, documents, activeFolderId]);

  const handleCreateDocument = useCallback(async () => {
    if (onCreateDocument) {
      setIsCreating(true);
      try {
        await onCreateDocument(activeFolderId);
      } finally {
        setIsCreating(false);
      }
    }
  }, [onCreateDocument, activeFolderId]);

  const handleCreateFolder = useCallback(async () => {
    if (onCreateFolder) {
      await onCreateFolder(activeFolderId);
    }
  }, [onCreateFolder, activeFolderId]);

  const handleSelectTemplate = useCallback(async (template: DocumentTemplate) => {
    if (onCreateDocument) {
      setIsCreating(true);
      try {
        await onCreateDocument(activeFolderId, { name: template.nameZh, content: template.content });
      } finally {
        setIsCreating(false);
      }
    }
  }, [onCreateDocument, activeFolderId]);

  const rootFolders = folders.filter((f) => !f.parent_folder_id);
  // All Documents：显示全部；选中某文件夹：只显示该文件夹内文档；搜索时：显示搜索结果
  const listDocuments = searchQuery.trim()
    ? filteredDocuments
    : activeFolderId === null
      ? documents
      : filteredDocuments;

  return (
    <>
      {/* Sidebar toggle for when closed */}
      {!sidebarOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="fixed left-2 top-2 z-50"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}

      {/* Main sidebar (width controlled by parent + resize handle) */}
      <aside
        className={cn(
          'flex flex-col h-screen bg-background border-r border-border w-full min-w-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-lg">{t('editor.docList')}</h2>
          <Button variant="ghost" size="sm" onClick={toggleSidebar}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <label htmlFor="document-search" className="sr-only">
              {t('sidebar.searchDocuments')}
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              id="document-search"
              placeholder={t('sidebar.searchDocuments')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              type="search"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-3 pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isCreating}
                aria-busy={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                {isCreating ? '...' : t('sidebar.newDoc')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={handleCreateDocument}>
                <FileText className="h-4 w-4 mr-2" />
                {t('documents.blankDocument')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTemplatePickerOpen(true)}>
                <FileStack className="h-4 w-4 mr-2" />
                {t('documents.fromTemplate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onImportMarkdown?.(activeFolderId)}>
                <Upload className="h-4 w-4 mr-2" />
                {t('documents.importMarkdown')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateFolder}
            aria-label={t('sidebar.newFolder')}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Template Picker */}
        <TemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          onSelect={handleSelectTemplate}
        />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3" aria-label={t('sidebar.allDocuments')}>
          {/* All documents */}
          <button
            onClick={() => setActiveFolderId(null)}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer',
              activeFolderId === null && 'bg-accent'
            )}
            aria-pressed={activeFolderId === null}
          >
            <FileText className="h-4 w-4" aria-hidden />
            <span>{t('sidebar.allDocuments')}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {documents.length}
            </span>
          </button>

          {/* Folders */}
          <div className="mt-2">
            {rootFolders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                folders={folders}
                documents={documents}
                activeFolderId={activeFolderId}
                currentDocumentId={currentDocument?.id}
                onSelect={(id) => setActiveFolderId(id)}
                onDelete={onDeleteFolder}
                onRename={onRenameFolder}
                onSelectDocument={onSelectDocument}
                onDeleteDocument={onDeleteDocument}
                onRenameDocument={onRenameDocument}
                onBatchDelete={onBatchDelete}
              />
            ))}
          </div>

          {/* Documents */}
          <div className="mt-4">
            <DocumentList
              documents={listDocuments}
              currentDocumentId={currentDocument?.id}
              onSelectDocument={onSelectDocument}
              onDeleteDocument={onDeleteDocument}
              onRenameDocument={onRenameDocument}
              onBatchDelete={onBatchDelete}
            />
          </div>
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-border p-3">
          <a
            href="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            {t('sidebar.settings') || 'Settings'}
          </a>
        </div>
      </aside>
    </>
  );
}

interface FolderItemProps {
  folder: FolderType;
  folders: FolderType[];
  documents: Document[];
  activeFolderId: string | null;
  currentDocumentId?: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onRename?: (id: string, name: string) => Promise<void>;
  onSelectDocument?: (id: string) => void;
  onDeleteDocument?: (id: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
  onBatchDelete?: (ids: string[]) => Promise<void>;
}

function FolderItem({
  folder,
  folders,
  documents,
  activeFolderId,
  currentDocumentId,
  onSelect,
  onDelete,
  onRename,
  onSelectDocument,
  onDeleteDocument,
  onRenameDocument,
  onBatchDelete,
}: FolderItemProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);

  const childFolders = folders.filter((f) => f.parent_folder_id === folder.id);
  const childDocuments = documents.filter((d) => d.parent_folder_id === folder.id);

  const handleRename = async () => {
    if (onRename && newName.trim() && newName !== folder.name) {
      await onRename(folder.id, newName.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent cursor-pointer transition-colors',
          activeFolderId === folder.id && 'bg-accent'
        )}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded hover:bg-accent/50 min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={isOpen ? t('sidebar.collapseFolder') : t('sidebar.expandFolder')}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <FolderOpen className="h-4 w-4" aria-hidden />
          ) : (
            <Folder className="h-4 w-4" aria-hidden />
          )}
        </button>

        {isRenaming ? (
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="h-6 text-sm flex-1"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 truncate"
            onClick={() => onSelect(folder.id)}
          >
            {folder.name}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              {t('documentList.rename')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete?.(folder.id)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('documentList.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isOpen ? (
        <div className="ml-4 border-l border-border pl-2">
          {childFolders.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              folders={folders}
              documents={documents}
              activeFolderId={activeFolderId}
              currentDocumentId={currentDocumentId}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onSelectDocument={onSelectDocument}
              onDeleteDocument={onDeleteDocument}
              onRenameDocument={onRenameDocument}
              onBatchDelete={onBatchDelete}
            />
          ))}
          <DocumentList
            documents={childDocuments}
            currentDocumentId={currentDocumentId}
            onSelectDocument={onSelectDocument}
            onDeleteDocument={onDeleteDocument}
            onRenameDocument={onRenameDocument}
            onBatchDelete={onBatchDelete}
          />
        </div>
      ) : null}
    </div>
  );
}
