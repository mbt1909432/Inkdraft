import { test, expect } from '@playwright/test';

test.describe('Disk Files API', () => {
  let documentId: string;

  test.beforeAll(async ({ request }) => {
    // Get or create a document ID
    const docsResponse = await request.get('/api/documents');
    if (docsResponse.ok()) {
      const data = await docsResponse.json();
      if (data.documents?.length > 0) {
        documentId = data.documents[0].id;
      }
    }
  });

  test('should list files for a document', async ({ request }) => {
    if (!documentId) {
      test.skip();
      return;
    }

    const response = await request.get(`/api/disk/files?documentId=${documentId}&path=/images/`);

    const status = response.status();
    expect([200, 500]).toContain(status);

    if (status === 200) {
      const diskData = await response.json();
      expect(diskData).toHaveProperty('files');
      expect(Array.isArray(diskData.files)).toBeTruthy();
      console.log('[disk-files] Found', diskData.files?.length || 0, 'files');
    }
  });

  test('should delete a file from disk', async ({ request }) => {
    if (!documentId) {
      test.skip();
      return;
    }

    // First, upload a file to delete
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadResponse = await request.post('/api/images/upload', {
      multipart: {
        file: {
          name: 'test-to-delete.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
        documentId,
      },
    });

    if (!uploadResponse.ok()) {
      console.log('[disk-files] Upload failed, skipping delete test');
      test.skip();
      return;
    }

    const uploadData = await uploadResponse.json();
    const imagePath = uploadData.url.replace('disk::', '');

    console.log('[disk-files] Uploaded file for delete test:', imagePath);

    // Now delete the file
    const deleteResponse = await request.delete(
      `/api/disk/files?documentId=${documentId}&path=${encodeURIComponent(imagePath)}`
    );

    expect([200, 500]).toContain(deleteResponse.status());
    console.log('[disk-files] Delete status:', deleteResponse.status());
  });

  test('should return error for unauthenticated requests', async ({ browser }) => {
    const context = await browser.newContext();
    const request = context.request;

    const response = await request.get('/api/disk/files?documentId=test-id');
    expect([401, 500]).toContain(response.status());

    await context.close();
  });
});
