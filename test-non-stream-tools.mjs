/**
 * Test non-streaming with tools (no max_tokens)
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

console.log('Testing non-streaming with tools (NO max_tokens)...');
console.log('Endpoint:', endpoint);
console.log('Model:', model);
console.log();

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
          result: {
            type: 'string',
            description: 'The result text',
          },
        },
        required: ['result'],
      },
    },
  },
];

async function testNonStreamingWithTools() {
  console.log('=== Test: Non-streaming with tools, NO max_tokens ===');
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello and call the output_result tool with a greeting' }],
      // NO max_tokens
      tools,
      tool_choice: { type: 'function', function: { name: 'output_result' } },
      stream: false,
    });

    console.log('Completion received!');
    console.log('Content:', completion.choices[0]?.message?.content);
    console.log('Tool calls:', JSON.stringify(completion.choices[0]?.message?.tool_calls, null, 2));
    console.log('✅ Test PASSED!');
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
}

testNonStreamingWithTools();
