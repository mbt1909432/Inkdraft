import { test, expect } from '../fixtures/test-fixtures';
import { DocumentPage, DocumentsListPage, ChatPanel } from '../pages';
import { createTestPDFBuffer, createTestPDFFile } from '../fixtures/test-fixtures';

/**
 * E2E test for PDF Upload functionality
 * Tests PDF upload, parsing, and multimodal message handling
 */

test.describe('PDF Upload', () => {
  let documentsPage: DocumentsListPage;
  let documentPage: DocumentPage;
  let chatPanel: ChatPanel;

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsListPage(page);
    documentPage = new DocumentPage(page);
    chatPanel = new ChatPanel(page);

    // Navigate to documents page
    await documentsPage.goto();
  });

  test('should display PDF upload button in chat panel', async ({ page }) => {
    // Navigate to a document or create one
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      // Create a new document if none exist
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();

    // Open chat panel
    await documentPage.openChat();

    // Verify chat panel is visible
    await chatPanel.expectVisible();

    // Verify PDF upload input exists
    const pdfUploadInput = page.getByTestId('pdf-upload-input');
    await expect(pdfUploadInput).toBeAttached();

    // Verify PDF upload button exists
    const pdfUploadButton = page.getByTestId('pdf-upload-button');
    await expect(pdfUploadButton).toBeVisible();

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/pdf-upload-panel.png' });
  });

  test('should upload PDF via file input', async ({ page }) => {
    // Navigate to a document
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();
    await documentPage.openChat();

    // Create a test PDF
    const testPDFBuffer = createTestPDFBuffer();

    // Upload the PDF
    await chatPanel.uploadPDF(testPDFBuffer);

    // Wait for PDF preview to appear with parsing complete
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    // Verify PDF is uploaded and parsed
    const hasPDF = await chatPanel.hasPendingPDF();
    expect(hasPDF).toBe(true);

    await page.screenshot({ path: 'test-results/pdf-preview.png' });
  });

  test('should show PDF filename and page count', async ({ page }) => {
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();
    await documentPage.openChat();

    // Create a test PDF with specific filename
    const testPDF = createTestPDFFile('my-test-document.pdf');

    // Upload the PDF
    await chatPanel.uploadPDF(testPDF.buffer, testPDF.name);

    // Wait for parsing to complete
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    // Verify filename is shown
    await expect(page.locator(`text=${testPDF.name}`)).toBeVisible();

    // Verify page count is shown (should show "1 pages" or similar)
    await expect(page.locator('text=/\\d+\\s*pages?/i')).toBeVisible();

    await page.screenshot({ path: 'test-results/pdf-info-display.png' });
  });

  test('should send multimodal message with PDF', async ({ page }) => {
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();
    await documentPage.openChat();

    // Create test PDF
    const testPDFBuffer = createTestPDFBuffer();

    // Set up response listener before sending
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/ai/chat'),
      { timeout: 30000 }
    );

    // Send multimodal message with PDF
    await chatPanel.uploadPDF(testPDFBuffer, 'test-doc.pdf');
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    await chatPanel.typeMessage('请分析这个PDF的内容');
    await chatPanel.sendMessage();

    // Wait for API response
    try {
      await responsePromise;
    } catch {
      console.log('[PDF] API response timeout - might be configuration issue');
    }

    // Take screenshot after sending
    await page.screenshot({ path: 'test-results/pdf-after-send.png' });

    // Check if we got a response
    const assistantCount = await chatPanel.getAssistantMessageCount();
    console.log('[PDF] Assistant messages:', assistantCount);

    // Test passes if we successfully sent the message
    expect(assistantCount).toBeGreaterThan(0);
  });

  test('should remove PDF from pending list', async ({ page }) => {
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();
    await documentPage.openChat();

    // Upload PDF
    const testPDFBuffer = createTestPDFBuffer();
    await chatPanel.uploadPDF(testPDFBuffer);
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    // Verify PDF is visible
    expect(await chatPanel.hasPendingPDF()).toBe(true);

    // Click remove button (X button near PDF preview)
    const removeButton = page.locator('button').filter({
      has: page.locator('[class*="X"]'),
    }).and(page.locator('visible=true')).first();

    // Alternative: click on the X button in the PDF preview area
    const pdfRemoveButton = page.locator('div:has-text(".pdf") button');
    if (await pdfRemoveButton.count() > 0) {
      await pdfRemoveButton.first().click();
    } else {
      // Fallback: find any X button that's visible
      await page.locator('button:has([class*="X"])').first().click();
    }

    // Verify PDF is removed
    await page.waitForFunction(() => {
      const pdfElements = document.querySelectorAll('[class*="bg-muted"]');
      return !Array.from(pdfElements).some(el => el.textContent?.includes('.pdf'));
    }, { timeout: 3000 });

    expect(await chatPanel.hasPendingPDF()).toBe(false);

    await page.screenshot({ path: 'test-results/pdf-removed.png' });
  });

  test('should handle multiple PDFs', async ({ page }) => {
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();
    await documentPage.openChat();

    // Upload first PDF
    await chatPanel.uploadPDF(createTestPDFBuffer(), 'document1.pdf');
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    // Upload second PDF
    await chatPanel.uploadPDF(createTestPDFBuffer(), 'document2.pdf');
    await chatPanel.waitForPDFParsing({ timeout: 15000 });

    // Verify both PDFs are shown
    await expect(page.locator('text=document1.pdf')).toBeVisible();
    await expect(page.locator('text=document2.pdf')).toBeVisible();

    await page.screenshot({ path: 'test-results/multiple-pdfs.png' });
  });
});

test.describe('PDF API', () => {
  test('should accept PDF content via API', async ({ request }) => {
    const testPDFBuffer = createTestPDFBuffer();
    const testPDFBase64 = testPDFBuffer.toString('base64');

    // Create a document first
    const docResponse = await request.post('/api/documents', {
      data: {
        title: 'PDF Test Document',
        content: '# Test\n\nThis is a test document for PDF chat.',
      },
    });

    let documentId: string | undefined;
    if (docResponse.ok()) {
      const docData = await docResponse.json();
      documentId = docData.document?.id;
      console.log('[PDF API] Created document:', documentId);
    }

    // Send multimodal message with PDF content (as extracted text)
    const response = await request.post('/api/ai/chat-acontext', {
      data: {
        content: '请分析这个PDF',
        contentParts: [
          { type: 'text', text: '请分析这个PDF的内容' },
          { type: 'text', text: `[PDF Content]\nTest PDF Content` },
        ],
        documentId,
        documentMarkdown: '# Test\n\nThis is a test document.',
        selectionMarkdown: null,
      },
    });

    console.log('[PDF API] Response status:', response.status());

    if (response.ok()) {
      console.log('[PDF API] Request accepted');
      expect(response.status()).toBe(200);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('[PDF API] Response:', errorData);

      // Check if it's just a configuration issue (no LLM endpoint)
      if (errorData.error?.includes('not configured') || errorData.error?.includes('Unauthorized')) {
        console.log('[PDF API] Test skipped - configuration issue');
        test.skip();
      } else {
        expect(response.status()).toBe(200);
      }
    }
  });
});
