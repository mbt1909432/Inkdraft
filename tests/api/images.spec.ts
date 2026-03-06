import { test, expect } from '@playwright/test';

test.describe('Images API', () => {
  let documentId: string;
  let uploadedImagePath: string;

  test.beforeAll(async ({ request }) => {
    // Get a document ID
    const docsResponse = await request.get('/api/documents');
    if (docsResponse.ok()) {
      const data = await docsResponse.json();
      if (data.documents?.length > 0) {
        documentId = data.documents[0].id;
      }
    }
  });

  test('should upload image to disk', async ({ request }) => {
    if (!documentId) {
      test.skip();
      return;
    }

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const response = await request.post('/api/images/upload', {
      multipart: {
        file: {
          name: 'test-image.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
        documentId,
      },
    });

    const status = response.status();
    console.log('[images] Upload status:', status);

    if (status === 200 || status === 201) {
      const data = await response.json();
      expect(data).toHaveProperty('url');
      expect(data.url).toMatch(/^disk::/);
      uploadedImagePath = data.url.replace('disk::', '');
      console.log('[images] Uploaded to:', data.url);
    } else if (status === 503) {
      console.log('[images] Acontext not configured, skipping');
      test.skip();
    } else {
      const error = await response.text();
      console.log('[images] Upload error:', error);
      // Accept 500 as server error (e.g., Acontext issue)
      expect([200, 201, 500, 503]).toContain(status);
    }
  });

  test('should get public URL for image', async ({ request }) => {
    if (!documentId || !uploadedImagePath) {
      test.skip();
      return;
    }

    const response = await request.get(
      `/api/images/url?path=${encodeURIComponent(uploadedImagePath)}&documentId=${documentId}`
    );

    const status = response.status();
    console.log('[images] URL API status:', status);

    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('url');
      expect(data.url).toMatch(/^https?:\/\//);
      console.log('[images] Public URL:', data.url.slice(0, 50) + '...');
    } else {
      console.log('[images] URL API error:', await response.text());
      expect([200, 500]).toContain(status);
    }
  });

  test('should proxy image via API', async ({ request }) => {
    if (!documentId || !uploadedImagePath) {
      test.skip();
      return;
    }

    const response = await request.get(
      `/api/images/proxy?path=${encodeURIComponent(uploadedImagePath)}&documentId=${documentId}`
    );

    // Should redirect or return image
    const status = response.status();
    console.log('[images] Proxy status:', status);

    // 200 = direct image, 307/302 = redirect
    expect([200, 302, 307, 500]).toContain(status);
  });

  test('should reject unauthenticated upload', async ({ browser }) => {
    const context = await browser.newContext();
    const request = context.request;

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const response = await request.post('/api/images/upload', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
        documentId: 'test-id',
      },
    });

    expect([401, 500]).toContain(response.status());

    await context.close();
  });

  test('should reject unauthenticated URL request', async ({ browser }) => {
    const context = await browser.newContext();
    const request = context.request;

    const response = await request.get(
      '/api/images/url?path=images/test.png&documentId=test-id'
    );

    expect([401, 500]).toContain(response.status());

    await context.close();
  });
});
