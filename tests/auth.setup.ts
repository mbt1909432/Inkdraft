import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { getTestUser, createTestDocument, deleteTestDocument } from './fixtures/test-fixtures';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const { email, password } = getTestUser();

  console.log('[auth.setup] Logging in as', email);

  // Use LoginPage page object
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // Login and wait for redirect
  await loginPage.loginAndWaitForRedirect(email, password, { timeout: 15000 });

  console.log('[auth.setup] Login successful, saving auth state');

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('[auth.setup] Auth state saved to', authFile);
});

// Create a test document for subsequent tests
setup('create test document', async ({ request }) => {
  console.log('[auth.setup] Creating test document...');

  try {
    const document = await createTestDocument(request, {
      title: 'E2E Test Document',
      content: `# Test Document

This is a test document for E2E testing.

## Features to test

- Image upload
- Export to Word
- Export to PDF
`,
    });

    console.log('[auth.setup] Test document created:', document.id);

    // Save document ID for other tests
    process.env.TEST_DOCUMENT_ID = document.id;
  } catch (error) {
    // If document creation fails, tests will use existing documents
    console.log('[auth.setup] Failed to create test document, tests will use existing documents');
    console.log('[auth.setup] Error:', error);
  }
});
