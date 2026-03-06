import { test, expect } from '@playwright/test';

import { setTimeout } from 'timers/promises';

import path from 'path';

// Increase test timeout
test.describe('Xiaohongshu Feature', () => {
  // Skip auth setup - run this test standalone
  test.describe.configure({ mode: 'parallel' });

  test('should generate xiaohongshu cards from chat', async ({ page }) => {
    test.setTimeout(120000);

    // Visit login page first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Login with test credentials
    await page.fill('input[type="email"]', '1138932382@qq.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL('**/documents**', { timeout: 15000 });

    console.log('Login successful');

    // Now go to a known document
    await page.goto('/document/7c5ff04e-44cd-4dc9-a4d8-d40c49a6467f');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot to see the page state
    await page.screenshot({ path: 'test-results/xiaohongshu-01-page-loaded.png', fullPage: true });

    // Find and click the chat button (try multiple selectors)
    const chatSelectors = [
      'button:has-text("AI")',
      'button:has-text("Chat")',
      'button:has-text("聊天")',
      'button >> svg',
      '[data-testid="chat-panel"]',
    ];

    let chatButton = null;
    for (const selector of chatSelectors) {
      try {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 3000 })) {
          chatButton = btn;
          console.log(`Found chat button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} not found, continuing...`);
      }
    }

    if (!chatButton) {
      console.log('No chat button found');
      await page.screenshot({ path: 'test-results/xiaohongshu-02-no-chat-button.png', fullPage: true });
      test.fail('Could not find chat button on page');
    }

    // Click the chat button
    await chatButton.click();
    console.log('Clicked chat button, waiting for chat panel...');
    await page.waitForTimeout(3000);

    // Find chat input using data-testid
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 15000 });

    console.log('Found chat input, typing @xiaohongshu command...');

    // Type the command
    await chatInput.fill('@xiaohongshu 教学方法分享');

    // Press Enter to send
    await chatInput.press('Enter');

    // wait for response
    console.log('Waiting for xiaohongshu response...');
    await page.waitForTimeout(60000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/xiaohongshu-03-response.png', fullPage: true });

    console.log('Test completed');
  });
});
