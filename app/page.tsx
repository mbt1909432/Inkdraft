'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Loader2,
  Github,
  MessageSquare,
  CheckSquare,
  RefreshCw,
  PenLine,
  Cloud,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useTranslations } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      router.push('/documents');
    }
    setIsLoading(false);
  };

  const handleGithubLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleEmailLogin = () => {
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-5xl">
          <a href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <PenLine className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">{t('common.brand')}</span>
          </a>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {t('home.hero.title')}
            </h1>
            <p className="text-xl md:text-2xl text-primary font-medium mb-2">
              {t('home.hero.tagline')}
            </p>
            <p className="text-muted-foreground text-lg mb-10">
              {t('home.hero.taglineEn')}
            </p>
            <p className="text-muted-foreground mb-10 text-base leading-relaxed">
              {t('home.hero.intro')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="text-base px-8"
                onClick={handleGithubLogin}
              >
                <Github className="h-4 w-4 mr-2" />
                {t('home.loginGithub')}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8"
                onClick={handleEmailLogin}
              >
                {t('home.loginEmail')}
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/60 bg-muted/30">
          <div className="container mx-auto px-4 py-16 max-w-5xl">
            <h2 className="text-2xl font-semibold text-center mb-10">
              {t('home.features.title')}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<PenLine className="h-5 w-5" />}
                title={t('home.features.wysiwyg.title')}
                description={t('home.features.wysiwyg.description')}
              />
              <FeatureCard
                icon={<MessageSquare className="h-5 w-5" />}
                title={t('home.features.aiAssistant.title')}
                description={t('home.features.aiAssistant.description')}
              />
              <FeatureCard
                icon={<CheckSquare className="h-5 w-5" />}
                title={t('home.features.perEdit.title')}
                description={t('home.features.perEdit.description')}
              />
              <FeatureCard
                icon={<RefreshCw className="h-5 w-5" />}
                title={t('home.features.retry.title')}
                description={t('home.features.retry.description')}
              />
            </div>
          </div>
        </section>

        {/* Secondary CTA */}
        <section className="container mx-auto px-4 py-16 max-w-5xl">
          <div className="text-center rounded-2xl border border-border bg-card p-10 md:p-14">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">{t('home.cta.title')}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('home.cta.desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={handleGithubLogin}>
                <Github className="h-4 w-4 mr-2" />
                {t('home.loginGithub')}
              </Button>
              <Button size="lg" variant="outline" onClick={handleEmailLogin}>
                {t('home.loginEmail')}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6">
        <div className="container mx-auto px-4 max-w-5xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Cloud className="h-4 w-4" />
              {t('home.footer.sync')}
            </span>
            <span>{t('home.footer.brand')}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm text-muted-foreground pt-2 border-t border-border/40">
            <span>{t('home.footer.author')}</span>
            <span className="flex items-center gap-4">
              <a
                href="https://github.com/mbt1909432"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
                {t('home.footer.github')}
              </a>
              <a
                href="https://www.xiaohongshu.com/user/profile/5f6da2890000000001005f0c"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                aria-label="Xiaohongshu"
              >
                {t('home.footer.xiaohongshu')}
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-background p-5 text-left transition-colors hover:border-border',
        className
      )}
    >
      <div className="flex items-center gap-2 text-primary mb-3">{icon}</div>
      <h3 className="font-medium mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </div>
  );
}
