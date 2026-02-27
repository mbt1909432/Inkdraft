'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Locale, Messages } from '@/lib/i18n';
import { getByPath, getLocaleFromCookie, setLocaleCookie } from '@/lib/i18n';

import zh from '@/locales/zh.json';
import en from '@/locales/en.json';

const messagesMap: Record<Locale, Messages> = {
  zh: zh as Messages,
  en: en as Messages,
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getLocaleFromCookie());
    setMounted(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setLocaleCookie(next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      if (!mounted) return key;
      const msg = messagesMap[locale];
      const value = getByPath(msg, key, locale);
      return value ?? key;
    },
    [locale, mounted]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useTranslations() {
  const { t } = useLocale();
  return t;
}
