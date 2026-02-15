export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: string;
  parent_folder_id: string | null;
  is_pinned: boolean;
  version: number;
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  theme: 'light' | 'dark' | 'sepia' | 'system';
  auto_save_enabled: boolean;
  show_outline: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutlineItem {
  id: string;
  level: number;
  text: string;
  line?: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface EditorState {
  currentDocument: Document | null;
  documents: Document[];
  folders: Folder[];
  sidebarOpen: boolean;
  outlineOpen: boolean;
  syncStatus: SyncStatus;
  lastSavedAt: Date | null;
  isSaving: boolean;
}
