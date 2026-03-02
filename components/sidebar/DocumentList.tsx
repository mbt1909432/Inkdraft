'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, MoreHorizontal, Pin, PinOff, Trash2, Edit2, X } from 'lucide-react';
import type { Document } from '@/lib/types';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidDocumentId(id: string): boolean {
  return UUID_REGEX.test(id);
}

interface DocumentListProps {
  documents: Document[];
  currentDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  onDeleteDocument?: (id: string) => Promise<void>;
  onTogglePin?: (id: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
  onBatchDelete?: (ids: string[]) => Promise<void>;
}

export const DocumentList = memo(function DocumentList({
  documents,
  currentDocumentId,
  onSelectDocument,
  onDeleteDocument,
  onTogglePin,
  onRenameDocument,
  onBatchDelete,
}: DocumentListProps) {
  const t = useTranslations();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter out documents with invalid IDs (e.g., placeholders like %%drp:id:xxx%%)
  const validDocuments = useMemo(
    () => documents.filter((doc) => isValidDocumentId(doc.id)),
    [documents]
  );

  // Sort: pinned first, then by last edited
  const sortedDocuments = useMemo(
    () =>
      [...validDocuments].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }
        return new Date(b.last_edited_at).getTime() - new Date(a.last_edited_at).getTime();
      }),
    [validDocuments]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedDocuments.map((d) => d.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (onBatchDelete && selectedIds.size > 0) {
      await onBatchDelete(Array.from(selectedIds));
      exitSelectionMode();
    }
  };

  if (sortedDocuments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        {t('sidebar.noDocumentsYet')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Batch action toolbar - shown when in selection mode */}
      {selectionMode && (
        <div className="flex items-center gap-2 px-2 py-2 bg-blue-50 dark:bg-blue-950 rounded-md text-sm sticky top-0 z-10">
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            {t('documentList.selected')} {selectedIds.size}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selectAll}
          >
            {t('documentList.selectAll')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearSelection}
          >
            {t('documentList.deselectAll')}
          </Button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t('documentList.delete')} ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={exitSelectionMode}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Enter selection mode button - shown when NOT in selection mode */}
      {!selectionMode && sortedDocuments.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setSelectionMode(true)}
        >
          {t('documentList.selectMode')}
        </Button>
      )}

      {/* Document list */}
      <ul className="space-y-0.5">
        {sortedDocuments.map((doc) => (
          <li key={doc.id}>
            <DocumentItem
              document={doc}
              isActive={doc.id === currentDocumentId}
              isSelected={selectedIds.has(doc.id)}
              selectionMode={selectionMode}
              onSelect={() => onSelectDocument?.(doc.id)}
              onDelete={() => onDeleteDocument?.(doc.id)}
              onToggleSelect={() => toggleSelect(doc.id)}
              onTogglePin={() => onTogglePin?.(doc.id)}
              onRename={onRenameDocument ? (title) => onRenameDocument(doc.id, title) : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
});

interface DocumentItemProps {
  document: Document;
  isActive: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onToggleSelect: () => void;
  onTogglePin: () => void;
  onRename?: (title: string) => Promise<void>;
}

function DocumentItem({
  document,
  isActive,
  isSelected,
  selectionMode,
  onSelect,
  onDelete,
  onToggleSelect,
  onTogglePin,
  onRename,
}: DocumentItemProps) {
  const t = useTranslations();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(document.title);
  useEffect(() => {
    setNewTitle(document.title);
  }, [document.title]);

  // Memoize formatted date to avoid recalculation on every render
  const formattedDate = useMemo(() => {
    const date = new Date(document.last_edited_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('documentList.today');
    } else if (diffDays === 1) {
      return t('documentList.yesterday');
    } else if (diffDays < 7) {
      return `${diffDays} ${t('documentList.daysAgo')}`;
    } else {
      return date.toLocaleDateString();
    }
  }, [document.last_edited_at, t]);

  const handleRename = async () => {
    if (onRename && newTitle.trim() && newTitle !== document.title) {
      await onRename(newTitle.trim());
    }
    setNewTitle(document.title);
    setIsRenaming(false);
  };

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect();
    } else if (!isRenaming) {
      onSelect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isActive && !selectionMode && 'bg-accent font-medium',
        isSelected && selectionMode && 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500 font-medium text-blue-900 dark:text-blue-100'
      )}
      onClick={handleClick}
      onKeyDown={(e) => !isRenaming && e.key === 'Enter' && handleClick()}
      aria-current={isActive && !selectionMode ? 'page' : undefined}
    >
      {/* Checkbox in selection mode */}
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        />
      )}

      <FileText className={cn(
        "h-4 w-4 flex-shrink-0",
        isSelected && selectionMode ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground"
      )} />

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setNewTitle(document.title);
                setIsRenaming(false);
              }
            }}
            className="h-7 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span className="truncate">{document.title}</span>
              {document.is_pinned && (
                <Pin className="h-3 w-3 text-primary fill-primary flex-shrink-0" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {formattedDate}
            </span>
          </>
        )}
      </div>

      {/* Only show dropdown in non-selection mode */}
      {!isRenaming && !selectionMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              aria-label="Document options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {t('documentList.rename')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              {document.is_pinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  {t('documentList.unpin')}
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  {t('documentList.pin')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('documentList.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
