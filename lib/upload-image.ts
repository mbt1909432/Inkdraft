/**
 * Image upload: Prioritizes Acontext Disk upload, falls back to Supabase Storage,
 * and finally to Data URL inline if all else fails.
 */

import { createClient } from '@/lib/supabase/client';

const BUCKET = 'images';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a URL is a disk:: protocol URL
 */
export function isDiskUrl(url: string): boolean {
  return url.startsWith('disk::');
}

/**
 * Parse disk:: URL to get the path
 * disk::images/xxx.png -> images/xxx.png
 */
export function parseDiskUrl(url: string): string | null {
  if (!isDiskUrl(url)) return null;
  return url.slice(6); // Remove "disk::" prefix
}

/**
 * Convert disk:: URL to proxy URL for rendering
 */
export function diskUrlToProxyUrl(diskUrl: string, documentId: string): string {
  const path = parseDiskUrl(diskUrl);
  if (!path) return diskUrl;
  return `/api/images/proxy?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}`;
}

/**
 * Upload image - tries Acontext Disk first, then Supabase, then Data URL
 */
export async function uploadImage(file: File, documentId?: string): Promise<string> {
  // Try Acontext Disk upload first (only if documentId is provided)
  if (documentId) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentId', documentId);

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[upload-image] Uploaded to Acontext Disk:', data.url);
        return data.url;
      }

      // Log error but continue to fallback
      const errorData = await response.json().catch(() => ({}));
      console.warn('[upload-image] Acontext Disk upload failed:', errorData);
    } catch (error) {
      console.warn('[upload-image] Acontext Disk upload error:', error);
    }
  }

  // Fallback to Supabase Storage
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) ? ext : 'png';
    const path = documentId
      ? `${user.id}/${documentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
      : `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || `image/${safeExt}`,
      upsert: false,
    });

    if (!error && data?.path) {
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      console.log('[upload-image] Uploaded to Supabase Storage:', publicUrl);
      return publicUrl;
    }
    // Bucket not configured or permission denied - silent fallback to Data URL
    console.warn('[upload-image] Supabase Storage upload failed:', error);
  }

  // Final fallback: Data URL
  console.log('[upload-image] Falling back to Data URL');
  return fileToDataUrl(file);
}

/**
 * Get public URL for a disk:: image
 * Returns null if not a disk URL or if fetch fails
 */
export async function getDiskPublicUrl(
  diskUrl: string,
  documentId: string
): Promise<string | null> {
  const path = parseDiskUrl(diskUrl);
  if (!path) return null;

  try {
    const response = await fetch(
      `/api/images/url?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}`
    );

    if (response.ok) {
      const data = await response.json();
      return data.url;
    }
  } catch (error) {
    console.warn('[upload-image] Failed to get disk public URL:', error);
  }

  return null;
}
