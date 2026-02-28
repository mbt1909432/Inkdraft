'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraft: (markdown: string) => void;
  currentTitle?: string;
  currentContent?: string;
}

export function DraftModal({
  open,
  onOpenChange,
  onDraft,
  currentTitle = '',
  currentContent = '',
}: DraftModalProps) {
  const t = useTranslations();
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftResult, setDraftResult] = useState<string | null>(null);

  // Sync title when modal opens
  useEffect(() => {
    if (open && currentTitle) {
      setDraftTitle(currentTitle);
      setDraftInstruction('');
      setDraftResult(null);
    }
  }, [open, currentTitle]);

  const closeDialog = () => {
    if (!isDrafting) {
      onOpenChange(false);
      setDraftResult(null);
    }
  };

  const handleDraftSubmit = async () => {
    const title = draftTitle.trim();
    if (!title) return;

    setIsDrafting(true);
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          instruction: draftInstruction.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.markdown) {
        throw new Error(data.error || 'Draft failed');
      }

      setDraftResult(data.markdown);
    } catch (error) {
      console.error('Draft error:', error);
      throw error;
    } finally {
      setIsDrafting(false);
    }
  };

  const handleAcceptDraft = () => {
    if (draftResult) {
      onDraft(draftResult);
      onOpenChange(false);
      setDraftResult(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={() => !isDrafting && closeDialog()}
    >
      <div
        className={cn(
          'rounded-lg border border-border bg-background shadow-lg flex flex-col max-h-[90vh]',
          draftResult !== null
            ? 'w-full max-w-4xl p-4 gap-4'
            : 'w-full max-w-md p-4 gap-4'
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && closeDialog()}
      >
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">
            {draftResult !== null
              ? t('editor.draftModal.compareAndChoose')
              : t('editor.draftModal.draft')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeDialog}
            disabled={isDrafting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {draftResult === null ? (
          /* Step 1: Fill title and instruction */
          <>
            <p className="text-sm text-muted-foreground shrink-0">
              {t('editor.draftModal.description')}
            </p>
            <div className="grid gap-2 shrink-0">
              <Label htmlFor="draft-title">{t('editor.draftModal.title')}</Label>
              <Input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={t('editor.draftModal.docTitle')}
                disabled={isDrafting}
              />
            </div>
            <div className="grid gap-2 shrink-0">
              <Label htmlFor="draft-instruction">{t('editor.draftModal.instruction')}</Label>
              <textarea
                id="draft-instruction"
                value={draftInstruction}
                onChange={(e) => setDraftInstruction(e.target.value)}
                placeholder={t('editor.draftModal.instructionPlaceholder')}
                disabled={isDrafting}
                rows={3}
                className={cn(
                  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]'
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={closeDialog} disabled={isDrafting}>
                {t('editor.draftModal.cancel')}
              </Button>
              <Button
                onClick={handleDraftSubmit}
                disabled={isDrafting || !draftTitle.trim()}
                aria-busy={isDrafting}
              >
                {isDrafting ? (
                  <>
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin mr-2" />
                    {t('editor.draftModal.generating')}
                  </>
                ) : (
                  t('editor.draftModal.draft')
                )}
              </Button>
            </div>
          </>
        ) : (
          /* Step 2: Compare and choose */
          <>
            <p className="text-sm text-muted-foreground shrink-0">
              {t('editor.draftModal.compareHint')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-auto">
              <div className="flex flex-col gap-2 min-h-0">
                <Label className="text-muted-foreground font-medium">
                  {t('editor.draftModal.currentDoc')}
                </Label>
                <textarea
                  readOnly
                  value={currentContent}
                  className={cn(
                    'flex-1 min-h-[150px] md:min-h-[200px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono',
                    'resize-none focus:outline-none'
                  )}
                />
              </div>
              <div className="flex flex-col gap-2 min-h-0">
                <Label className="text-muted-foreground font-medium">
                  {t('editor.draftModal.draftResult')}
                </Label>
                <textarea
                  readOnly
                  value={draftResult}
                  className={cn(
                    'flex-1 min-h-[150px] md:min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono',
                    'resize-none focus:outline-none'
                  )}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 shrink-0">
              <Button variant="outline" onClick={closeDialog}>
                {t('editor.draftModal.discard')}
              </Button>
              <Button onClick={handleAcceptDraft}>
                {t('editor.draftModal.acceptAndReplace')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
