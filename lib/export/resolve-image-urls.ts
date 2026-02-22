/**
 * Resolve image URLs for export (Word/PDF)
 * Converts disk:: and /api/images/proxy URLs to data:image URLs for permanent embedding
 */

/**
 * Fetch image and convert to data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
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
    console.warn('[fetchImageAsDataUrl] Failed:', url, error);
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

  // Pattern 2: /api/images/proxy URLs
  const proxyPattern = /!\[([^\]]*)\]\(\/api\/images\/proxy\?path=([^&]+)&documentId=([^)]+)\)/g;

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
      path: match[2],
      docId: documentId,
      type: 'disk',
    });
  }

  // Find all proxy URLs
  while ((match = proxyPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: decodeURIComponent(match[2]),
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
        let publicUrl: string;

        if (urlInfo.type === 'public') {
          // Already a public URL, just fetch it
          publicUrl = urlInfo.path;
        } else {
          // Get public URL first
          const response = await fetch(
            `/api/images/url?path=${encodeURIComponent(urlInfo.path)}&documentId=${encodeURIComponent(urlInfo.docId)}`
          );
          if (!response.ok) {
            console.warn('[resolveImageUrls] Failed to get public URL:', urlInfo.path);
            return;
          }
          const data = await response.json();
          if (!data.url) {
            console.warn('[resolveImageUrls] No URL in response:', urlInfo.path);
            return;
          }
          publicUrl = data.url;
        }

        // Fetch image and convert to data URL
        const dataUrl = await fetchImageAsDataUrl(publicUrl);
        if (dataUrl) {
          resolvedUrls.set(urlInfo.match, dataUrl);
          console.log('[resolveImageUrls] Converted to data URL:', urlInfo.path.slice(0, 30));
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
