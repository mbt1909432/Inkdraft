'use client';

import { useTranslations } from '@/contexts/LocaleContext';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { OutlineView } from './OutlineView';
import { ListTree } from 'lucide-react';
import { useMobileStore } from '@/lib/store/mobile-store';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function MobileOutline() {
  const t = useTranslations();
  const { outlineSheetOpen, setOutlineSheetOpen } = useMobileStore();

  return (
    <Sheet open={outlineSheetOpen} onOpenChange={setOutlineSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <ListTree className="h-5 w-5" />
          <span className="sr-only">{t('editor.outline')}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[50vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle>{t('editor.outline')}</SheetTitle>
        </SheetHeader>
        <div className="h-full overflow-auto pb-8">
          <OutlineView className="h-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
