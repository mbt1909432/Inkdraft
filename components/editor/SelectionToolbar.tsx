'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useCellValues,
  usePublisher,
  activeEditor$,
  currentSelection$,
  readOnly$,
  viewMode$,
  insertMarkdown$,
  getSelectionRectangle,
} from '@mdxeditor/editor';
import { getSelectionAsMarkdown } from '@/lib/editor/getSelectionAsMarkdown';
import { $getSelection, $isRangeSelection } from 'lexical';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';

const TOOLBAR_OFFSET = 10;
const ACTIONS: { id: string; label: string }[] = [
  { id: 'polish', label: '润色' },
  { id: 'expand', label: '扩写' },
  { id: 'shrink', label: '缩写' },
  { id: 'translate', label: '翻译' },
  { id: 'summarize', label: '总结' },
  { id: 'correct', label: '纠错' },
];

type ToolbarState = {
  text: string;
  rect: { top: number; left: number; width: number; height: number };
} | null;

export function SelectionToolbar() {
  const [selection, activeEditor, readOnly, viewMode] = useCellValues(
    currentSelection$,
    activeEditor$,
    readOnly$,
    viewMode$
  );
  const insertMarkdown = usePublisher(insertMarkdown$);

  const [toolbarState, setToolbarState] = useState<ToolbarState>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    if (
      readOnly ||
      viewMode !== 'rich-text' ||
      !activeEditor ||
      !selection ||
      !$isRangeSelection(selection) ||
      selection.isCollapsed()
    ) {
      setToolbarState(null);
      return;
    }

    // Lexical state helpers must run inside editor.read() synchronously
    let text = '';
    let rect: { top: number; left: number; width: number; height: number } | null = null;
    try {
      activeEditor.getEditorState().read(() => {
        text = getSelectionAsMarkdown(activeEditor);
        rect = getSelectionRectangle(activeEditor);
      });
    } catch {
      setToolbarState(null);
      return;
    }

    if (!text?.trim() || !rect) {
      setToolbarState(null);
      return;
    }

    setToolbarState({ text, rect });
  }, [selection, activeEditor, readOnly, viewMode]);

  const runAction = useCallback(
    async (action: string) => {
      if (!toolbarState || !activeEditor) return;

      setLoadingAction(action);
      try {
        const res = await fetch('/api/ai/text-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            text: toolbarState.text,
            ...(action === 'translate' ? { options: { targetLang: '英文' } } : {}),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error ?? 'Request failed');
        }

        const resultText = data.text;
        if (typeof resultText !== 'string') {
          throw new Error('Invalid response');
        }

        // 用 insertMarkdown 解析并插入为真实节点（标题、段落等），导出时不会变成 \# \*\*
        insertMarkdown(resultText);
        setToolbarState(null);

        // 润色后把焦点设回编辑器，否则再次框选时选区可能不触发工具栏
        setTimeout(() => {
          activeEditor?.focus();
        }, 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-alert
        alert(message);
      } finally {
        setLoadingAction(null);
      }
    },
    [toolbarState, insertMarkdown, activeEditor]
  );

  const style = useMemo(() => {
    if (!toolbarState) return undefined;
    const { rect } = toolbarState;
    const toolbarHeight = 40;
    const toolbarWidth = 320;
    const top = rect.top - toolbarHeight - TOOLBAR_OFFSET;
    const left = Math.max(
      8,
      Math.min(
        window.innerWidth - toolbarWidth - 8,
        rect.left + rect.width / 2 - toolbarWidth / 2
      )
    );
    return {
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${toolbarWidth}px`,
      zIndex: 1000,
    };
  }, [toolbarState]);

  if (!toolbarState || typeof document === 'undefined') return null;

  const toolbar = (
    <div
      role="toolbar"
      aria-label="选中文本操作"
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-popover px-2 py-1.5 shadow-md',
        'border-border text-popover-foreground'
      )}
      style={style}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-wrap items-center gap-1">
        {ACTIONS.map(({ id, label }) => (
          <Button
            key={id}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!!loadingAction}
            onClick={() => runAction(id)}
          >
            {loadingAction === id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              label
            )}
          </Button>
        ))}
      </div>
    </div>
  );

  return createPortal(toolbar, document.body);
}
