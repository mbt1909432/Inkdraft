'use client';

import { useTranslations } from '@/contexts/LocaleContext';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileStore } from '@/lib/store/mobile-store';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface MobileSidebarProps {
  onCreateDocument?: (folderId?: string | null, template?: { name: string; content: string }) => Promise<void>;
  onCreateFolder?: (parentId?: string | null) => Promise<void>;
  onDeleteDocument?: (id: string) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onRenameFolder?: (id: string, name: string) => Promise<void>;
  onRenameDocument?: (id: string, title: string) => Promise<void>;
  onSelectDocument?: (id: string) => void;
}

export function MobileSidebar({
  onCreateDocument,
  onCreateFolder,
  onDeleteDocument,
  onDeleteFolder,
  onRenameFolder,
  onRenameDocument,
  onSelectDocument,
}: MobileSidebarProps) {
  const t = useTranslations();
  const { sidebarSheetOpen, setSidebarSheetOpen } = useMobileStore();

  const handleSelectDocument = (id: string) => {
    onSelectDocument?.(id);
    setSidebarSheetOpen(false); // Close sheet after selection
  };

  return (
    <Sheet open={sidebarSheetOpen} onOpenChange={setSidebarSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t('sidebar.allDocuments')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0 max-w-[85vw]">
        <VisuallyHidden>
          <SheetTitle>{t('sidebar.allDocuments')}</SheetTitle>
        </VisuallyHidden>
        <Sidebar
          onCreateDocument={onCreateDocument}
          onCreateFolder={onCreateFolder}
          onDeleteDocument={onDeleteDocument}
          onDeleteFolder={onDeleteFolder}
          onRenameFolder={onRenameFolder}
          onRenameDocument={onRenameDocument}
          onSelectDocument={handleSelectDocument}
        />
      </SheetContent>
    </Sheet>
  );
}
