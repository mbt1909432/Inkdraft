/**
 * Types for PDF parsing
 */

export type PDFParseMode = 'auto' | 'text' | 'image';

export type PDFParseResult =
  | { type: 'markdown'; content: string; pageCount: number }
  | { type: 'images'; content: string[]; pageCount: number }; // base64 data URLs

export interface PDFParseOptions {
  mode: PDFParseMode;
  imageScale?: number; // Image scale ratio, default 1.5
  maxPages?: number; // Max pages to parse, default 20
  onProgress?: (page: number, total: number) => void;
}

export interface PendingPDF {
  id: string;
  filename: string;
  pageCount: number;
  parseMode: PDFParseMode;
  status: 'parsing' | 'ready' | 'error';
  result?: PDFParseResult;
  error?: string;
}
