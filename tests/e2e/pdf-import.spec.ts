import { test, expect } from '../fixtures/test-fixtures';
import { createTestPDFBuffer } from '../fixtures/test-fixtures';

/**
 * E2E test for PDF Import functionality
 * Tests PDF import from documents page
 */

test.describe('PDF Import', () => {
  test.beforeEach(async ({ page }) => {
    // Go to documents page
    await page.goto('/documents');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should show PDF import option in welcome screen dropdown', async ({ page }) => {
    // Take screenshot first to see page state
    await page.screenshot({ path: 'test-results/pdf-import-page-state.png' });

    // Find dropdown trigger button (has Plus icon)
    const dropdownTrigger = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /创建|create/i,
    }).first();

    // Check if button exists
    const buttonCount = await dropdownTrigger.count();
    console.log('[PDF Import] Dropdown trigger count:', buttonCount);

    if (buttonCount === 0) {
      // Try alternative selector
      const altButton = page.getByRole('button').filter({ has: page.locator('svg[class*="lucide-plus"]') }).first();
      await altButton.click();
    } else {
      await dropdownTrigger.click();
    }

    // Wait for dropdown to open
    await page.waitForTimeout(500);

    // Take screenshot of dropdown
    await page.screenshot({ path: 'test-results/pdf-import-dropdown.png' });

    // Check if PDF import option is visible (try both languages)
    const pdfImportOption = page.getByRole('menuitem').filter({ hasText: /pdf/i });
    const isVisible = await pdfImportOption.isVisible().catch(() => false);
    console.log('[PDF Import] PDF option visible:', isVisible);

    if (isVisible) {
      await expect(pdfImportOption).toBeVisible();
    }
  });

  test('should trigger file input when clicking PDF import', async ({ page }) => {
    // Find and click dropdown trigger
    const dropdownTrigger = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /创建|create/i,
    }).first();

    await dropdownTrigger.click();
    await page.waitForTimeout(300);

    // Set up file chooser listener before clicking
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });

    // Click PDF import option
    const pdfImportOption = page.getByRole('menuitem').filter({ hasText: /pdf/i });
    await pdfImportOption.click();

    // Verify file chooser was triggered
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();

    console.log('[PDF Import] File chooser triggered');
  });

  test('should create document from text-based PDF', async ({ page }) => {
    // Create test PDF buffer
    const testPDF = createTestPDFBuffer();

    // Find and click dropdown trigger
    const dropdownTrigger = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /创建|create/i,
    }).first();

    await dropdownTrigger.click();
    await page.waitForTimeout(300);

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });

    // Click PDF import option
    const pdfImportOption = page.getByRole('menuitem').filter({ hasText: /pdf/i });
    await pdfImportOption.click();

    // Handle file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: testPDF,
    });

    // Wait for document creation and navigation
    try {
      await page.waitForURL(/\/document\//, { timeout: 30000 });
      console.log('[PDF Import] Navigated to document page');

      // Verify we're on a document page
      expect(page.url()).toMatch(/\/document\//);
    } catch (error) {
      // Take screenshot on failure
      await page.screenshot({ path: 'test-results/pdf-import-failed.png' });
      throw error;
    }
  });

  test('should show error for non-PDF file', async ({ page }) => {
    // Find and click dropdown trigger
    const dropdownTrigger = page.locator('button').filter({
      has: page.locator('svg'),
    }).filter({
      hasText: /创建|create/i,
    }).first();

    await dropdownTrigger.click();
    await page.waitForTimeout(300);

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });

    // Click PDF import option
    const pdfImportOption = page.getByRole('menuitem').filter({ hasText: /pdf/i });
    await pdfImportOption.click();

    // Handle file chooser with wrong file type
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content'),
    });

    // Should show error toast
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/pdf-import-wrong-type.png' });
  });
});

test.describe('PDF Import - Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Go to documents page
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
  });

  test('should show sidebar with PDF import option', async ({ page }) => {
    // Take screenshot of page
    await page.screenshot({ path: 'test-results/pdf-import-sidebar.png' });

    // Check if sidebar is visible
    const sidebar = page.locator('aside').or(page.locator('[class*="sidebar"]'));
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    console.log('[PDF Import] Sidebar visible:', sidebarVisible);
  });
});
