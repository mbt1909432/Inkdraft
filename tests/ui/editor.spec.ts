import { test, expect } from '@playwright/test';

test.describe('Editor UI', () => {
  test('should load documents page', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    // Check for logout button
    const logoutBtn = page.locator('button').filter({ has: page.locator('svg.lucide-log-out') });
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
  });

  test('should open a document and show editor', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      console.log('No documents found, skipping test');
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\/[a-f0-9-]+/);
    await expect(page.locator('.markdown-editor-wrapper')).toBeVisible({ timeout: 10000 });
  });

  test('should show Disk Files button', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\/[a-f0-9-]+/);

    const filesButton = page.locator('button').filter({ hasText: /Files|文件/ });
    await expect(filesButton).toBeVisible({ timeout: 5000 });
  });

  test('should open Disk File Browser dialog', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\//);

    // Click Files button
    const filesButton = page.locator('button').filter({ hasText: /Files|文件/ });
    await filesButton.click();

    // Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should show Disk Files title
    await expect(dialog).toContainText(/Disk Files|文件/);
  });

  test('should show document title in header', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Get document title from list
    const firstDoc = docLinks.first();
    const docTitle = await firstDoc.textContent();

    await firstDoc.click();
    await expect(page).toHaveURL(/\/document\//);

    // Title should appear somewhere on the page
    if (docTitle) {
      await expect(page.locator('body')).toContainText(docTitle.trim(), { timeout: 5000 });
    }
  });

  test('should have save button', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\//);

    // Look for save button
    const saveButton = page.locator('button').filter({ hasText: /Save|保存/ });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
  });
});
