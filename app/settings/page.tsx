'use client';

import { useLocale } from '@/contexts/LocaleContext';
import { ApiKeyManager } from '@/components/settings/ApiKeyManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/documents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              {t('settings.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('settings.description')}
            </p>
          </div>
        </div>

        {/* Language Settings */}
        <div className="mb-6 p-4 border rounded-lg">
          <h2 className="font-medium mb-3">{t('settings.language')}</h2>
          <div className="flex gap-2">
            <Button
              variant={locale === 'zh' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLocale('zh')}
            >
              中文
            </Button>
            <Button
              variant={locale === 'en' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLocale('en')}
            >
              English
            </Button>
          </div>
        </div>

        {/* API Keys */}
        <ApiKeyManager />

        {/* API Documentation Link */}
        <div className="mt-6 p-4 border rounded-lg">
          <h2 className="font-medium mb-2">{t('settings.apiDoc')}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t('settings.apiDocDesc')}
          </p>
          <Link href="/docs/api">
            <Button variant="outline" size="sm">
              {t('settings.viewApiDocs')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
