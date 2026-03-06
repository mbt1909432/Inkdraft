import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Document editor page
 * Encapsulates all interactions with the document editor
 */
export class DocumentPage {
  readonly page: Page;

  // Locators using semantic selectors
  readonly editorWrapper: Locator;
  readonly chatToggleButton: Locator;
  readonly chatPanel: Locator;
  readonly chatInput: Locator;
  readonly chatSendButton: Locator;
  readonly fileInput: Locator;
  readonly imageUploadInput: Locator;
  readonly userMessage: Locator;
  readonly assistantMessage: Locator;
  readonly saveButton: Locator;
  readonly outlineButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Editor wrapper - using class selector as fallback (no data-testid available)
    this.editorWrapper = page.locator('.markdown-editor-wrapper');

    // Chat panel elements
    this.chatPanel = page.getByTestId('chat-panel').or(
      page.locator('[class*="chat-panel"], [class*="ChatPanel"]')
    );

    // Chat toggle button - looks for button with Chat/AI text
    this.chatToggleButton = page.getByRole('button', { name: /chat|ai|聊天/i });

    // Chat input - use placeholder-based selector
    this.chatInput = page.getByPlaceholder(/指令|message|@quiz|ask/i).or(
      page.locator('textarea').filter({ hasText: '' }).first()
    );

    // Send button - button with Send icon or text
    this.chatSendButton = page.getByRole('button', { name: /send|发送|submit/i }).or(
      page.locator('button').filter({ has: page.locator('svg') }).last()
    );

    // File input for markdown import
    this.fileInput = page.locator('input[type="file"][accept*=".md"]');

    // Image upload input
    this.imageUploadInput = page.locator('input[type="file"][accept*="image"]');

    // Messages in chat
    this.userMessage = page.locator('[class*="bg-primary"][class*="rounded-lg"]').or(
      page.locator('[data-role="user-message"]')
    );
    this.assistantMessage = page.locator('[class*="bg-muted"][class*="rounded-lg"]').or(
      page.locator('[data-role="assistant-message"], [class*="assistant"]')
    );

    // Toolbar buttons
    this.saveButton = page.getByRole('button', { name: /save|保存/i });
    this.outlineButton = page.getByRole('button', { name: /outline|大纲/i });
  }

  /**
   * Navigate to a specific document
   */
  async goto(documentId: string) {
    await this.page.goto(`/document/${documentId}`);
    await this.waitForEditor();
  }

  /**
   * Wait for the editor to be ready
   */
  async waitForEditor(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 15000;
    await this.editorWrapper.waitFor({ timeout });
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.waitForEditor();
  }

  /**
   * Open the chat panel
   */
  async openChat() {
    // Check if chat is already open
    if (await this.chatPanel.isVisible()) {
      return;
    }

    await this.chatToggleButton.click();

    // Wait for chat panel to be visible
    await this.chatPanel.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close the chat panel
   */
  async closeChat() {
    const closeButton = this.chatPanel.getByRole('button', { name: /close|x|关闭/i });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }
  }

  /**
   * Type a message in the chat input
   */
  async typeChatMessage(message: string) {
    await this.chatInput.fill(message);
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(message: string) {
    await this.typeChatMessage(message);
    await this.chatSendButton.click();
  }

  /**
   * Send a chat message and wait for AI response
   */
  async sendChatMessageAndWaitForResponse(message: string, options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 10000;

    // Set up response listener before sending
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/api/ai/'),
      { timeout }
    );

    await this.sendChatMessage(message);

    // Wait for the API response
    await responsePromise;
  }

  /**
   * Upload an image for multimodal chat
   */
  async uploadImage(buffer: Buffer, filename: string = 'test-image.png') {
    await this.imageUploadInput.setInputFiles({
      name: filename,
      mimeType: 'image/png',
      buffer,
    });
  }

  /**
   * Wait for assistant response to appear
   */
  async waitForAssistantResponse(options: { timeout?: number } = {}) {
    const timeout = options.timeout ?? 15000;
    const initialCount = await this.assistantMessage.count();

    // Wait for new assistant message to appear
    await this.page.waitForFunction(
      ({ selector, initialCount }) => {
        const messages = document.querySelectorAll(selector);
        return messages.length > initialCount;
      },
      {
        selector: '[class*="bg-muted"][class*="rounded-lg"]',
        initialCount,
      },
      { timeout }
    );
  }

  /**
   * Get the count of user messages in chat
   */
  async getUserMessageCount(): Promise<number> {
    return await this.userMessage.count();
  }

  /**
   * Get the count of assistant messages in chat
   */
  async getAssistantMessageCount(): Promise<number> {
    return await this.assistantMessage.count();
  }

  /**
   * Expect the chat panel to be visible
   */
  async expectChatPanelVisible() {
    await expect(this.chatPanel).toBeVisible();
  }

  /**
   * Expect the editor to be visible
   */
  async expectEditorVisible() {
    await expect(this.editorWrapper).toBeVisible();
  }

  /**
   * Save the current document
   */
  async save() {
    await this.saveButton.click();
  }

  /**
   * Toggle the outline panel
   */
  async toggleOutline() {
    await this.outlineButton.click();
  }

  /**
   * Import a markdown file
   */
  async importMarkdown(buffer: Buffer, filename: string) {
    await this.fileInput.setInputFiles({
      name: filename,
      mimeType: 'text/markdown',
      buffer,
    });
  }
}

/**
 * Page Object for the Documents list page
 */
export class DocumentsListPage {
  readonly page: Page;

  // Locators
  readonly documentLinks: Locator;
  readonly createButton: Locator;
  readonly createBlankDocumentOption: Locator;

  constructor(page: Page) {
    this.page = page;

    // Document links
    this.documentLinks = page.getByRole('link', { name: /document/i }).or(
      page.locator('a[href^="/document/"]')
    );

    // Create button (opens dropdown)
    this.createButton = page.getByRole('button', { name: /create|创建|新建/i }).first();

    // Blank document option in dropdown
    this.createBlankDocumentOption = page.getByRole('menuitem', { name: /blank|空白文档/i }).or(
      page.locator('text=空白文档')
    );
  }

  /**
   * Navigate to documents page
   */
  async goto() {
    await this.page.goto('/documents');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to be ready
   */
  async waitForReady() {
    await expect(this.createButton).toBeVisible();
  }

  /**
   * Get the first document link
   */
  getFirstDocumentLink(): Locator {
    return this.documentLinks.first();
  }

  /**
   * Check if any documents exist
   */
  async hasDocuments(): Promise<boolean> {
    const count = await this.documentLinks.count();
    return count > 0;
  }

  /**
   * Create a new blank document
   */
  async createBlankDocument() {
    await this.createButton.click();
    await this.createBlankDocumentOption.click();

    // Wait for navigation to document page
    await this.page.waitForURL(/\/document\//, { timeout: 15000 });
  }

  /**
   * Click on the first document
   */
  async openFirstDocument() {
    const link = this.getFirstDocumentLink();
    await link.click();
    await this.page.waitForURL(/\/document\//, { timeout: 15000 });
  }
}
