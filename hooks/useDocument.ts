'use client';

import { useCallback } from 'react';
import { useDocumentStore } from '@/lib/store/document-store';
import {
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  toggleDocumentPin,
} from '@/lib/db/documents';
import type { Document } from '@/lib/types';

/** 在已有文档中选取下一个未占用的 "Untitled" / "Untitled 1" / "Untitled 2" ... */
function getNextUntitledTitle(documents: Document[]): string {
  const used = new Set<number>();
  for (const doc of documents) {
    if (doc.title === 'Untitled') {
      used.add(0);
    } else {
      const m = doc.title.match(/^Untitled (\d+)$/);
      if (m) used.add(parseInt(m[1], 10));
    }
  }
  let n = 0;
  while (used.has(n)) n++;
  return n === 0 ? 'Untitled' : `Untitled ${n}`;
}

export function useDocument() {
  const {
    currentDocument,
    documents,
    setCurrentDocument,
    setDocuments,
    addDocument,
    updateDocument: updateDocInStore,
    deleteDocument: deleteDocFromStore,
    setHasUnsavedChanges,
  } = useDocumentStore();

  const loadDocuments = useCallback(async (folderId?: string | null) => {
    try {
      const docs = await getDocuments(folderId);
      setDocuments(docs);
      return docs;
    } catch (error) {
      console.error('Error loading documents:', error);
      throw error;
    }
  }, [setDocuments]);

  const loadDocument = useCallback(async (id: string) => {
    try {
      const doc = await getDocument(id);
      if (doc) {
        setCurrentDocument(doc);
        setHasUnsavedChanges(false);
      }
      return doc;
    } catch (error) {
      console.error('Error loading document:', error);
      throw error;
    }
  }, [setCurrentDocument, setHasUnsavedChanges]);

  const createNewDocument = useCallback(async (folderId?: string | null) => {
    const nextTitle = getNextUntitledTitle(documents);
    try {
      const doc = await createDocument({
        title: nextTitle,
        content: '',
        parent_folder_id: folderId,
      });
      addDocument(doc);
      setCurrentDocument(doc);
      setHasUnsavedChanges(false);
      return doc;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }, [documents, addDocument, setCurrentDocument, setHasUnsavedChanges]);

  const saveDocument = useCallback(async () => {
    if (!currentDocument) return null;

    try {
      const updatedDoc = await updateDocument(currentDocument.id, {
        title: currentDocument.title,
        content: currentDocument.content,
      });
      updateDocInStore(currentDocument.id, updatedDoc);
      setHasUnsavedChanges(false);
      return updatedDoc;
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  }, [currentDocument, updateDocInStore, setHasUnsavedChanges]);

  const removeDocument = useCallback(async (id: string) => {
    try {
      await deleteDocument(id);
      deleteDocFromStore(id);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }, [deleteDocFromStore]);

  const pinDocument = useCallback(async (id: string) => {
    try {
      const updatedDoc = await toggleDocumentPin(id);
      updateDocInStore(id, { is_pinned: updatedDoc.is_pinned });
      return updatedDoc;
    } catch (error) {
      console.error('Error pinning document:', error);
      throw error;
    }
  }, [updateDocInStore]);

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      if (!title.trim()) return;
      try {
        const updatedDoc = await updateDocument(id, { title: title.trim() });
        updateDocInStore(id, {
          title: updatedDoc.title,
          last_edited_at: updatedDoc.last_edited_at,
          updated_at: updatedDoc.updated_at,
          version: updatedDoc.version,
        });
        if (currentDocument?.id === id) {
          setCurrentDocument({
            ...currentDocument,
            title: updatedDoc.title,
            last_edited_at: updatedDoc.last_edited_at,
            updated_at: updatedDoc.updated_at,
            version: updatedDoc.version,
          });
        }
        return updatedDoc;
      } catch (error) {
        console.error('Error renaming document:', error);
        throw error;
      }
    },
    [currentDocument, updateDocInStore, setCurrentDocument]
  );

  return {
    currentDocument,
    documents,
    loadDocuments,
    loadDocument,
    createNewDocument,
    saveDocument,
    removeDocument,
    pinDocument,
    renameDocument,
  };
}
