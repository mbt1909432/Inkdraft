/**
 * PDF parsing utilities using pdfjs-dist
 * Supports text extraction and image rendering
 *
 * NOTE: This module uses browser-only APIs and should only be imported dynamically
 * in client-side code.
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PDFParseMode, PDFParseResult, PDFParseOptions } from './types';

// Lazy-loaded pdfjs-dist module
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/**
 * Get the pdfjs-dist library (lazy loaded)
 * Uses legacy build for better browser compatibility
 */
async function getPdfjsLib() {
  if (!pdfjsLib) {
    // Use legacy build for better compatibility with Next.js/Turbopack
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Configure worker - use unpkg CDN which has all versions
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

/**
 * Load a PDF file and return a PDFDocumentProxy
 */
export async function loadPDF(file: File): Promise<PDFDocumentProxy> {
  const lib = await getPdfjsLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
  return pdf;
}

/**
 * Extract text content from all pages of a PDF
 * Returns markdown-formatted text
 */
export async function extractText(pdf: PDFDocumentProxy): Promise<string> {
  const totalPages = pdf.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group items by their Y position to reconstruct lines
    const items = textContent.items as Array<{ str: string; transform: number[]; height: number }>;
    const lines: Map<number, string[]> = new Map();

    for (const item of items) {
      // Y position is transform[5], round to group nearby items
      const y = Math.round(item.transform[5]);
      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push(item.str);
    }

    // Sort by Y position (descending, as PDF Y increases upward)
    const sortedYs = Array.from(lines.keys()).sort((a, b) => b - a);

    // Build text for this page
    const pageText = sortedYs
      .map(y => lines.get(y)!.join(' '))
      .filter(line => line.trim())
      .join('\n');

    if (pageText.trim()) {
      textParts.push(`## Page ${i}\n\n${pageText}`);
    }
  }

  return textParts.join('\n\n---\n\n');
}

/**
 * Render a single PDF page to a PNG data URL
 */
export async function renderPageToImage(
  page: PDFPageProxy,
  scale: number = 1.5
): Promise<string> {
  const viewport = page.getViewport({ scale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to create canvas context');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render page to canvas
  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  // Convert to data URL (PNG)
  return canvas.toDataURL('image/png');
}

/**
 * Render all pages of a PDF to images
 */
export async function renderPagesToImages(
  pdf: PDFDocumentProxy,
  scale: number = 1.5,
  maxPages?: number,
  onProgress?: (page: number, total: number) => void
): Promise<string[]> {
  const totalPages = maxPages ? Math.min(pdf.numPages, maxPages) : pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const dataUrl = await renderPageToImage(page, scale);
    images.push(dataUrl);
    onProgress?.(i, totalPages);
  }

  return images;
}

/**
 * Parse a PDF file with automatic type detection
 * - If the PDF has extractable text (>100 chars), return as markdown
 * - Otherwise, render pages as images
 */
export async function parsePDF(
  file: File,
  options: PDFParseOptions = { mode: 'auto' }
): Promise<PDFParseResult> {
  const {
    mode = 'auto',
    imageScale = 1.5,
    maxPages = 20,
    onProgress,
  } = options;

  // Load PDF
  const pdf = await loadPDF(file);
  const pageCount = Math.min(pdf.numPages, maxPages);

  // Try text extraction first
  let extractedText = '';
  if (mode === 'auto' || mode === 'text') {
    extractedText = await extractText(pdf);
  }

  // Determine parse mode
  const isTextBased = mode === 'text' || (mode === 'auto' && extractedText.length > 100);

  if (isTextBased && extractedText.trim()) {
    // Text-based PDF - return markdown
    onProgress?.(pageCount, pageCount);
    return {
      type: 'markdown',
      content: extractedText,
      pageCount: pdf.numPages,
    };
  } else {
    // Image-based PDF - render pages as images
    const images = await renderPagesToImages(pdf, imageScale, maxPages, onProgress);
    return {
      type: 'images',
      content: images,
      pageCount: pdf.numPages,
    };
  }
}

/**
 * Get PDF metadata without full parsing
 */
export async function getPDFInfo(file: File): Promise<{ pageCount: number; filename: string }> {
  const pdf = await loadPDF(file);
  return {
    pageCount: pdf.numPages,
    filename: file.name,
  };
}
