import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Chat Panel component
 * Encapsulates all interactions with the AI chat functionality
 */
export class ChatPanel {
  readonly page: Page;

  // Locators using semantic selectors
  readonly panel: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly imageUploadButton: Locator;
  readonly imageUploadInput: Locator;
  readonly pendingImagePreview: Locator;
  readonly pdfUploadButton: Locator;
  readonly pdfUploadInput: Locator;
  readonly pendingPDFPreview: Locator;
  readonly userMessages: Locator;
  readonly assistantMessages: Locator;
  readonly clearButton: Locator;
  readonly settingsButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main panel container - prefer data-testid
    this.panel = page.getByTestId('chat-panel');

    // Input field - prefer data-testid, fallback to placeholder
    this.input = page.getByTestId('chat-input').or(
      page.getByPlaceholder(/指令|message|@quiz|ask|输入/i)
    );

    // Send button - prefer data-testid
    this.sendButton = page.getByTestId('chat-send-button').or(
      page.getByRole('button', { name: /send|发送|submit/i })
    );

    // Image upload elements - prefer data-testid
    this.imageUploadButton = page.getByTestId('image-upload-button');
    this.imageUploadInput = page.getByTestId('image-upload-input');
    this.pendingImagePreview = page.getByTestId('pending-image').or(
      page.locator('img[alt*="pending" i], img[alt*="attached" i], img[alt*="preview" i]')
    );

    // PDF upload elements
    this.pdfUploadButton = page.getByTestId('pdf-upload-button');
    this.pdfUploadInput = page.getByTestId('pdf-upload-input');
    this.pendingPDFPreview = page.locator('[data-testid="pending-pdf"]').or(
      page.locator('div:has-text(".pdf")').filter({ has: page.locator('[class*="FileText"]') })
    );

    // Messages
    this.userMessages = page.locator('[class*="bg-primary"][class*="rounded-lg"], [data-role="user-message"]');
    this.assistantMessages = page.locator('[class*="bg-muted"][class*="rounded-lg"], [data-role="assistant-message"], [class*="assistant"]');

    // Control buttons
    this.clearButton = page.getByRole('button', { name: /clear|清空|new chat/i });
    this.settingsButton = page.getByRole('button', { name: /settings|设置/i });

