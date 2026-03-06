/**
 * Capture the actual request body sent by OpenAI SDK
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

// Create a mock server to capture the request
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log('\n=== Actual Request Sent by SDK ===');
  console.log('URL:', url);
  console.log('Request Body:', JSON.stringify(JSON.parse(options.body), null, 2));
  console.log('=================================\n');

  // Call original fetch
  return originalFetch(url, options);
};

const client = new OpenAI({
  apiKey,
  baseURL: endpoint,
});

const tools = [
  {
    type: 'function',
    function: {
      name: 'output_result',
      description: 'Output the result',
      parameters: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'The result text' },
        },
        required: ['result'],
      },
    },
  },
];

async function test() {
  console.log('Testing to capture SDK request body...');

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 100,
      tools,
      tool_choice: { type: 'function', function: { name: 'output_result' } },
    });
    console.log('Success:', completion.choices[0]?.message);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
