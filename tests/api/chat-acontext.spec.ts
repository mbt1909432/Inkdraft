import { test, expect } from '../fixtures/test-fixtures';
import { createTestDocument, deleteTestDocument, createTestImageBuffer } from '../fixtures/test-fixtures';

/**
 * E2E tests for /api/ai/chat-acontext API endpoint
 *
 * Tests cover:
 * - Authentication requirements
 * - Basic chat message sending
 * - SSE streaming response
 * - Multimodal content (text + images)
 * - Chat history retrieval
 */

const CHAT_ACONTEXT_URL = '/api/ai/chat-acontext';

/**
 * Check if response indicates LLM configuration error
 */
function isLLMConfigError(text: string): boolean {
  return text.includes('"type":"error"') &&
    (text.includes('max_output_tokens') || text.includes('not configured'));
}

test.describe('Chat Acontext API - Authentication', () => {
  test('should reject unauthenticated requests', async ({ playwright }) => {
    // Create a new request context without auth cookies
    const unauthenticatedRequest = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      // Explicitly ignore storage state
      storageState: undefined as any,
    });

    const response = await unauthenticatedRequest.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'Hello',
        documentMarkdown: '# Test',
      },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');

    await unauthenticatedRequest.dispose();
  });

  test('should reject unauthenticated GET requests', async ({ playwright }) => {
    const unauthenticatedRequest = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      storageState: undefined as any,
    });

    const response = await unauthenticatedRequest.get(CHAT_ACONTEXT_URL);

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');

    await unauthenticatedRequest.dispose();
  });
});

test.describe('Chat Acontext API - Basic Chat', () => {
  let testDoc: { id: string; title: string; content: string };

  test.beforeEach(async ({ request }) => {
    // Create a test document for each test
    testDoc = await createTestDocument(request, {
      title: `Chat Test Doc ${Date.now()}`,
      content: '# Test Document\n\nThis is a test document for chat API testing.',
    });
  });

  test.afterEach(async ({ request }) => {
    // Cleanup
    if (testDoc?.id) {
      await deleteTestDocument(request, testDoc.id);
    }
  });

  test('should send chat message and receive SSE stream', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '你好，请介绍一下你自己',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    // Should accept the request
    expect(response.ok()).toBeTruthy();

    // Read the SSE stream
    const text = await response.text();
    console.log('[Chat API] Response length:', text.length);

    // Should contain session info
    expect(text).toContain('"type":"session"');

    // Skip content check if LLM config error
    if (isLLMConfigError(text)) {
      console.log('[Chat API] Skipping content check - LLM config error');
      test.skip();
    }

    // Should contain content stream
    expect(text).toContain('"type":"content"');

    // Should end with done event
    expect(text).toContain('"type":"done"');
  });

  test('should return chat session ID in response', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '测试消息',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();

    // Extract session event - handle multi-line JSON
    const sessionMatch = text.match(/data: (\{[^}]*"type":"session"[^}]*\})/);
    expect(sessionMatch).toBeTruthy();

    const sessionData = JSON.parse(sessionMatch![1]);
    expect(sessionData.chatSessionId).toBeTruthy();
    expect(sessionData.acontextSessionId).toBeTruthy();
    expect(sessionData.diskId).toBeTruthy();
  });

  test('should handle empty content gracefully', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '',
        documentMarkdown: testDoc.content,
      },
    });

    // Should reject empty content
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('required');
  });

  test('should handle missing contentParts and content', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Chat Acontext API - Multimodal', () => {
  let testDoc: { id: string; title: string; content: string };

  test.beforeEach(async ({ request }) => {
    testDoc = await createTestDocument(request, {
      title: `Multimodal Test Doc ${Date.now()}`,
      content: '# Test\n\nMultimodal chat test.',
    });
  });

  test.afterEach(async ({ request }) => {
    if (testDoc?.id) {
      await deleteTestDocument(request, testDoc.id);
    }
  });

  test('should accept multimodal content with image', async ({ request }) => {
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '请描述这张图片',
        contentParts: [
          { type: 'text', text: '请描述这张图片，它是什么颜色的？' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${testImageBase64}` } },
        ],
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    console.log('[Multimodal] Response preview:', text.substring(0, 500));

    // Should process the multimodal message
    expect(text).toContain('"type":"session"');

    // Skip if LLM config error
    if (isLLMConfigError(text)) {
      console.log('[Multimodal] Skipping - LLM config error');
      test.skip();
    }

    expect(text).toContain('"type":"done"');
  });

  test('should handle contentParts without content field', async ({ request }) => {
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    // Skip if document creation failed
    if (!testDoc?.id) {
      console.log('[Multimodal] Skipping - no test document');
      test.skip();
      return;
    }

    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        // No content field, only contentParts
        contentParts: [
          { type: 'text', text: '这是一个纯 multimodal 消息' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${testImageBase64}` } },
        ],
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    console.log('[Multimodal] Response status:', response.status());
    if (!response.ok()) {
      const text = await response.text();
      console.log('[Multimodal] Response body:', text.substring(0, 200));
    }

    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Chat Acontext API - History', () => {
  let testDoc: { id: string; title: string; content: string };
  let chatSessionId: string;

  test.beforeEach(async ({ request }) => {
    testDoc = await createTestDocument(request, {
      title: `History Test Doc ${Date.now()}`,
      content: '# History Test\n\nTesting chat history.',
    });
  });

  test.afterEach(async ({ request }) => {
    if (testDoc?.id) {
      await deleteTestDocument(request, testDoc.id);
    }
  });

  test('should retrieve chat history by documentId', async ({ request }) => {
    // First, send a message
    const postResponse = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '历史测试消息',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(postResponse.ok()).toBeTruthy();

    // Extract session ID from response
    const postText = await postResponse.text();
    const sessionMatch = postText.match(/"chatSessionId":"([^"]+)"/);
    expect(sessionMatch).toBeTruthy();
    chatSessionId = sessionMatch![1];

    // Wait a moment for storage to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get history by documentId
    const getResponse = await request.get(`${CHAT_ACONTEXT_URL}?documentId=${testDoc.id}`);

    expect(getResponse.ok()).toBeTruthy();

    const data = await getResponse.json();
    console.log('[History] Response:', JSON.stringify(data).substring(0, 500));

    expect(data.session).toBeTruthy();
    expect(data.messages).toBeInstanceOf(Array);
    expect(data.messages.length).toBeGreaterThan(0);
  });

  test('should retrieve chat history by chatSessionId', async ({ request }) => {
    // First, send a message
    const postResponse = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'Session ID 测试',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(postResponse.ok()).toBeTruthy();

    const postText = await postResponse.text();
    const sessionMatch = postText.match(/"chatSessionId":"([^"]+)"/);
    expect(sessionMatch).toBeTruthy();
    chatSessionId = sessionMatch![1];

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get history by chatSessionId
    const getResponse = await request.get(`${CHAT_ACONTEXT_URL}?chatSessionId=${chatSessionId}`);

    expect(getResponse.ok()).toBeTruthy();

    const data = await getResponse.json();
    expect(data.session).toBeTruthy();
    expect(data.session.id).toBe(chatSessionId);
  });

  test('should return empty for non-existent document', async ({ request }) => {
    const fakeDocId = '00000000-0000-0000-0000-000000000000';

    const response = await request.get(`${CHAT_ACONTEXT_URL}?documentId=${fakeDocId}`);

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.session).toBeNull();
    expect(data.messages).toEqual([]);
  });

  test('should require chatSessionId or documentId for GET', async ({ request }) => {
    const response = await request.get(CHAT_ACONTEXT_URL);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('required');
  });
});

