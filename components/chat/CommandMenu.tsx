'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FileQuestion, FileText, Languages, Sparkles, Square } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  params?: string;
}

export const COMMANDS: Command[] = [
  {
    id: 'quiz',
    label: '@quiz',
    description: '生成测验题目',
    icon: <FileQuestion className="h-4 w-4" />,
    params: '数量（可选，如 @quiz 5）',
  },
  {
    id: 'summarize',
    label: '@summarize',
    description: '总结文档要点',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'translate',
    label: '@translate',
    description: '翻译文档内容',
    icon: <Languages className="h-4 w-4" />,
    params: '目标语言（如 @translate 英语）',
  },
  {
    id: 'polish',
    label: '@polish',
    description: '润色优化文字',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'xiaohongshu',
    label: '@xiaohongshu',
    description: '生成小红书卡片',
    icon: <Square className="h-4 w-4 text-pink-500" />,
    params: '主题或文案（如 @xiaohongshu 咖啡店探店）',
  },
];

interface CommandMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  filter: string;
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export function CommandMenu({ isOpen, position, filter, onSelect, onClose }: CommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands based on input
  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(filter.toLowerCase()) ||
    cmd.description.includes(filter)
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredCommands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[240px] rounded-lg border bg-popover p-1 shadow-md"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-100%)',
      }}
    >
      <div className="text-xs text-muted-foreground px-2 py-1.5 border-b mb-1">
        快捷命令 · 输入 @ 触发
      </div>
      {filteredCommands.map((cmd, idx) => (
        <button
          key={cmd.id}
          onClick={() => onSelect(cmd)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'transition-colors',
            idx === selectedIndex && 'bg-accent text-accent-foreground'
          )}
        >
          <span className="text-muted-foreground">{cmd.icon}</span>
          <span className="font-medium">{cmd.label}</span>
          <span className="text-muted-foreground text-xs ml-auto truncate max-w-[100px]">
            {cmd.description}
          </span>
        </button>
      ))}
      {/* Show selected command details */}
      {filteredCommands[selectedIndex]?.params && (
        <div className="text-xs text-blue-500 dark:text-blue-400 px-2 py-1 border-t mt-1">
          参数: {filteredCommands[selectedIndex].params}
        </div>
      )}
      <div className="text-xs text-muted-foreground px-2 py-1.5 border-t mt-1 flex gap-2">
        <span>↑↓ 选择</span>
        <span>↵ 确认</span>
        <span>ESC 关闭</span>
      </div>
    </div>
  );
}

// Hook for command detection
export function useCommandDetection(
  input: string,
  cursorPosition: number
): { showMenu: boolean; commandFilter: string; atIndex: number } {
  // Find @ before cursor
  let atIndex = -1;
  let showMenu = false;
  let commandFilter = '';

  if (input.includes('@')) {
    // Find the last @ before cursor position
    const beforeCursor = input.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check if there's a space between @ and cursor (which would cancel the menu)
      const afterAt = beforeCursor.substring(lastAtIndex + 1);
      if (!afterAt.includes(' ')) {
        atIndex = lastAtIndex;
        showMenu = true;
        commandFilter = afterAt;
      }
    }
  }

  return { showMenu, commandFilter, atIndex };
}
