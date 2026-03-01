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
        console.log('[useSync] Realtime subscription status:', status);
        // Only set synced if subscribed, don't override with offline/error
        // based on realtime status - the browser's online/offline events
        // are more reliable for connectivity status
        if (status === 'SUBSCRIBED') {
          setSyncStatus('synced');
        }
        // Don't set offline/error based on realtime status
        // Realtime can fail even when user is online
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, currentDocument, setCurrentDocument, updateDocument, setSyncStatus, onDocumentChange, supabase]);

  // Check online status - this is the primary source of truth for connectivity
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useSync] Browser online event');
      setSyncStatus('synced');
    };
    const handleOffline = () => {
      console.log('[useSync] Browser offline event');
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status based on browser connectivity
    const initialStatus = navigator.onLine ? 'synced' : 'offline';
    console.log('[useSync] Initial status:', initialStatus, 'navigator.onLine:', navigator.onLine);
    setSyncStatus(initialStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setSyncStatus]);

  return {
    isConnected: channelRef.current !== null,
  };
}
