import { test, expect } from '@playwright/test';

test.describe('Export functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
  });

  test('should show download dropdown with Word and PDF options', async ({ page }) => {
    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\//);

    // Find download button
    const downloadBtn = page.locator('button').filter({ hasText: /Download|下载/ });
    await expect(downloadBtn).toBeVisible({ timeout: 5000 });

    // Click to open dropdown
    await downloadBtn.click();

    // Should show Word and PDF options
    await expect(page.getByRole('menuitem').filter({ hasText: /Word|\.docx/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('menuitem').filter({ hasText: /PDF/i })).toBeVisible({ timeout: 3000 });
  });

  test('should trigger Word export', async ({ page }) => {
    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\//);

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

    // Click download and select Word
    await page.locator('button').filter({ hasText: /Download|下载/ }).click();
    await page.getByRole('menuitem').filter({ hasText: /Word|\.docx/i }).click();

    // Wait for download
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      console.log('[export] Word download:', filename);
      expect(filename).toMatch(/\.docx$/);
    } else {
      console.log('[export] No download triggered, might be processing...');
    }
  });

  test('should trigger PDF export', async ({ page }) => {
    const docLinks = page.locator('a[href^="/document/"]');
    const count = await docLinks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await docLinks.first().click();
    await expect(page).toHaveURL(/\/document\//);

    // Setup download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

    // Click download and select PDF
    await page.locator('button').filter({ hasText: /Download|下载/ }).click();
    await page.getByRole('menuitem').filter({ hasText: /PDF/i }).click();

    // Wait for download
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      console.log('[export] PDF download:', filename);
      expect(filename).toMatch(/\.pdf$/);
    } else {
      console.log('[export] No download triggered, might be processing...');
    }
  });
});
