'use client';

import { Loader2, Check, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export type SaveToastType = 'saving' | 'saved' | 'error' | null;

interface SaveToastProps {
  type: SaveToastType;
  className?: string;
}

export function SaveToast({ type, className }: SaveToastProps) {
  const t = useTranslations();
  if (!type) return null;

  const config = {
    saving: {
      icon: Loader2,
      text: t('saveToast.saving'),
      className: 'bg-muted text-foreground',
      iconClassName: 'animate-spin',
    },
    saved: {
      icon: Check,
      text: t('saveToast.saved'),
      className: 'bg-primary text-primary-foreground',
      iconClassName: '',
    },
    error: {
      icon: AlertCircle,
      text: t('saveToast.error'),
      className: 'bg-destructive text-destructive-foreground',
      iconClassName: '',
    },
  };

  const { icon: Icon, text, className: stateClass, iconClassName } = config[type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium',
        'animate-fade-in',
        stateClass,
        className
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', iconClassName)} aria-hidden />
      <span>{text}</span>
    </div>
  );
}
