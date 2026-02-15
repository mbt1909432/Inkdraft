'use client';

import { useTranslations } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ListTree,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onDraft?: () => void;
}

export function MobileBottomNav({ onDraft }: MobileBottomNavProps) {
  const t = useTranslations();
  const {
    sidebarSheetOpen,
    outlineSheetOpen,
    chatSheetOpen,
    toggleSidebarSheet,
    toggleOutlineSheet,
    toggleChatSheet,
  } = useMobileStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {/* 文档列表 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex-1 h-full rounded-none flex flex-col gap-0.5 px-2',
            sidebarSheetOpen && 'bg-accent text-accent-foreground'
          )}
          onClick={toggleSidebarSheet}
        >
          <FileText className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('sidebar.allDocuments').slice(0, 2)}</span>
        </Button>

        {/* 大纲 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex-1 h-full rounded-none flex flex-col gap-0.5 px-2',
            outlineSheetOpen && 'bg-accent text-accent-foreground'
          )}
          onClick={toggleOutlineSheet}
        >
          <ListTree className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('editor.outline').slice(0, 2)}</span>
        </Button>

        {/* AI 起稿 */}
        {onDraft && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-full rounded-none flex flex-col gap-0.5 px-2 text-primary"
            onClick={onDraft}
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t('editor.draft').slice(0, 2)}</span>
          </Button>
        )}

        {/* AI 助手 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex-1 h-full rounded-none flex flex-col gap-0.5 px-2',
            chatSheetOpen && 'bg-accent text-accent-foreground'
          )}
          onClick={toggleChatSheet}
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-[10px] font-medium">AI</span>
        </Button>
      </div>
    </nav>
  );
}
