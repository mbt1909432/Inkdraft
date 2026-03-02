'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import { useDocumentStore } from '@/lib/store/document-store';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { OutlineItem } from '@/lib/types';

interface OutlineViewProps {
  className?: string;
}

/** 某标题后是否有子标题（下一项 level 更大） */
function hasChildren(items: OutlineItem[], index: number): boolean {
  const next = items[index + 1];
  return next != null && next.level > items[index].level;
}

/** 当前项的直接父级索引（前一个 level 更小的项） */
function getParentIndex(items: OutlineItem[], index: number): number | null {
  const level = items[index].level;
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].level < level) return i;
  }
  return null;
}

/** 当前项是否在任意已折叠的祖先之下 */
function isUnderCollapsed(items: OutlineItem[], index: number, collapsedIds: Set<string>): boolean {
  let i: number | null = index;
  while (i !== null) {
    const parent = getParentIndex(items, i);
    if (parent == null) return false;
    if (collapsedIds.has(items[parent].id)) return true;
    i = parent;
  }
  return false;
}

export function OutlineView({ className }: OutlineViewProps) {
  const t = useTranslations();
  const { outline, outlineOpen } = useDocumentStore();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!outlineOpen) {
    return null;
  }

  const handleClick = (item: OutlineItem) => {
    const headings = document.querySelectorAll(
      `.markdown-editor-wrapper h${item.level}`
    );
    headings.forEach((heading) => {
      if (heading.textContent?.includes(item.text)) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  return (
    <aside
      className={cn(
        'w-full min-w-0 border-l border-border bg-background/95 p-4 overflow-y-auto',
        className
      )}
    >
      <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
        {t('editor.outline')}
      </h3>
      {outline.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('editor.outlineEmpty')}</p>
      ) : (
        <nav>
          <ul className="space-y-1">
            {outline.map((item, index) => {
              if (isUnderCollapsed(outline, index, collapsedIds)) return null;
              const hasChild = hasChildren(outline, index);
              const isCollapsed = collapsedIds.has(item.id);
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-0.5 min-w-0">
                    <button
                      type="button"
                      aria-label={isCollapsed ? t('editor.outlineExpand') : t('editor.outlineCollapse')}
                      className={cn(
                        'shrink-0 p-0.5 rounded hover:bg-accent',
                        !hasChild && 'invisible'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasChild) toggleCollapse(item.id);
                      }}
                    >
                      {hasChild ? (
                        isCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClick(item)}
                      className={cn(
                        'flex-1 text-left text-sm py-1 px-2 rounded hover:bg-accent transition-colors truncate min-w-0',
                        item.level === 1 && 'font-semibold',
                        item.level === 2 && 'pl-2',
                        item.level === 3 && 'pl-4',
                        item.level === 4 && 'pl-6',
                        item.level === 5 && 'pl-8',
                        item.level === 6 && 'pl-10'
                      )}
                    >
                      {item.text}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </aside>
  );
}
