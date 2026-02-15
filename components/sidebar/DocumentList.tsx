'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, MoreHorizontal, Pin, PinOff, Trash2, Edit2 } from 'lucide-react';
import type { Document } from '@/lib/types';

interface DocumentListProps {
  documents: Document[];
  currentDocumentId?: string;
  onSelectDocument?: (id: string) => void;
  onDeleteDocument?: (id: string) => Promise<void>;
  onTogglePin?: (id: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
}

export function DocumentList({
  documents,
  currentDocumentId,
  onSelectDocument,
  onDeleteDocument,
  onTogglePin,
  onRenameDocument,
}: DocumentListProps) {
  // Sort: pinned first, then by last edited
  const sortedDocuments = [...documents].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.last_edited_at).getTime() - new Date(a.last_edited_at).getTime();
  });

  if (sortedDocuments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No documents yet
      </div>
    );
  }

  return (
    <ul className="space-y-0.5">
      {sortedDocuments.map((doc) => (
        <li key={doc.id}>
          <DocumentItem
            document={doc}
            isActive={doc.id === currentDocumentId}
            onSelect={() => onSelectDocument?.(doc.id)}
            onDelete={() => onDeleteDocument?.(doc.id)}
            onTogglePin={() => onTogglePin?.(doc.id)}
            onRename={onRenameDocument ? (title) => onRenameDocument(doc.id, title) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

interface DocumentItemProps {
  document: Document;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename?: (title: string) => Promise<void>;
}

function DocumentItem({
  document,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
  onRename,
}: DocumentItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(document.title);
  useEffect(() => {
    setNewTitle(document.title);
  }, [document.title]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleRename = async () => {
    if (onRename && newTitle.trim() && newTitle !== document.title) {
      await onRename(newTitle.trim());
    }
    setNewTitle(document.title);
    setIsRenaming(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer hover:bg-accent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isActive && 'bg-accent font-medium'
      )}
      onClick={isRenaming ? undefined : () => {
        console.log('[DocumentList] onClick triggered');
        onSelect();
      }}
      onKeyDown={(e) => !isRenaming && e.key === 'Enter' && onSelect()}
      aria-current={isActive ? 'page' : undefined}
    >
      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

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
              {formatDate(document.last_edited_at)}
            </span>
          </>
        )}
      </div>

      {!isRenaming && (
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
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                重命名
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onTogglePin}>
              {document.is_pinned ? (
                <>
                  <PinOff className="h-4 w-4 mr-2" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 mr-2" />
                  Pin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
