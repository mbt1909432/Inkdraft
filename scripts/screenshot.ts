/**
 * Screenshot script for README documentation
 * Run: npx tsx scripts/screenshot.ts
 *
 * Prerequisites:
 * 1. Dev server running on port 3000 (npm run dev)
 * 2. Logged in with a test document available
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DOCS_DIR = path.join(process.cwd(), 'docs');

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function waitForAuth(page: Page): Promise<boolean> {
  // Wait for either documents page or login page
  try {
    await page.waitForURL(/\/(documents|login)/, { timeout: 10000 });
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      console.log('⚠️  Please log in manually in the browser window...');
      console.log('   Waiting for login (up to 2 minutes)...');

      // Wait for navigation to documents page after login
      await page.waitForURL(/\/documents/, { timeout: 120000 });
      return true;
    }

    return true;
  } catch (e) {
    console.error('Auth wait timeout');
    return false;
  }
}

async function takeScreenshots() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    console.log('🚀 Starting screenshot capture...');
    console.log(`   Base URL: ${BASE_URL}`);

    // Launch browser in headed mode for auth
    browser = await chromium.launch({
      headless: false, // Show browser for manual login if needed
      args: ['--start-maximized'],
    });

    // Create context with storage state if exists
    const storageStatePath = path.join(process.cwd(), '.auth', 'user.json');
    const hasStoredAuth = fs.existsSync(storageStatePath);

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      storageState: hasStoredAuth ? storageStatePath : undefined,
    });

    const page = await context.newPage();

    // 1. Navigate to documents page and handle auth
    console.log('📄 Navigating to documents page...');
    await page.goto(`${BASE_URL}/documents`);

    const authSuccess = await waitForAuth(page);
    if (!authSuccess) {
      console.error('❌ Authentication failed');
      return;
    }

    // Save auth state for future runs
    const authDir = path.join(process.cwd(), '.auth');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    await context.storageState({ path: storageStatePath });
    console.log('   Auth state saved');

    // Wait for documents to load
    await page.waitForTimeout(2000);

    // 2. Screenshot: Documents list page
    console.log('📸 Taking screenshot: Documents list...');
    await page.screenshot({
      path: path.join(DOCS_DIR, 'screenshot-documents.png'),
      fullPage: false,
    });
    console.log('   Saved: docs/screenshot-documents.png');

    // 3. Find and click on a document to edit
    const documentLink = page.locator('[data-testid="document-item"], a[href^="/document/"]').first();
    const hasDocument = await documentLink.count() > 0;

    if (hasDocument) {
      console.log('📄 Opening document for editor screenshot...');
      await documentLink.click();

      // Wait for editor to load
      await page.waitForURL(/\/document\//, { timeout: 10000 });
      await page.waitForTimeout(3000); // Wait for editor to fully render

      // 4. Screenshot: Editor with AI panel
      console.log('📸 Taking screenshot: Editor...');
      await page.screenshot({
        path: path.join(DOCS_DIR, 'screenshot-editor.png'),
        fullPage: false,
      });
      console.log('   Saved: docs/screenshot-editor.png');

      // 5. Open AI chat panel if available
      const chatButton = page.locator('button:has-text("AI"), button[aria-label*="AI"], button[aria-label*="assistant"]').first();
      if (await chatButton.count() > 0) {
        console.log('💬 Opening AI chat panel...');
        await chatButton.click();
        await page.waitForTimeout(1000);

        console.log('📸 Taking screenshot: Editor with AI chat...');
        await page.screenshot({
          path: path.join(DOCS_DIR, 'screenshot-editor-chat.png'),
          fullPage: false,
        });
        console.log('   Saved: docs/screenshot-editor-chat.png');
      }

      // 6. Mobile viewport screenshots
      console.log('📱 Taking mobile screenshots...');
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(DOCS_DIR, 'screenshot-mobile.png'),
        fullPage: false,
      });
      console.log('   Saved: docs/screenshot-mobile.png');

    } else {
      console.log('⚠️  No documents found. Creating a test document...');

      // Try to create a new document
      const newDocButton = page.locator('button:has-text("新建"), button:has-text("New")').first();
      if (await newDocButton.count() > 0) {
        await newDocButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({
          path: path.join(DOCS_DIR, 'screenshot-editor.png'),
          fullPage: false,
        });
        console.log('   Saved: docs/screenshot-editor.png');
      }
    }

    console.log('\n✅ Screenshots captured successfully!');
    console.log('   Check the docs/ folder for output files');

  } catch (error) {
    console.error('❌ Error taking screenshots:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

takeScreenshots();
