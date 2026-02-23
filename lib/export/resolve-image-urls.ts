/**
 * Resolve image URLs for export (Word/PDF)
 * Converts disk:: and /api/images/proxy URLs to data:image URLs for permanent embedding
 */

/**
 * Clean path - remove trailing backslashes and other artifacts
 */
function cleanPath(path: string): string {
  // Remove trailing backslash (from escaped & in markdown)
  return path.replace(/\\+$/, '').trim();
}

/**
 * Fetch image and convert to data URL
 * Uses proxy API to avoid CORS issues
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    // Try direct fetch first
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[fetchImageAsDataUrl] Direct fetch failed, CORS likely:', error);
    return null;
  }
}

/**
 * Fetch image via proxy and convert to data URL
 */
async function fetchImageViaProxyAsDataUrl(path: string, documentId: string): Promise<string | null> {
  try {
    // Use our proxy API with download=true to get actual image data
    // This avoids CORS issues with S3 redirects
    const proxyUrl = `/api/images/proxy?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}&download=true`;
    const response = await fetch(proxyUrl, {
      credentials: 'include', // Include cookies for authentication
    });
    if (!response.ok) {
      console.warn('[fetchImageViaProxyAsDataUrl] Response not OK:', response.status);
      return null;
    }

    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[fetchImageViaProxyAsDataUrl] Failed:', error);
    return null;
  }
}

/**
 * Client-side: Pre-process markdown to resolve all image URLs to data URLs
 * This ensures images are permanently embedded in exported documents
 */
export async function resolveImageUrlsForExport(
  markdown: string,
  documentId: string
): Promise<string> {
  // Pattern 1: disk:: URLs
  const diskPattern = /!\[([^\]]*)\]\(disk::([^)]+)\)/g;

  // Pattern 2: /api/images/proxy URLs - handle both & and \&
  const proxyPattern = /!\[([^\]]*)\]\(\/api\/images\/proxy\?path=([^&\\]+)(?:\\)?&documentId=([^)]+)\)/g;

  // Pattern 3: Already public URLs (https://...) - these might expire
  const publicUrlPattern = /!\[([^\]]*)\]\((https:\/\/[acontextcdn][^)]+)\)/g;

  const urlsToResolve: Array<{
    match: string;
    alt: string;
    path: string;
    docId: string;
    type: 'disk' | 'proxy' | 'public';
  }> = [];

  // Find all disk:: URLs
  let match;
  while ((match = diskPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: cleanPath(match[2]),
      docId: documentId,
      type: 'disk',
    });
  }

  // Find all proxy URLs
  while ((match = proxyPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: cleanPath(decodeURIComponent(match[2])),
      docId: match[3],
      type: 'proxy',
    });
  }

  // Find public Acontext CDN URLs (might expire)
  while ((match = publicUrlPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: match[2],
      docId: documentId,
      type: 'public',
    });
  }

  // Deduplicate
  const uniqueUrls = [...new Map(urlsToResolve.map((u) => [u.match, u])).values()];

  if (uniqueUrls.length === 0) {
    return markdown;
  }

  console.log('[resolveImageUrls] Found', uniqueUrls.length, 'images to resolve');

  // Resolve each URL to data URL
  const resolvedUrls = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (urlInfo) => {
      try {
        let dataUrl: string | null = null;

        if (urlInfo.type === 'disk' || urlInfo.type === 'proxy') {
          // Use proxy API to avoid CORS issues
          dataUrl = await fetchImageViaProxyAsDataUrl(urlInfo.path, urlInfo.docId);
        } else if (urlInfo.type === 'public') {
          // Try direct fetch for public URLs
          dataUrl = await fetchImageAsDataUrl(urlInfo.path);
        }

        if (dataUrl) {
          resolvedUrls.set(urlInfo.match, dataUrl);
          console.log('[resolveImageUrls] Converted to data URL:', urlInfo.path.slice(0, 30));
        } else {
          console.warn('[resolveImageUrls] Failed to convert:', urlInfo.path);
        }
      } catch (error) {
        console.warn('[resolveImageUrls] Failed to resolve:', urlInfo.path, error);
      }
    })
  );

  // Replace URLs in markdown
  let result = markdown;
  for (const [original, dataUrl] of resolvedUrls) {
    // Extract alt text from original match
    const altMatch = original.match(/!\[([^\]]*)\]/);
    const alt = altMatch ? altMatch[1] : '';
    const replacement = `![${alt}](${dataUrl})`;
    result = result.split(original).join(replacement);
  }

  console.log('[resolveImageUrls] Resolved', resolvedUrls.size, 'images to data URLs');

  return result;
}
