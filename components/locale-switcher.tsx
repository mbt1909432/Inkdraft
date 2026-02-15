'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/lib/i18n';

const LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'EN',
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Language">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('zh')}>
          {LABELS.zh}
          {locale === 'zh' && ' ✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('en')}>
          {LABELS.en}
          {locale === 'en' && ' ✓'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
