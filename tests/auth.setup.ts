import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL || '1138932382@qq.com';
  const password = process.env.TEST_USER_PASSWORD || '123456';

  console.log('[auth.setup] Logging in as', email);

  // Go to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill credentials
  await page.fill('#email', email);
  await page.fill('#password', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to documents page
  await page.waitForURL('**/documents', { timeout: 15000 });

  // Verify logged in
  await expect(page).toHaveURL(/documents/);

  console.log('[auth.setup] Login successful, saving auth state');

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('[auth.setup] Auth state saved to', authFile);
});

// Create a test document for subsequent tests
setup('create test document', async ({ request }) => {
  console.log('[auth.setup] Creating test document...');

  // Use the saved auth state
  const response = await request.post('/api/documents', {
    data: {
      title: 'E2E Test Document',
      content: '# Test Document\n\nThis is a test document for E2E testing.\n\n## Features to test\n\n- Image upload\n- Export to Word\n- Export to PDF\n',
    },
  });

  if (response.ok()) {
    const data = await response.json();
    console.log('[auth.setup] Test document created:', data.document?.id);

    // Save document ID for other tests
    process.env.TEST_DOCUMENT_ID = data.document?.id;
  } else {
    console.log('[auth.setup] Failed to create test document:', response.status());
    // Try to get existing documents
    const docsResponse = await request.get('/api/documents');
    if (docsResponse.ok()) {
      const docsData = await docsResponse.json();
      if (docsData.documents?.length > 0) {
        process.env.TEST_DOCUMENT_ID = docsData.documents[0].id;
        console.log('[auth.setup] Using existing document:', process.env.TEST_DOCUMENT_ID);
      }
    }
  }
});
