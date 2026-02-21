/**
 * Resolve image URLs for export (Word/PDF)
 * Converts disk:: and /api/images/proxy URLs to actual public URLs
 */

/**
 * Client-side: Pre-process markdown to resolve all image URLs
 * Call this before exporting to Word/PDF
 */
export async function resolveImageUrlsForExport(
  markdown: string,
  documentId: string
): Promise<string> {
  // Pattern 1: disk:: URLs
  const diskPattern = /!\[([^\]]*)\]\(disk::([^)]+)\)/g;

  // Pattern 2: /api/images/proxy URLs
  const proxyPattern = /!\[([^\]]*)\]\(\/api\/images\/proxy\?path=([^&]+)&documentId=([^)]+)\)/g;

  const urlsToResolve: Array<{
    match: string;
    alt: string;
    path: string;
    docId: string;
  }> = [];

  // Find all disk:: URLs
  let match;
  while ((match = diskPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: match[2],
      docId: documentId,
    });
  }

  // Find all proxy URLs
  while ((match = proxyPattern.exec(markdown)) !== null) {
    urlsToResolve.push({
      match: match[0],
      alt: match[1],
      path: decodeURIComponent(match[2]),
      docId: match[3],
    });
  }

  // Deduplicate
  const uniqueUrls = [...new Map(urlsToResolve.map((u) => [u.match, u])).values()];

  if (uniqueUrls.length === 0) {
    return markdown;
  }

  console.log('[resolveImageUrls] Found', uniqueUrls.length, 'images to resolve');

  // Resolve each URL
  const resolvedUrls = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (urlInfo) => {
      try {
        const response = await fetch(
          `/api/images/url?path=${encodeURIComponent(urlInfo.path)}&documentId=${encodeURIComponent(urlInfo.docId)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            resolvedUrls.set(urlInfo.match, data.url);
            console.log('[resolveImageUrls] Resolved:', urlInfo.path, '->', data.url.slice(0, 50));
          }
        }
      } catch (error) {
        console.warn('[resolveImageUrls] Failed to resolve:', urlInfo.path, error);
      }
    })
  );

  // Replace URLs in markdown
  let result = markdown;
  for (const [original, publicUrl] of resolvedUrls) {
    // Extract alt text from original match
    const altMatch = original.match(/!\[([^\]]*)\]/);
    const alt = altMatch ? altMatch[1] : '';
    const replacement = `![${alt}](${publicUrl})`;
    result = result.split(original).join(replacement);
  }

  return result;
}
