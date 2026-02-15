'use client';

import { useCallback } from 'react';
import { useDocumentStore } from '@/lib/store/document-store';
import {
  getAllFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from '@/lib/db/folders';

export function useFolder() {
  const {
    folders,
    setFolders,
    addFolder,
    updateFolder: updateFolderInStore,
    deleteFolder: deleteFolderFromStore,
  } = useDocumentStore();

  const loadFolders = useCallback(async () => {
    try {
      const allFolders = await getAllFolders();
      setFolders(allFolders);
      return allFolders;
    } catch (error) {
      console.error('Error loading folders:', error);
      throw error;
    }
  }, [setFolders]);

  const createNewFolder = useCallback(async (name: string, parentId?: string | null) => {
    try {
      const folder = await createFolder(name, parentId);
      addFolder(folder);
      return folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }, [addFolder]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    try {
      const folder = await updateFolder(id, name);
      updateFolderInStore(id, { name });
      return folder;
    } catch (error) {
      console.error('Error renaming folder:', error);
      throw error;
    }
  }, [updateFolderInStore]);

  const removeFolder = useCallback(async (id: string) => {
    try {
      await deleteFolder(id);
      deleteFolderFromStore(id);
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }, [deleteFolderFromStore]);

  return {
    folders,
    loadFolders,
    createNewFolder,
    renameFolder,
    removeFolder,
  };
}
