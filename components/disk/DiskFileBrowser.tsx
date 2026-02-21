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
  Trash2,
  Copy,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  Image as ImageIcon,
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
}

export function DiskFileBrowser({
  documentId,
  trigger,
  onFileSelect,
}: DiskFileBrowserProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DiskFile[]>([]);
  const [directories, setDirectories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/images/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const handleCopyPath = (file: DiskFile) => {
    const markdown = `![${file.filename}](disk::${file.fullPath})`;
    navigator.clipboard.writeText(markdown);
    toast.success('Copied to clipboard');
  };

  const handlePreview = async (file: DiskFile) => {
    setPreviewLoading(true);
    setPreviewUrl(null);

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

  const handleFileSelect = (file: DiskFile) => {
    if (onFileSelect) {
      onFileSelect(`disk::${file.fullPath}`);
    }
    handleCopyPath(file);
  };

  const navigateTo = (dir: string) => {
    // Ensure path starts with /
    if (!dir.startsWith('/')) {
      dir = '/' + dir;
    }
    // Ensure path ends with /
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

  // Filter files to only show images
  const imageFiles = files.filter((file) => {
    const ext = file.filename.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '');
  });

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
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Disk Files
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <button
            onClick={() => navigateTo('/')}
            className="hover:text-foreground transition-colors"
          >
            root
          </button>
          {pathParts.map((part, index) => (
            <span key={index} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4" />
              <button
                onClick={() => navigateTo('/' + pathParts.slice(0, index + 1).join('/') + '/')}
                className="hover:text-foreground transition-colors"
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchFiles}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : imageFiles.length === 0 && directories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileImage className="h-12 w-12 mb-2" />
              <p>No images found</p>
              <p className="text-sm">Upload images in the editor to see them here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Directories */}
              {directories.map((dir) => (
                <button
                  key={dir}
                  onClick={() => navigateTo(currentPath + dir + '/')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <span>{dir}</span>
                </button>
              ))}

              {/* Files */}
              {imageFiles.map((file) => (
                <div
                  key={file.fullPath}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-12 h-12 rounded bg-muted flex items-center justify-center cursor-pointer overflow-hidden"
                    onClick={() => handlePreview(file)}
                  >
                    {previewLoading && previewUrl === null ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFileSelect(file)}
                      title="Copy markdown reference"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(file)}
                      className="text-destructive hover:text-destructive"
                      title="Delete file"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Preview */}
        {previewUrl && (
          <div className="mt-4 border rounded-lg p-2 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-48 mx-auto rounded"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
