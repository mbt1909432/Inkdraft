/**
 * Screenshot script for README documentation
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Run screenshots: npm run screenshot
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DOCS_DIR = path.join(process.cwd(), 'docs');
const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'user.json');

// Test credentials (same as E2E tests)
const TEST_EMAIL = process.env.TEST_USER_EMAIL || '1138932382@qq.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || '123456';

const DEMO_CONTENT = `# Getting Started with Inkdraft

Welcome to Inkdraft, an **Agent-Controllable Markdown Editor** that revolutionizes how you write and manage documents.

## Why Inkdraft?

Traditional editors treat AI as a suggestion tool. Inkdraft goes further — the AI Agent can **directly modify your documents** without copy-paste.

## Key Features

### 🤖 AI Agent Capabilities

The embedded Agent can perform CRUD operations on your documents:

| Action | What It Does |
|--------|--------------|
| Create | Add paragraphs, generate examples, auto-continue |
| Read | Search, summarize, and extract information |
| Update | Polish text, rewrite paragraphs, change style |
| Delete | Remove redundant content, clean formatting |

### 📊 Built-in Acontext SDK

Run Python code directly in the editor:

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze data
df = pd.read_csv('sales.csv')
monthly = df.groupby('month')['revenue'].sum()

# Generate visualization
monthly.plot(kind='bar')
plt.title('Monthly Revenue')
plt.savefig('chart.png')
\`\`\`

### 🔌 External API

Connect other Agents via RESTful API:

\`\`\`bash
# Create document via API
curl -X POST https://your-instance/api/external/documents \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"title": "New Doc", "content": "# Hello"}'
\`\`\`

## Quick Start

1. **Create** - Click "New Document" to start
2. **Write** - Use rich text or source mode
3. **Enhance** - Select text and use AI actions
4. **Export** - Download as MD, Word, or PDF

> 💡 **Tip**: Select any text to see formatting and AI action buttons!

---

Made with ❤️ by the Inkdraft team
`;

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function takeScreenshots() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    console.log('🚀 Starting screenshot capture...');
    console.log(`   Base URL: ${BASE_URL}`);

    // Check for existing auth state
    const hasStoredAuth = fs.existsSync(AUTH_FILE);
    if (hasStoredAuth) {
      console.log('   Found stored auth state');
    }

    // Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    // Create context with stored auth if available
    // Use higher resolution for clearer screenshots
    context = await browser.newContext({
      viewport: { width: 2560, height: 1440 },
      deviceScaleFactor: 2, // 2x for retina-like quality
      storageState: hasStoredAuth ? AUTH_FILE : undefined,
    });

    const page = await context.newPage();

    // Login if needed
    await page.goto(`${BASE_URL}/documents`);
    let currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      console.log('   Logging in...');
      await page.fill('#email', TEST_EMAIL);
      await page.fill('#password', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/documents', { timeout: 15000 });

      // Save auth state
      const authDir = path.dirname(AUTH_FILE);
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
      await context.storageState({ path: AUTH_FILE });
      console.log('   ✅ Login successful');
    }

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check for existing documents (they are div[role="button"], not <a> tags)
    let documentLink = page.locator('div[role="button"]:has(.lucide-file-text), [data-document-id]').first();
    let hasDocument = await documentLink.count() > 0;

    // Create document via API if none exist
    if (!hasDocument) {
      console.log('📝 Creating demo document via API...');

      const response = await page.request.post(`${BASE_URL}/api/documents`, {
        data: {
          title: 'Inkdraft Demo Document',
          content: DEMO_CONTENT,
        },
      });

      if (response.ok()) {
        console.log('   ✅ Document created');
        await page.waitForTimeout(1000);
        await page.reload();
        await page.waitForTimeout(2000);

        documentLink = page.locator('div[role="button"]:has(.lucide-file-text), [data-document-id]').first();
        hasDocument = await documentLink.count() > 0;
      } else {
        console.log('   ❌ Failed to create document:', response.status());
      }
    }

    // 1. Screenshot: Documents list page
    console.log('📸 Taking screenshot: Documents list...');
    await page.screenshot({
      path: path.join(DOCS_DIR, 'screenshot-documents.png'),
      fullPage: false,
    });
    console.log('   ✅ Saved: docs/screenshot-documents.png');

    if (hasDocument) {
      // 2. Open document
      console.log('📄 Opening document for editor screenshot...');
      await documentLink.click();
      await page.waitForURL(/\/document\//, { timeout: 10000 });
      await page.waitForTimeout(3000);

      // 3. Screenshot: Editor
      console.log('📸 Taking screenshot: Editor...');
      await page.screenshot({
        path: path.join(DOCS_DIR, 'screenshot-editor.png'),
        fullPage: false,
      });
      console.log('   ✅ Saved: docs/screenshot-editor.png');

      // 4. Try to open AI chat panel
      const chatButton = page.locator('button:has-text("AI Assistant"), button:has-text("AI")').first();
      if (await chatButton.count() > 0) {
        console.log('💬 Opening AI chat panel...');
        await chatButton.click();
        await page.waitForTimeout(1500);

        console.log('📸 Taking screenshot: Editor with AI chat...');
        await page.screenshot({
          path: path.join(DOCS_DIR, 'screenshot-editor-chat.png'),
          fullPage: false,
        });
        console.log('   ✅ Saved: docs/screenshot-editor-chat.png');
      } else {
        console.log('   ℹ️  Using editor screenshot as main image');
        fs.copyFileSync(
          path.join(DOCS_DIR, 'screenshot-editor.png'),
          path.join(DOCS_DIR, 'screenshot-editor-chat.png')
        );
      }

      // 5. Mobile screenshot
      console.log('📱 Taking mobile screenshot...');
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(DOCS_DIR, 'screenshot-mobile.png'),
        fullPage: false,
      });
      console.log('   ✅ Saved: docs/screenshot-mobile.png');

    } else {
      console.log('⚠️  No documents found. Please create a document first.');
    }

    console.log('\n✅ Screenshots captured successfully!');
    console.log('   Check the docs/ folder for output files');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

takeScreenshots();
