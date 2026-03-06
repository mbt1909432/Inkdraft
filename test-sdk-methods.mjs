/**
 * Test different OpenAI SDK methods for streaming with tools
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

console.log('Testing different SDK methods...');
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
      name: 'get_weather',
      description: 'Get the current weather in a given location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
        },
        required: ['location'],
      },
    },
  },
];

// Test 1: Using client.chat.completions.stream() method
async function testStreamMethod() {
  console.log('=== Test 1: client.chat.completions.stream() ===');
  try {
    const stream = await client.chat.completions.stream({
      model,
      messages: [{ role: 'user', content: 'What is the weather in Beijing?' }],
      max_tokens: 100,
      tools,
    });

    console.log('Stream created successfully!');

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        process.stdout.write(delta.content);
      }
    }

    console.log('\n✅ Test 1 PASSED!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message, '\n');
    return false;
  }
}

// Test 2: Using client.chat.completions.runTools() with stream: true
async function testRunToolsMethod() {
  console.log('=== Test 2: client.chat.completions.runTools() with stream: true ===');
  try {
    const runner = await client.chat.completions.runTools({
      model,
      messages: [{ role: 'user', content: 'What is the weather in Shanghai?' }],
      max_tokens: 100,
      stream: true,
      tools,
    });

    console.log('Runner created successfully!');

    for await (const chunk of runner) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        process.stdout.write(delta.content);
      }
    }

    console.log('\n✅ Test 2 PASSED!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Test 2 FAILED:', error.message, '\n');
    return false;
  }
}

// Test 3: Using create() without max_tokens
async function testCreateWithoutMaxTokens() {
  console.log('=== Test 3: create() with stream: true, NO max_tokens ===');
  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      // No max_tokens
      stream: true,
      tools,
    });

    console.log('Stream created successfully!');

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        process.stdout.write(delta.content);
      }
    }

    console.log('\n✅ Test 3 PASSED!\n');
    return true;
  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message, '\n');
    return false;
  }
}

async function main() {
  await testStreamMethod();
  await testRunToolsMethod();
  await testCreateWithoutMaxTokens();
}

main().catch(console.error);
