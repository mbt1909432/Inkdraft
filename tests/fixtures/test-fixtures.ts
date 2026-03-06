import { test as base, APIRequestContext, Page } from '@playwright/test';

/**
 * Test user credentials type
 */
export interface TestUser {
  email: string;
  password: string;
}

/**
 * Test document type
 */
export interface TestDocument {
  id: string;
  title: string;
  content: string;
}

/**
 * Get test user credentials from environment
 */
export function getTestUser(): TestUser {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required');
  }

  return { email, password };
}

/**
 * Create a test document via API
 */
export async function createTestDocument(
  request: APIRequestContext,
  options: {
    title?: string;
    content?: string;
  } = {}
): Promise<TestDocument> {
  const title = options.title ?? `Test Document ${Date.now()}`;
  const content = options.content ?? '# Test Document\n\nThis is a test document for E2E testing.';

  const response = await request.post('/api/documents', {
    data: { title, content },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create test document: ${response.status()}`);
  }

  const data = await response.json();
  return {
    id: data.document.id,
    title,
    content,
  };
}

/**
 * Delete a test document via API
 */
export async function deleteTestDocument(
  request: APIRequestContext,
  documentId: string
): Promise<void> {
  await request.delete(`/api/documents/${documentId}`);
}

/**
 * Get an existing document or create a new one
 */
export async function getOrCreateDocument(
  request: APIRequestContext,
  options: {
    title?: string;
    content?: string;
  } = {}
): Promise<TestDocument> {
  // Try to get existing documents first
  const response = await request.get('/api/documents');

  if (response.ok()) {
    const data = await response.json();
    if (data.documents?.length > 0) {
      const doc = data.documents[0];
      return {
        id: doc.id,
        title: doc.title,
        content: doc.content,
      };
    }
  }

  // Create a new document if none exist
  return createTestDocument(request, options);
}

/**
 * Wait for API response with timeout
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? 10000;

  await page.waitForResponse(
    async (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Create a test image buffer (1x1 red pixel PNG)
 */
export function createTestImageBuffer(): Buffer {
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  return Buffer.from(testImageBase64, 'base64');
}

/**
 * Create a test image file object for Playwright
 */
export function createTestImageFile(name: string = 'test-image.png'): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return {
    name,
    mimeType: 'image/png',
    buffer: createTestImageBuffer(),
  };
}

/**
 * Create a simple test PDF buffer (minimal valid PDF with text)
 * This creates a 1-page PDF with "Hello World" text
 */
export function createTestPDFBuffer(): Buffer {
  // Minimal valid PDF with text content
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF Content) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000359 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
440
%%EOF`;
  return Buffer.from(pdfContent, 'binary');
}

/**
 * Create a test PDF file object for Playwright
 */
export function createTestPDFFile(name: string = 'test-document.pdf'): {
  name: string;
  mimeType: string;
  buffer: Buffer;
} {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: createTestPDFBuffer(),
  };
}

/**
 * Extended test fixture with common test utilities
 */
export const test = base.extend<{
  /**
   * Authenticated test user
   */
  testUser: TestUser;

  /**
   * Test document created for the test
   */
  testDocument: TestDocument;
}>({
  testUser: async ({}, use) => {
    const user = getTestUser();
    await use(user);
  },

  testDocument: async ({ request }, use) => {
    const document = await createTestDocument(request);
    await use(document);
    // Cleanup after test
    await deleteTestDocument(request, document.id);
  },
});

export { expect } from '@playwright/test';
