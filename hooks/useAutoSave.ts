'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore } from '@/lib/store/document-store';
import { updateDocument } from '@/lib/db/documents';

interface UseAutoSaveOptions {
  interval?: number; // milliseconds
  enabled?: boolean;
  onSave?: () => void;
  onError?: (error: Error) => void;
  /** 开始保存时调用（用于显示「正在保存」提示） */
  onSavingStart?: () => void;
  /** 保存成功时调用（用于显示「已保存」提示） */
  onSaveSuccess?: () => void;
  /** 保存失败时调用（用于显示「保存失败」提示） */
  onSaveError?: () => void;
}

export function useAutoSave({
  interval = 30000, // 30 seconds default
  enabled = true,
  onSave,
  onError,
  onSavingStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions = {}) {
  const {
    currentDocument,
    hasUnsavedChanges,
    isSaving,
    setIsSaving,
    setLastSavedAt,
    setHasUnsavedChanges,
    setSyncStatus,
    updateDocument: updateDocInStore,
  } = useDocumentStore();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async () => {
    if (!currentDocument || !hasUnsavedChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setSyncStatus('syncing');
    onSavingStart?.();

    try {
      const updatedDoc = await updateDocument(currentDocument.id, {
        title: currentDocument.title,
        content: currentDocument.content,
      });

      updateDocInStore(currentDocument.id, {
        version: updatedDoc.version,
        last_edited_at: updatedDoc.last_edited_at,
        updated_at: updatedDoc.updated_at,
      });

      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      setSyncStatus('synced');
      onSave?.();
      onSaveSuccess?.();
    } catch (error) {
      console.error('Auto-save error:', error);
      setSyncStatus('error');
      onError?.(error instanceof Error ? error : new Error('Save failed'));
      onSaveError?.();
    } finally {
      setIsSaving(false);
    }
  }, [
    currentDocument,
    hasUnsavedChanges,
    isSaving,
    setIsSaving,
    setSyncStatus,
    updateDocInStore,
    setLastSavedAt,
    setHasUnsavedChanges,
    onSave,
    onError,
    onSavingStart,
    onSaveSuccess,
    onSaveError,
  ]);

  // Set up auto-save timer
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = setTimeout(() => {
      save();
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, hasUnsavedChanges, interval, save]);

  // Save on document change (when switching documents)
  useEffect(() => {
    return () => {
      // Save before unmount or document change
      if (hasUnsavedChanges && currentDocument) {
        save();
      }
    };
  }, [currentDocument?.id]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return { save, isSaving };
}
