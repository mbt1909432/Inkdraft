'use client';

import { useTranslations } from '@/contexts/LocaleContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChatPanel } from './ChatPanel';
import { MessageSquare, X } from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';

interface MobileChatProps {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  documentId?: string;
  saveDocument?: () => void;
}

export function MobileChat({ getMarkdown, setMarkdown, documentId, saveDocument }: MobileChatProps) {
  const t = useTranslations();
  const { chatSheetOpen, setChatSheetOpen } = useMobileStore();

  return (
    <Dialog open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden relative">
          <MessageSquare className="h-5 w-5" />
          <span className="sr-only">{t('editor.aiAssistant')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[90vh] max-w-full w-full p-0 flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between p-4 border-b border-border shrink-0">
          <DialogTitle>{t('editor.aiAssistant')}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatSheetOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatPanel
            getMarkdown={getMarkdown}
            setMarkdown={setMarkdown}
            documentId={documentId}
            useAcontext={true}
            saveDocument={saveDocument}
            className="h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
