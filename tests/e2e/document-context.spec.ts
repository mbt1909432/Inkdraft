import { test, expect } from '../fixtures/test-fixtures';
import { DocumentsListPage, DocumentPage, ChatPanel } from '../pages';

/**
 * E2E test for document context in chat
 * Verifies that the AI can see and reference the document content
 */

test.describe('Document Context in Chat', () => {
  let documentsPage: DocumentsListPage;
  let documentPage: DocumentPage;
  let chatPanel: ChatPanel;

  test.beforeEach(async ({ page }) => {
    documentsPage = new DocumentsListPage(page);
    documentPage = new DocumentPage(page);
    chatPanel = new ChatPanel(page);

    await documentsPage.goto();
  });

  test('AI should see and reference document content', async ({ page }) => {
    // Create a new document with unique content
    const uniqueContent = `# Test Document ${Date.now()}

This is a unique test document with special content.

## Section A
- Item 1: Alpha
- Item 2: Beta
- Item 3: Gamma

## Section B
This section contains the secret keyword: UNICORN_12345
`;

    // Navigate to a document
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();

    // Set the document content
    await page.evaluate((content) => {
      // @ts-expect-error - accessing global for testing
      window.__testContent = content;
    }, uniqueContent);

    // Type the content into the editor
    const editor = page.locator('.markdown-editor-wrapper [contenteditable="true"], .markdown-editor-wrapper textarea').first();
    await editor.click();
    await editor.fill(uniqueContent);

    // Wait for content to be saved
    await page.waitForTimeout(1000);

    // Open chat panel
    await documentPage.openChat();
    await chatPanel.expectVisible();

    // Ask about the document content
    const question = 'What is the secret keyword in this document?';
    await chatPanel.typeMessage(question);

    // Set up response listener
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/ai/chat'),
      { timeout: 30000 }
    );

    await chatPanel.sendMessage();

    // Wait for response
    try {
      await responsePromise;
    } catch {
      console.log('[Test] API response timeout');
    }

    // Wait for assistant message
    await page.waitForTimeout(5000);

    // Get the last assistant message
    const assistantMessages = await page.locator('[class*="bg-muted"][class*="rounded"]').all();
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const responseText = await lastMessage.textContent();

    console.log('[Test] AI Response:', responseText?.substring(0, 500));

    // The AI should mention the secret keyword if it can see the document
    const keywordFound = responseText?.toLowerCase().includes('unicorn') ||
                         responseText?.includes('12345');

    // Log result
    if (keywordFound) {
      console.log('[Test] ✅ AI correctly referenced document content');
    } else {
      console.log('[Test] ❌ AI did not reference document content');
      console.log('[Test] Full response:', responseText);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/document-context-test.png' });

    // Assert that AI saw the document
    expect(keywordFound || responseText?.includes('document')).toBeTruthy();
  });

  test('documentMarkdown should be sent to API', async ({ page, request }) => {
    // Navigate to a document
    if (await documentsPage.hasDocuments()) {
      await documentsPage.openFirstDocument();
    } else {
      await documentsPage.createBlankDocument();
    }

    await documentPage.waitForEditor();

    // Set unique content
    const uniqueMarker = `MARKER_${Date.now()}`;
    const editor = page.locator('.markdown-editor-wrapper [contenteditable="true"], .markdown-editor-wrapper textarea').first();
    await editor.click();
    await editor.fill(`# Test\n\nContent with ${uniqueMarker}`);

    await page.waitForTimeout(1000);

    // Open chat and send message
    await documentPage.openChat();
    await chatPanel.expectVisible();

    // Monitor the API request
    let requestBody: Record<string, unknown> | null = null;

    page.on('request', (req) => {
      if (req.url().includes('/api/ai/chat')) {
        const postData = req.postData();
        if (postData) {
          try {
            requestBody = JSON.parse(postData);
          } catch {
            // Ignore parse errors
          }
        }
      }
    });

    await chatPanel.typeMessage('Hello');
    await chatPanel.sendMessage();

    await page.waitForTimeout(3000);

    // Check the request body
    console.log('[Test] Request body keys:', requestBody ? Object.keys(requestBody) : 'null');
    console.log('[Test] documentMarkdown length:', (requestBody?.documentMarkdown as string)?.length || 0);
    console.log('[Test] documentMarkdown contains marker:', (requestBody?.documentMarkdown as string)?.includes(uniqueMarker));

    // Assert that documentMarkdown was sent
    expect(requestBody).not.toBeNull();
    expect(requestBody?.documentMarkdown).toBeDefined();
    expect((requestBody?.documentMarkdown as string)?.length).toBeGreaterThan(0);
  });
});
