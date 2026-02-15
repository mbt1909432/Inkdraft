/**
 * Convert markdown to PDF and trigger download.
 * Uses marked -> HTML, then html2canvas + jspdf in the browser.
 */

import { marked } from 'marked';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const MARGIN_PT = 40;
const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_PT * 2;
const CONTENT_HEIGHT_PT = A4_HEIGHT_PT - MARGIN_PT * 2;

/** Create a hidden container, render HTML, capture with html2canvas, then build PDF. */
export async function downloadAsPdf(markdown: string, filename: string): Promise<void> {
  const html = await marked.parse(markdown);
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${CONTENT_WIDTH_PT}px`;
  container.style.padding = '24px';
  container.style.fontFamily = 'system-ui, sans-serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.5';
  container.style.color = '#1a1a1a';
  container.style.background = '#fff';
  container.style.boxSizing = 'border-box';
  container.innerHTML = html;

  // Basic markdown-rendered HTML styles
  const style = document.createElement('style');
  style.textContent = `
    .pdf-export h1 { font-size: 1.5em; margin: 0.5em 0; }
    .pdf-export h2 { font-size: 1.25em; margin: 0.5em 0; }
    .pdf-export h3 { font-size: 1.1em; margin: 0.4em 0; }
    .pdf-export p { margin: 0.4em 0; }
    .pdf-export ul, .pdf-export ol { margin: 0.4em 0; padding-left: 1.5em; }
    .pdf-export pre { background: #f5f5f5; padding: 0.5em; overflow-x: auto; }
    .pdf-export code { font-family: monospace; }
  `;
  container.className = 'pdf-export';
  document.head.appendChild(style);
  document.body.appendChild(container);

  try {
    const scale = 2;
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: CONTENT_WIDTH_PT,
      windowWidth: CONTENT_WIDTH_PT,
    });

    document.body.removeChild(container);
    document.head.removeChild(style);

    const imgWidth = CONTENT_WIDTH_PT;
    const imgHeight = (canvas.height * CONTENT_WIDTH_PT) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'pt', 'a4');
    let heightLeft = imgHeight;
    let position = 0;
    let page = 0;

    // First page
    pdf.addImage(imgData, 'PNG', MARGIN_PT, MARGIN_PT, imgWidth, imgHeight);
    heightLeft -= CONTENT_HEIGHT_PT;
    page++;

    while (heightLeft > 0) {
      position = -page * CONTENT_HEIGHT_PT;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', MARGIN_PT, position + MARGIN_PT, imgWidth, imgHeight);
      heightLeft -= CONTENT_HEIGHT_PT;
      page++;
    }

    const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeName);
  } catch (e) {
    document.body.removeChild(container);
    if (style.parentNode) document.head.removeChild(style);
    throw e;
  }
}
