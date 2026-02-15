'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDocumentStore } from '@/lib/store/document-store';
import type { Document } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseSyncOptions {
  enabled?: boolean;
  onDocumentChange?: (document: Document) => void;
}

export function useSync({ enabled = true, onDocumentChange }: UseSyncOptions = {}) {
  const {
    currentDocument,
    setCurrentDocument,
    updateDocument,
    setSyncStatus,
  } = useDocumentStore();

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Subscribe to realtime updates
  useEffect(() => {
    if (!enabled || !currentDocument) {
      return;
    }

    // Create channel for document updates
    const channel = supabase
      .channel(`document-${currentDocument.id}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${currentDocument.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newDoc = payload.new as unknown as Document;

          // Check if this is an external update (not from us)
          // by comparing versions
          if (newDoc.version > currentDocument.version) {
            // Update from another device/client
            setCurrentDocument(newDoc);
            updateDocument(newDoc.id, newDoc);
            onDocumentChange?.(newDoc);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setSyncStatus('synced');
        } else if (status === 'CLOSED') {
          setSyncStatus('offline');
        } else if (status === 'CHANNEL_ERROR') {
          setSyncStatus('error');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, currentDocument, setCurrentDocument, updateDocument, setSyncStatus, onDocumentChange, supabase]);

  // Check online status
  useEffect(() => {
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setSyncStatus]);

  return {
    isConnected: channelRef.current !== null,
  };
}
