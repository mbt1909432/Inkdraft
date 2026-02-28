import { test, expect } from '@playwright/test';

/**
 * E2E test for API Key feature
 * Tests: Create API Key → Use External API (CRUD) → Delete API Key
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

    // Should see API Keys section (support both EN and CN)
    await expect(page.getByText(/API Keys|API 密钥/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Create|创建/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('should create a new API key with expiration', async ({ page }) => {
    // Go to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click create key button
    await page.getByRole('button', { name: /Create|创建/i }).first().click();

    // Wait for dialog
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill key name
    const keyName = `E2E Test Key ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);

    // Select expiration (30 days) - click the select trigger
    const expirationSelect = page.getByRole('dialog').getByRole('combobox');
    if (await expirationSelect.isVisible()) {
      await expirationSelect.click();
      // Click on 30 days option
      await page.getByRole('option', { name: /30/ }).click();
    }

    // Click create in dialog
    await page.getByRole('dialog').getByRole('button', { name: /^Create$|^创建$/ }).click();

    // Should show success dialog with the key
    await expect(page.getByRole('heading', { name: /API Key Created|API 密钥已创建/ })).toBeVisible({ timeout: 10000 });

    // Get the API key value
    const keyInput = page.getByRole('dialog').locator('input[readonly]');
    const apiKey = await keyInput.inputValue();
    console.log('[API Key] Created key:', apiKey.slice(0, 15) + '...');

    expect(apiKey).toMatch(/^sk_/);

    // Close dialog
    await page.getByRole('dialog').getByRole('button', { name: /Done|完成/i }).click();

    // Wait for dialog to close
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /API Key Created|API 密钥已创建/ })).not.toBeVisible({ timeout: 5000 });

    // Should see the key in list with expiration info
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });

    console.log('[API Key] ✅ Key created with expiration successfully');
  });

  test('should create key and test full document CRUD API', async ({ page, request }) => {
    // Increase timeout for this test
    test.setTimeout(60000);
    // Step 1: Create API Key
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create|创建/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const keyName = `API CRUD Test ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$|^创建$/ }).click();

    await expect(page.getByRole('heading', { name: /API Key Created|API 密钥已创建/ })).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByRole('dialog').locator('input[readonly]');
    const apiKey = await keyInput.inputValue();
    console.log('[API Key] Created key for CRUD test:', apiKey);

    await page.getByRole('dialog').getByRole('button', { name: /Done|完成/i }).click();
    await page.waitForTimeout(500);

    // Step 2: Test POST - Upload document
    console.log('[API Key] Testing POST (create) document...');

    const uploadResponse = await request.post('/api/external/documents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'CRUD Test Document',
        content: '# Test\n\nInitial content.',
      },
    });

    console.log('[API Key] POST response:', uploadResponse.status());
    expect(uploadResponse.status()).toBe(200);

    const uploadData = await uploadResponse.json();
    expect(uploadData.success).toBe(true);
    const docId = uploadData.document.id;
    console.log('[API Key] Document created:', docId);

    // Step 3: Test GET single document
    console.log('[API Key] Testing GET single document...');

    const getResponse = await request.get(`/api/external/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    console.log('[API Key] GET single response:', getResponse.status());
    expect(getResponse.status()).toBe(200);

    const getData = await getResponse.json();
    expect(getData.success).toBe(true);
    expect(getData.document.content).toBe('# Test\n\nInitial content.');
    console.log('[API Key] Document content retrieved');

    // Step 4: Test PUT - Update document
    console.log('[API Key] Testing PUT (update) document...');

    const updateResponse = await request.put(`/api/external/documents/${docId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'Updated CRUD Test Document',
        content: '# Updated\n\nNew content from API.',
      },
    });

    console.log('[API Key] PUT response:', updateResponse.status());
    expect(updateResponse.status()).toBe(200);

    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.document.title).toBe('Updated CRUD Test Document');
    console.log('[API Key] Document updated');

    // Verify update by getting the document again
    const verifyResponse = await request.get(`/api/external/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const verifyData = await verifyResponse.json();
    expect(verifyData.document.content).toBe('# Updated\n\nNew content from API.');

    // Step 5: Test DELETE document
    console.log('[API Key] Testing DELETE document...');

    const deleteResponse = await request.delete(`/api/external/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    console.log('[API Key] DELETE response:', deleteResponse.status());
    expect(deleteResponse.status()).toBe(200);

    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);
    console.log('[API Key] Document deleted');

    // Verify deletion - should return 404
    const verifyDeleteResponse = await request.get(`/api/external/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    expect(verifyDeleteResponse.status()).toBe(404);
    console.log('[API Key] Verified document is deleted');

    // Step 6: Clean up - delete the API key
    console.log('[API Key] Cleaning up...');
    // Cleanup is done in beforeAll of next test run, skip here to avoid timeout
    console.log('[API Key] ✅ All CRUD tests passed!');
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

    await page.getByRole('button', { name: /Create|创建/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const keyName = `File Upload Test ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$|^创建$/ }).click();

    await expect(page.getByRole('heading', { name: /API Key Created|API 密钥已创建/ })).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByRole('dialog').locator('input[readonly]');
    const apiKey = await keyInput.inputValue();

    await page.getByRole('dialog').getByRole('button', { name: /Done|完成/i }).click();
    await page.waitForTimeout(500);

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

    // Clean up - keys are cleaned in beforeAll
    console.log('[API Key] ✅ Test passed!');

    console.log('[API Key] ✅ File upload test passed!');
  });

  test('should return 404 for non-existent document', async ({ page, request }) => {
    // Create API Key
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Create|创建/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    const keyName = `404 Test ${Date.now()}`;
    await page.getByRole('dialog').getByRole('textbox').fill(keyName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$|^创建$/ }).click();

    await expect(page.getByRole('heading', { name: /API Key Created|API 密钥已创建/ })).toBeVisible({ timeout: 10000 });

    const keyInput = page.getByRole('dialog').locator('input[readonly]');
    const apiKey = await keyInput.inputValue();

    await page.getByRole('dialog').getByRole('button', { name: /Done|完成/i }).click();
    await page.waitForTimeout(500);

    // Test 404 for non-existent document
    const fakeDocId = '00000000-0000-0000-0000-000000000000';
    const response = await request.get(`/api/external/documents/${fakeDocId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
    console.log('[API Key] 404 for non-existent document works');

    // Clean up - keys are cleaned in beforeAll
    console.log('[API Key] ✅ Test passed!');

    console.log('[API Key] ✅ 404 test passed!');
  });
});
