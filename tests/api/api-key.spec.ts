import { test, expect } from '@playwright/test';

/**
 * E2E test for API Key feature
 * Tests: Create API Key → Use External API → Delete API Key
 */

// Run tests sequentially to avoid race conditions
test.describe.configure({ mode: 'serial' });

test.describe('API Key Feature', () => {

  // Cleanup before all tests - delete all existing API keys via API
  test.beforeAll(async ({ request }) => {
    // Get all existing API keys
    const response = await request.get('/api/api-keys');
    if (response.ok()) {
      const data = await response.json();
      const keys = data.keys || [];
      console.log('[API Key] Found', keys.length, 'existing keys');

      // Delete each key
      for (const key of keys) {
        await request.delete(`/api/api-keys/${key.id}`);
      }
      console.log('[API Key] Cleaned up existing keys');
    }
  });

  test('should navigate to settings and see API Keys section', async ({ page }) => {
    // Go to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should see API Keys section (CardTitle might not be semantic heading)
    await expect(page.getByText('API Keys', { exact: true }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Create/i })).toBeVisible({ timeout: 5000 });
  });

  test('should create a new API key', async ({ page }) => {
    // Go to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click create key button
    await page.getByRole('button', { name: /Create/i }).first().click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill key name
    const keyName = `E2E Test Key ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);

    // Click create in dialog
    await page.getByRole('dialog').getByRole('button', { name: /^Create$/ }).click();

    // Should show success dialog with the key
    await expect(page.getByRole('heading', { name: /API Key Created/i })).toBeVisible({ timeout: 10000 });

    // Get the API key value
    const keyInput = page.getByRole('dialog').getByRole('textbox', { readonly: true });
    const apiKey = await keyInput.inputValue();
    console.log('[API Key] Created key:', apiKey.slice(0, 15) + '...');

    expect(apiKey).toMatch(/^sk_/);

    // Close dialog
    await page.getByRole('dialog').getByRole('button', { name: /Done/i }).click();

    // Wait for dialog to close (use specific dialog with the API key)
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /API Key Created/i })).not.toBeVisible({ timeout: 5000 });

    // Should see the key in list
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });

    console.log('[API Key] ✅ Key created successfully');
  });

  test('should create key and test external API', async ({ page, request }) => {
    // Step 1: Create API Key
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const keyName = `API Test ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$/ }).click();

    await expect(page.getByRole('heading', { name: /API Key Created/i })).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByRole('dialog').getByRole('textbox', { readonly: true });
    const apiKey = await keyInput.inputValue();
    console.log('[API Key] Created key for API test:', apiKey);
    console.log('[API Key] Key length:', apiKey.length);

    await page.getByRole('dialog').getByRole('button', { name: /Done/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /API Key Created/i })).not.toBeVisible({ timeout: 5000 });

    // Step 2: Test external API - Upload document
    console.log('[API Key] Testing external API upload...');

    const uploadResponse = await request.post('/api/external/documents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'E2E API Test Document',
        content: '# Test\n\nThis document was created via external API.\n\n- Item 1\n- Item 2',
      },
    });

    console.log('[API Key] Upload response:', uploadResponse.status());
    expect(uploadResponse.status()).toBe(200);

    const uploadData = await uploadResponse.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.document.title).toBe('E2E API Test Document');
    console.log('[API Key] Document created:', uploadData.document.id);

    // Step 3: Test external API - List documents
    console.log('[API Key] Testing external API list...');

    const listResponse = await request.get('/api/external/documents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log('[API Key] List response:', listResponse.status());
    expect(listResponse.status()).toBe(200);

    const listData = await listResponse.json();
    expect(listData.success).toBe(true);
    expect(Array.isArray(listData.documents)).toBe(true);
    console.log('[API Key] Documents count:', listData.documents.length);

    // Verify our document is in the list
    const ourDoc = listData.documents.find((d: { id: string }) => d.id === uploadData.document.id);
    expect(ourDoc).toBeDefined();

    // Step 4: Clean up - delete the API key
    console.log('[API Key] Cleaning up...');

    // Refresh page to ensure key is visible
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find the key row and click delete
    const keyRow = page.locator('div').filter({ hasText: new RegExp(keyName) }).first();
    await keyRow.getByRole('button', { name: /Delete|Trash/i }).click();

    // Confirm delete in alert dialog
    await page.getByRole('alertdialog').getByRole('button', { name: /Delete/i }).click();

    // Wait for key to be removed
    await expect(page.getByText(keyName)).not.toBeVisible({ timeout: 5000 });

    console.log('[API Key] ✅ All tests passed!');
  });

  test('should reject invalid API key', async ({ request }) => {
    const response = await request.get('/api/external/documents', {
      headers: {
        'Authorization': 'Bearer sk_invalid_fake_key_12345',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Invalid');
    console.log('[API Key] Invalid key correctly rejected');
  });

  test('should reject missing API key', async ({ request }) => {
    const response = await request.get('/api/external/documents');

    expect(response.status()).toBe(401);
    console.log('[API Key] Missing key correctly rejected');
  });

  test('should upload file via form data', async ({ page, request }) => {
    // Create API Key first
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const keyName = `File Upload Test ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$/ }).click();

    await expect(page.getByRole('heading', { name: /API Key Created/i })).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByRole('dialog').getByRole('textbox', { readonly: true });
    const apiKey = await keyInput.inputValue();

    await page.getByRole('dialog').getByRole('button', { name: /Done/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /API Key Created/i })).not.toBeVisible({ timeout: 5000 });

    // Test file upload
    console.log('[API Key] Testing file upload...');

    const markdownContent = `# File Upload Test

This content was uploaded as a file.

\`\`\`javascript
console.log("Hello from file!");
\`\`\`
`;

    const uploadResponse = await request.post('/api/external/documents', {
      multipart: {
        file: {
          name: 'test-document.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from(markdownContent),
        },
        title: 'Uploaded via File',
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log('[API Key] File upload response:', uploadResponse.status());
    expect(uploadResponse.status()).toBe(200);

    const uploadData = await uploadResponse.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.document.title).toBe('Uploaded via File');
    console.log('[API Key] File uploaded successfully');

    // Clean up
    await page.reload();
    await page.waitForLoadState('networkidle');

    const keyRow = page.locator('div').filter({ hasText: new RegExp(keyName) }).first();
    await keyRow.getByRole('button', { name: /Delete|Trash/i }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Delete/i }).click();
    await expect(page.getByText(keyName)).not.toBeVisible({ timeout: 5000 });

    console.log('[API Key] ✅ File upload test passed!');
  });
});