    // Loading indicator
    this.loadingIndicator = page.locator('[class*="animate-spin"], [class*="loading"]').or(
      page.getByRole('status', { name: /loading/i })
    );
  }

  /**
   * Check if the chat panel is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.panel.isVisible();
  }

  /**
   * Wait for the panel to be visible
   */
  async waitForVisible(options: { timeout?: number } = {}) {
    await this.panel.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 });
  }

  /**
   * Type a message in the input
   */
  async typeMessage(message: string) {
    await this.input.fill(message);
  }

  /**
   * Send a message
   */
  async sendMessage() {
    await this.sendButton.click();
  }

  /**
   * Type and send a message
   */
  async send(message: string) {
    await this.typeMessage(message);
    await this.sendMessage();
  }

  /**
   * Send a message and wait for response
   */
  async sendAndWaitForResponse(message: string, options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 30000;

    // Count current assistant messages
    const initialCount = await this.assistantMessages.count();

    // Set up response listener
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/api/ai/chat'),
      { timeout }
    );

    await this.send(message);

    // Wait for API response
    await responsePromise;

    // Wait for new message to appear
    await this.page.waitForFunction(
      ({ selector, initialCount }) => {
        const elements = document.querySelectorAll(selector);
        return elements.length > initialCount;
      },
      {
        selector: '[class*="bg-muted"][class*="rounded-lg"], [class*="assistant"]',
        initialCount,
      },
      { timeout }
    );
  }

  /**
   * Upload an image
   */
  async uploadImage(buffer: Buffer, filename: string = 'test-image.png') {
    await this.imageUploadInput.setInputFiles({
      name: filename,
      mimeType: 'image/png',
      buffer,
    });
  }

  /**
   * Upload a PDF
   */
  async uploadPDF(buffer: Buffer, filename: string = 'test-document.pdf') {
    await this.pdfUploadInput.setInputFiles({
      name: filename,
      mimeType: 'application/pdf',
      buffer,
    });
  }

  /**
   * Wait for PDF parsing to complete
   */
  async waitForPDFParsing(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 10000;

    // Wait for parsing indicator to appear and then disappear
    await this.page.waitForFunction(() => {
      // Check if there's a PDF preview that shows "ready" status (no "parsing" text)
      const pdfElements = document.querySelectorAll('[class*="bg-muted"]');
      return Array.from(pdfElements).some(el => {
        const text = el.textContent || '';
        return text.includes('.pdf') && !text.includes('Parsing') && !text.includes('parsing');
      });
    }, { timeout });
  }

  /**
   * Check if pending PDF preview is visible
   */
  async hasPendingPDF(): Promise<boolean> {
    try {
      return await this.pendingPDFPreview.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Send a multimodal message with PDF
   */
  async sendMultimodalMessageWithPDF(message: string, pdfBuffer: Buffer, filename: string = 'test-document.pdf') {
    await this.uploadPDF(pdfBuffer, filename);

    // Wait for PDF parsing to complete
    await this.waitForPDFParsing({ timeout: 15000 });

    await this.typeMessage(message);
    await this.sendMessage();
  }

  /**
   * Send a multimodal message with image
   */
  async sendMultimodalMessage(message: string, imageBuffer: Buffer, filename: string = 'test-image.png') {
    await this.uploadImage(imageBuffer, filename);

    // Wait for image preview
    await this.page.waitForTimeout(300);

    await this.typeMessage(message);
    await this.sendMessage();
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 30000;

    // Wait for loading indicator to appear then disappear
    try {
      await this.loadingIndicator.waitFor({ state: 'visible', timeout: 1000 });
    } catch {
      // Loading might be too fast to catch
    }

    await this.loadingIndicator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Get the count of user messages
   */
  async getUserMessageCount(): Promise<number> {
    return await this.userMessages.count();
  }

  /**
   * Get the count of assistant messages
   */
  async getAssistantMessageCount(): Promise<number> {
    return await this.assistantMessages.count();
  }

  /**
   * Get the text of the last assistant message
   */
  async getLastAssistantMessageText(): Promise<string> {
    const messages = this.assistantMessages;
    const count = await messages.count();
    if (count === 0) {
      return '';
    }
    return await messages.nth(count - 1).innerText();
  }

  /**
   * Clear the chat
   */
  async clear() {
    await this.clearButton.click();
  }

  /**
   * Check if pending image preview is visible
   */
  async hasPendingImage(): Promise<boolean> {
    return await this.pendingImagePreview.isVisible();
  }

  /**
   * Expect the panel to be visible
   */
  async expectVisible() {
    await expect(this.panel).toBeVisible();
  }

  /**
   * Expect a certain number of messages
   */
  async expectMessageCount(userCount: number, assistantCount: number) {
    await expect(this.userMessages).toHaveCount(userCount);
    await expect(this.assistantMessages).toHaveCount(assistantCount);
  }

  /**
   * Wait for response with proper retry logic
   */
  async waitForResponseWithRetry(options: { timeout?: number; maxRetries?: number } = {}) {
    const timeout = options.timeout ?? 15000;
    const maxRetries = options.maxRetries ?? 3;
    const initialCount = await this.assistantMessages.count();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.page.waitForFunction(
          ({ selector, initialCount }) => {
            const elements = document.querySelectorAll(selector);
            return elements.length > initialCount;
          },
          {
            selector: '[class*="bg-muted"][class*="rounded-lg"], [class*="assistant"]',
            initialCount,
          },
          { timeout }
        );
        return; // Success
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        // Wait a bit before retry
        await this.page.waitForTimeout(500);
      }
    }
  }
}

/**
 * Creates a chat panel instance bound to a specific page
 */
export function getChatPanel(page: Page): ChatPanel {
  return new ChatPanel(page);
}
