import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Document, Folder, SyncStatus, OutlineItem } from '@/lib/types';

interface DocumentStore {
  // Current document state
  currentDocument: Document | null;
  documents: Document[];
  folders: Folder[];

  // UI state
  sidebarOpen: boolean;
  outlineOpen: boolean;
  activeFolderId: string | null;
  sidebarWidth: number;
  outlineWidth: number;
  chatPanelWidth: number;

  // Sync state
  syncStatus: SyncStatus;
  lastSavedAt: Date | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;

  // Outline
  outline: OutlineItem[];

  // Document actions
  setCurrentDocument: (document: Document | null) => void;
  updateCurrentContent: (content: string) => void;
  updateCurrentTitle: (title: string) => void;
  setDocuments: (documents: Document[]) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;

  // Folder actions
  setFolders: (folders: Folder[]) => void;
  addFolder: (folder: Folder) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  setActiveFolderId: (id: string | null) => void;

  // UI actions
  toggleSidebar: () => void;
  toggleOutline: () => void;
  setSidebarOpen: (open: boolean) => void;
  setOutlineOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setOutlineWidth: (width: number) => void;
  setChatPanelWidth: (width: number) => void;
  resizeSidebarBy: (deltaPx: number) => void;
  resizeOutlineBy: (deltaPx: number) => void;
  resizeChatPanelBy: (deltaPx: number) => void;

  // Sync actions
  setSyncStatus: (status: SyncStatus) => void;
  setLastSavedAt: (date: Date | null) => void;
  setIsSaving: (saving: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;

  // Outline actions
  setOutline: (outline: OutlineItem[]) => void;
}

export const useDocumentStore = create<DocumentStore>()(
  persist(
    (set) => ({
      // Initial state
      currentDocument: null,
      documents: [],
      folders: [],
      sidebarOpen: true,
      outlineOpen: true,
      activeFolderId: null,
      sidebarWidth: 256,
      outlineWidth: 192,
      chatPanelWidth: 380,
      syncStatus: 'synced',
      lastSavedAt: null,
      isSaving: false,
      hasUnsavedChanges: false,
      outline: [],

      // Document actions
      setCurrentDocument: (document) =>
        set({ currentDocument: document, hasUnsavedChanges: false }),

      updateCurrentContent: (content) =>
        set((state) => ({
          currentDocument: state.currentDocument
            ? { ...state.currentDocument, content }
            : null,
          hasUnsavedChanges: true,
        })),

      updateCurrentTitle: (title) =>
        set((state) => ({
          currentDocument: state.currentDocument
            ? { ...state.currentDocument, title }
            : null,
          hasUnsavedChanges: true,
        })),

      setDocuments: (documents) => set({ documents }),

      addDocument: (document) =>
        set((state) => ({
          documents: [document, ...state.documents],
        })),

      updateDocument: (id, updates) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
          currentDocument:
            state.currentDocument?.id === id
              ? { ...state.currentDocument, ...updates }
              : state.currentDocument,
        })),

      deleteDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
          currentDocument:
            state.currentDocument?.id === id ? null : state.currentDocument,
        })),

      // Folder actions
      setFolders: (folders) => set({ folders }),

      addFolder: (folder) =>
        set((state) => ({
          folders: [...state.folders, folder],
        })),

      updateFolder: (id, updates) =>
        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === id ? { ...folder, ...updates } : folder
          ),
        })),

      deleteFolder: (id) =>
        set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== id),
          activeFolderId: state.activeFolderId === id ? null : state.activeFolderId,
        })),

      setActiveFolderId: (id) => set({ activeFolderId: id }),

      // UI actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleOutline: () => set((state) => ({ outlineOpen: !state.outlineOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setOutlineOpen: (open) => set({ outlineOpen: open }),
      setSidebarWidth: (width) =>
        set({ sidebarWidth: Math.min(480, Math.max(160, width)) }),
      setOutlineWidth: (width) =>
        set({ outlineWidth: Math.min(400, Math.max(120, width)) }),
      setChatPanelWidth: (width) =>
        set({ chatPanelWidth: Math.min(640, Math.max(280, width)) }),
      resizeChatPanelBy: (deltaPx) =>
        set((state) => ({
          chatPanelWidth: Math.min(
            640,
            Math.max(280, state.chatPanelWidth - deltaPx)
          ),
        })),
      resizeSidebarBy: (deltaPx) =>
        set((state) => ({
          sidebarWidth: Math.min(
            480,
            Math.max(160, state.sidebarWidth + deltaPx)
          ),
        })),
      resizeOutlineBy: (deltaPx) =>
        set((state) => ({
          outlineWidth: Math.min(
            400,
            Math.max(120, state.outlineWidth - deltaPx)
          ),
        })),

      // Sync actions
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSavedAt: (date) => set({ lastSavedAt: date }),
      setIsSaving: (saving) => set({ isSaving: saving }),
      setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

      // Outline actions
      setOutline: (outline) => set({ outline }),
    }),
    {
      name: 'document-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        outlineOpen: state.outlineOpen,
        activeFolderId: state.activeFolderId,
        sidebarWidth: state.sidebarWidth,
        outlineWidth: state.outlineWidth,
        chatPanelWidth: state.chatPanelWidth,
      }),
    }
  )
);
