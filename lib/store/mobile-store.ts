'use client';

import { create } from 'zustand';

interface MobileStore {
  // Sheet states
  sidebarSheetOpen: boolean;
  outlineSheetOpen: boolean;
  chatSheetOpen: boolean;

  // Actions
  setSidebarSheetOpen: (open: boolean) => void;
  setOutlineSheetOpen: (open: boolean) => void;
  setChatSheetOpen: (open: boolean) => void;
  toggleSidebarSheet: () => void;
  toggleOutlineSheet: () => void;
  toggleChatSheet: () => void;
  closeAllSheets: () => void;
}

export const useMobileStore = create<MobileStore>((set) => ({
  sidebarSheetOpen: false,
  outlineSheetOpen: false,
  chatSheetOpen: false,

  setSidebarSheetOpen: (open) => set({ sidebarSheetOpen: open }),
  setOutlineSheetOpen: (open) => set({ outlineSheetOpen: open }),
  setChatSheetOpen: (open) => set({ chatSheetOpen: open }),

  toggleSidebarSheet: () => set((state) => ({ sidebarSheetOpen: !state.sidebarSheetOpen, outlineSheetOpen: false, chatSheetOpen: false })),
  toggleOutlineSheet: () => set((state) => ({ outlineSheetOpen: !state.outlineSheetOpen, sidebarSheetOpen: false, chatSheetOpen: false })),
  toggleChatSheet: () => set((state) => ({ chatSheetOpen: !state.chatSheetOpen, sidebarSheetOpen: false, outlineSheetOpen: false })),

  closeAllSheets: () => set({ sidebarSheetOpen: false, outlineSheetOpen: false, chatSheetOpen: false }),
}));