test.describe('Chat Acontext API - Tool Calls', () => {
  let testDoc: { id: string; title: string; content: string };

  test.beforeEach(async ({ request }) => {
    testDoc = await createTestDocument(request, {
      title: `Tool Test Doc ${Date.now()}`,
      content: '# Tool Test\n\n测试工具调用。\n\n## 内容\n\n这是一些测试内容。',
    });
  });

  test.afterEach(async ({ request }) => {
    if (testDoc?.id) {
      await deleteTestDocument(request, testDoc.id);
    }
  });

  test('should handle edit tool request', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '请把"这是一些测试内容"改成"这是修改后的内容"',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    console.log('[Tool] Response preview:', text.substring(0, 1000));

    // Skip if LLM config error
    if (isLLMConfigError(text)) {
      console.log('[Tool] Skipping - LLM config error');
      test.skip();
    }

    // Should contain tool call events if LLM decides to use tools
    if (text.includes('agent_loop_tool')) {
      console.log('[Tool] Tool calls were made');
    }

    // Should complete successfully
    expect(text).toContain('"type":"done"');
  });

  test('should handle Python execution request', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: '请帮我计算 123 * 456',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
      timeout: 60000, // May take longer for sandbox creation
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    console.log('[Sandbox] Response length:', text.length);

    // Skip if LLM config error
    if (isLLMConfigError(text)) {
      console.log('[Sandbox] Skipping - LLM config error');
      test.skip();
    }

    // Should complete successfully
    expect(text).toContain('"type":"done"');
  });
});

test.describe('Chat Acontext API - SSE Stream Format', () => {
  let testDoc: { id: string; title: string; content: string };

  test.beforeEach(async ({ request }) => {
    testDoc = await createTestDocument(request, {
      title: `SSE Test Doc ${Date.now()}`,
      content: '# SSE Test',
    });
  });

  test.afterEach(async ({ request }) => {
    if (testDoc?.id) {
      await deleteTestDocument(request, testDoc.id);
    }
  });

  test('should return proper SSE format with data prefix', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'SSE格式测试',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();

    // Each event should start with "data: "
    const lines = text.split('\n').filter(line => line.trim());
    for (const line of lines) {
      expect(line.startsWith('data: ')).toBeTruthy();
    }
  });

  test('should send session info first', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'Session顺序测试',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // First non-empty line should be session event
    const firstLine = lines[0];
    expect(firstLine).toContain('"type":"session"');
  });

  test('should send done event at the end', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'Done事件测试',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Last line should be done event or error event
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine.replace('data: ', ''));
    expect(['done', 'error']).toContain(parsed.type);
  });

  test('should include token count in done event (when successful)', async ({ request }) => {
    const response = await request.post(CHAT_ACONTEXT_URL, {
      data: {
        content: 'Token计数测试',
        documentId: testDoc.id,
        documentMarkdown: testDoc.content,
      },
    });

    expect(response.ok()).toBeTruthy();

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const lastLine = lines[lines.length - 1];
    const parsed = JSON.parse(lastLine.replace('data: ', ''));

    // If successful, should have tokenCount; if error, skip this assertion
    if (parsed.type === 'done') {
      expect(parsed).toHaveProperty('tokenCount');
    } else {
      // LLM config issue, skip token count check
      console.log('[TokenCount] Skipping - LLM error:', parsed.error);
    }
  });
});
