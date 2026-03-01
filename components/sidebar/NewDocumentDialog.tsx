'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/contexts/LocaleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, FileText } from 'lucide-react';

interface NewDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => Promise<void>;
  defaultTitle?: string;
}

export function NewDocumentDialog({
  open,
  onOpenChange,
  onCreate,
  defaultTitle = '',
}: NewDocumentDialogProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(defaultTitle);
  const [isCreating, setIsCreating] = useState(false);

  // Reset title when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
    }
  }, [open, defaultTitle]);

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      await onCreate(title.trim());
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating && title.trim()) {
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('documents.createDocument')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">{t('editor.draftModal.title')}</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('documents.blankDocument')}
              disabled={isCreating}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            {t('settings.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('auth.processing')}
              </>
            ) : (
              t('documents.createDocument')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
