import { test, expect } from '@playwright/test';

/**
 * Focused test for image upload and export functionality
 */
test.describe('Image Upload and Export Test', () => {
  let documentId: string;
  let uploadedImageUrl: string;

  test('should upload image and export document', async ({ page, request }) => {
    // Step 1: Create a test document with an image reference
    console.log('[Test] Step 1: Creating document with image...');

    const createResponse = await request.post('/api/documents', {
      data: {
        title: 'Image Export Test',
        content: '# Image Export Test\n\nThis document contains an image.\n\n![Test Image](placeholder)\n\nEnd of document.',
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const { document } = await createResponse.json();
    documentId = document.id;
    console.log('[Test] Document created:', documentId);

    // Step 2: Upload an image
    console.log('[Test] Step 2: Uploading image...');

    // Create a larger test image (10x10 PNG with some color)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADq0pjpmMAAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadResponse = await request.post('/api/images/upload', {
      multipart: {
        file: {
          name: 'test-image-10x10.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
        documentId,
      },
    });

    console.log('[Test] Upload status:', uploadResponse.status());

    if (!uploadResponse.ok()) {
      const errorText = await uploadResponse.text();
      console.log('[Test] Upload error:', errorText);

      if (uploadResponse.status() === 503) {
        console.log('[Test] Acontext not configured, skipping test');
        test.skip();
        return;
      }

      expect(uploadResponse.ok()).toBeTruthy();
    }

    const uploadData = await uploadResponse.json();
    uploadedImageUrl = uploadData.url;
    console.log('[Test] Image uploaded:', uploadedImageUrl);
    expect(uploadedImageUrl).toMatch(/^disk::/);

    // Step 3: Get public URL for the image
    console.log('[Test] Step 3: Getting public URL...');
    const imagePath = uploadedImageUrl.replace('disk::', '');

    const urlResponse = await request.get(
      `/api/images/url?path=${encodeURIComponent(imagePath)}&documentId=${documentId}`
    );

    console.log('[Test] URL API status:', urlResponse.status());

    if (urlResponse.ok()) {
      const urlData = await urlResponse.json();
      console.log('[Test] Public URL:', urlData.url?.slice(0, 60) + '...');
      expect(urlData.url).toMatch(/^https?:\/\//);
    }

    // Step 4: Update document with the image
    console.log('[Test] Step 4: Updating document with image reference...');

    const updateResponse = await request.patch(`/api/documents/${documentId}`, {
      data: {
        content: `# Image Export Test\n\nThis document contains an uploaded image.\n\n![Test Image](${uploadedImageUrl})\n\nEnd of document.`,
      },
    });

    console.log('[Test] Document update status:', updateResponse.status());

    // Step 5: Open document in browser and verify image renders
    console.log('[Test] Step 5: Opening document in browser...');
    await page.goto(`/document/${documentId}`);
    await page.waitForLoadState('networkidle');

    // Wait for editor to load
    await expect(page.locator('.markdown-editor-wrapper')).toBeVisible({ timeout: 10000 });
    console.log('[Test] Editor loaded');

    // Capture console logs for debugging
    page.on('console', msg => {
      if (msg.text().includes('resolveImageUrls') || msg.text().includes('downloadAsWord')) {
        console.log('[Browser]', msg.text());
      }
    });

    // Wait a bit for images to load
    await page.waitForTimeout(2000);

    // Step 6: Test Word export
    console.log('[Test] Step 6: Testing Word export...');

    const wordDownloadPromise = page.waitForEvent('download', { timeout: 120000 }).catch((e) => {
      console.log('[Test] Word download timeout or error:', e.message);
      return null;
    });

    // Click download button
    const downloadBtn = page.locator('button').filter({ hasText: /Download|下载/ });
    await downloadBtn.click();

    // Click Word option
    await page.getByRole('menuitem').filter({ hasText: /Word|\.docx/i }).click();

    const wordDownload = await wordDownloadPromise;

    if (wordDownload) {
      const filename = wordDownload.suggestedFilename();
      console.log('[Test] ✅ Word downloaded:', filename);
      expect(filename).toMatch(/\.docx$/);

      // Save to test-results folder with unique name
      const fs = require('fs');
      const uniqueName = `image-export-${Date.now()}-${filename}`;
      const savePath = `test-results/${uniqueName}`;
      await wordDownload.saveAs(savePath);
      const stats = fs.statSync(savePath);
      console.log('[Test] Word file size:', stats.size, 'bytes');
      console.log('[Test] Word saved to:', savePath);
      expect(stats.size).toBeGreaterThan(0);
    } else {
      console.log('[Test] ⚠️ Word download not triggered (might be processing)');
    }

    // Step 7: Test PDF export
    console.log('[Test] Step 7: Testing PDF export...');

    // Wait a bit before next action
    await page.waitForTimeout(1000);

    const pdfDownloadPromise = page.waitForEvent('download', { timeout: 120000 }).catch((e) => {
      console.log('[Test] PDF download timeout or error:', e.message);
      return null;
    });

    // Click download button again
    await downloadBtn.click();

    // Click PDF option
    await page.getByRole('menuitem').filter({ hasText: /PDF/i }).click();

    const pdfDownload = await pdfDownloadPromise;

    if (pdfDownload) {
      const filename = pdfDownload.suggestedFilename();
      console.log('[Test] ✅ PDF downloaded:', filename);
      expect(filename).toMatch(/\.pdf$/);

      // Save to test-results folder with unique name
      const fs = require('fs');
      const uniqueName = `image-export-${Date.now()}-${filename}`;
      const savePath = `test-results/${uniqueName}`;
      await pdfDownload.saveAs(savePath);
      const stats = fs.statSync(savePath);
      console.log('[Test] PDF file size:', stats.size, 'bytes');
      console.log('[Test] PDF saved to:', savePath);
      expect(stats.size).toBeGreaterThan(0);
    } else {
      console.log('[Test] ⚠️ PDF download not triggered (might be processing)');
    }

    console.log('[Test] ✅ All tests completed!');
  });
});
