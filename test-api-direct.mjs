/**
 * Direct API test to debug max_tokens issue
 */

import 'dotenv/config';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

console.log('Testing API directly...');
console.log('Endpoint:', endpoint);
console.log('Model:', model);
console.log();

// Test with fetch directly
async function testWithFetch() {
  const url = `${endpoint}/chat/completions`;

  const body = {
    model,
    messages: [
      { role: 'user', content: 'Say hello' }
    ],
    max_tokens: 100,  // Small value for testing
    temperature: 0.7,
  };

  console.log('Request body:', JSON.stringify(body, null, 2));
  console.log();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  console.log('Response status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
}

testWithFetch().catch(console.error);
