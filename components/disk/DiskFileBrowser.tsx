'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  FileImage,
  FileText,
  FileCode,
  File,
  Trash2,
  Copy,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  FileSpreadsheet,
  FileArchive,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DiskFile {
  path: string;
  filename: string;
  fullPath: string;
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown>;
}

interface DiskFileBrowserProps {
  documentId: string;
  trigger?: React.ReactNode;
  onFileSelect?: (path: string) => void;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

// Helper to get file icon and colors based on extension
function getFileTypeInfo(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return {
      icon: FileImage,
      bgColor: 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      isImage: true,
    };
  }

  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(ext)) {
    return {
      icon: FileCode,
      bgColor: 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      isImage: false,
    };
  }

  // Data files
  if (['json', 'csv', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) {
    return {
      icon: FileSpreadsheet,
      bgColor: 'bg-gradient-to-br from-cyan-100 to-teal-100 dark:from-cyan-900/30 dark:to-teal-900/30',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      isImage: false,
    };
  }

  // Archive files
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return {
      icon: FileArchive,
      bgColor: 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      isImage: false,
    };
  }

  // Text/Document files
  if (['txt', 'md', 'markdown', 'rst', 'log', 'doc', 'docx', 'pdf'].includes(ext)) {
    return {
      icon: FileText,
      bgColor: 'bg-gradient-to-br from-slate-100 to-gray-100 dark:from-slate-900/30 dark:to-gray-900/30',
      iconColor: 'text-slate-600 dark:text-slate-400',
      isImage: false,
    };
  }

  // Default
  return {
    icon: File,
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground',
    isImage: false,
  };
}

export function DiskFileBrowser({
  documentId,
  trigger,
  onFileSelect,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: DiskFileBrowserProps) {
  // Support both controlled and uncontrolled modes
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [files, setFiles] = useState<DiskFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<string | null>(null);
  const [copyingFile, setCopyingFile] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/disk/files?documentId=${encodeURIComponent(documentId)}&path=${encodeURIComponent(currentPath)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data.files || []);
      setDirectories(data.directories || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [documentId, currentPath]);

  useEffect(() => {
    if (open) {
      fetchFiles();
    }
  }, [open, fetchFiles]);

  const handleDelete = async (file: DiskFile) => {
    if (!confirm(`Delete "${file.filename}"?`)) return;

    try {
      const response = await fetch(
        `/api/disk/files?documentId=${encodeURIComponent(documentId)}&path=${encodeURIComponent(file.fullPath)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      toast.success('File deleted');
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleCopyPath = async (file: DiskFile) => {
    setCopyingFile(file.fullPath);
    try {
      const response = await fetch(
        `/api/images/url?path=${encodeURIComponent(file.fullPath)}&documentId=${encodeURIComponent(documentId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to get file URL');
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.url);
      toast.success('URL copied to clipboard');
    } catch (error) {
      console.error('Error copying file path:', error);
      toast.error('Failed to copy');
    } finally {
      setCopyingFile(null);
    }
  };

  const handlePreview = async (file: DiskFile) => {
    const typeInfo = getFileTypeInfo(file.filename);

    // Only preview images
    if (!typeInfo.isImage) {
      setPreviewingFile(file.fullPath);
      setPreviewUrl(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewingFile(file.fullPath);

    try {
      const response = await fetch(
        `/api/images/url?path=${encodeURIComponent(file.fullPath)}&documentId=${encodeURIComponent(documentId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to get image URL');
      }

      const data = await response.json();
      setPreviewUrl(data.url);
    } catch (error) {
      console.error('Error getting preview URL:', error);
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleFileSelect = async (file: DiskFile) => {
    await handleCopyPath(file);
  };

  const navigateTo = (dir: string) => {
    if (!dir.startsWith('/')) {
      dir = '/' + dir;
    }
    if (!dir.endsWith('/')) {
      dir = dir + '/';
    }
    setCurrentPath(dir);
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FolderOpen className="h-4 w-4 mr-2" />
            Disk Files
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Disk Files
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb & Toolbar */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button
              onClick={() => navigateTo('/')}
              className="hover:text-foreground transition-colors px-1"
            >
              root
            </button>
            {pathParts.map((part, index) => (
              <span key={index} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4" />
                <button
                  onClick={() => navigateTo('/' + pathParts.slice(0, index + 1).join('/') + '/')}
                  className="hover:text-foreground transition-colors px-1"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchFiles}
              disabled={loading}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="flex gap-6 min-h-[450px]">
          {/* File List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 && directories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FolderOpen className="h-16 w-16 mb-4 opacity-40" />
                <p className="text-lg font-medium mb-1">No files found</p>
                <p className="text-sm opacity-70">This folder is empty</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4 py-1">
                {/* Directories */}
                {directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => navigateTo(currentPath + dir + '/')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-accent transition-all text-left group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{dir}</p>
                      <p className="text-xs text-muted-foreground">Folder</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}

                {/* Files - All types */}
                {files.map((file) => {
                  const isThisPreviewing = previewingFile === file.fullPath;
                  const isThisCopying = copyingFile === file.fullPath;
                  const typeInfo = getFileTypeInfo(file.filename);
                  const Icon = typeInfo.icon;

                  return (
                    <div
                      key={file.fullPath}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group",
                        isThisPreviewing && previewUrl
                          ? "bg-primary/5 border-primary shadow-sm"
                          : "hover:bg-accent/50 border-transparent bg-muted/30"
                      )}
                      onClick={() => handlePreview(file)}
                    >
                      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", typeInfo.bgColor)}>
                        <Icon className={cn("h-5 w-5", typeInfo.iconColor)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.filename}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(file.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleFileSelect(file)}
                          disabled={isThisCopying}
                          className="h-8 gap-1.5"
                        >
                          {isThisCopying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Preview Panel */}
          <div className="w-72 flex-shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Preview</p>
              {previewingFile && (
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {previewingFile.split('/').pop()}
                </p>
              )}
            </div>
            <div className="flex-1 rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 flex items-center justify-center overflow-hidden transition-all">
              {previewLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Loading...</p>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-contain p-2"
                />
              ) : previewingFile ? (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                    <File className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Preview not available
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Only images can be previewed
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-2">
                    <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select a file to preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
