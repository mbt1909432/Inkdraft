import { test, expect } from '@playwright/test';

test.describe('Web Search Feature', () => {
  test('web search API returns results for English query', async ({ request }) => {
    // Test with English query that DuckDuckGo handles better
    const response = await request.get('/api/web-search?q=JavaScript');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    console.log('Web search API response:', JSON.stringify(data, null, 2).slice(0, 500));

    // Should have results
    expect(data).toHaveProperty('query');
    expect(data.query).toBe('JavaScript');
    expect(data.results).toBeDefined();
    expect(data.results.length).toBeGreaterThan(0);

    // First result should have expected fields
    const firstResult = data.results[0];
    expect(firstResult).toHaveProperty('title');
    expect(firstResult).toHaveProperty('url');
    expect(firstResult).toHaveProperty('snippet');
    expect(firstResult).toHaveProperty('source');
  });

  test('web search API handles empty results gracefully', async ({ request }) => {
    // Test with a query that might not have instant answers
    const response = await request.get('/api/web-search?q=asdfghjkl12345');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    console.log('Empty results response:', JSON.stringify(data, null, 2).slice(0, 300));

    expect(data).toHaveProperty('query');
    // Should have results array (even if empty) or a message
    expect(data.results !== undefined || data.message !== undefined).toBeTruthy();
  });

  test('web search API validates query parameter', async ({ request }) => {
    // Test without query parameter
    const response = await request.get('/api/web-search');

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('Missing query parameter');
  });
});
