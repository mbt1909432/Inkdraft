/**
 * Test streaming with tools - to verify the hypothesis
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

console.log('Testing OpenAI SDK with streaming + tools...');
console.log('Endpoint:', endpoint);
console.log('Model:', model);
console.log();

const client = new OpenAI({
  apiKey,
  baseURL: endpoint,
});

// Define a simple tool
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

async function testStreamingWithTools() {
  console.log('Creating streaming completion with max_tokens: 100 AND tools...');

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'What is the weather in Beijing?' }
      ],
      max_tokens: 100,
      temperature: 0.7,
      tools,
      tool_choice: 'auto',
      stream: true,
    });

    console.log('Stream created successfully!');
    console.log('Receiving chunks...\n');

    let content = '';
    let toolCalls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        content += delta.content;
        process.stdout.write(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { id: '', name: '', arguments: '' };
          }
          if (tc.id) toolCalls[tc.index].id = tc.id;
          if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
          if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
        }
      }
    }

    console.log('\n\n--- Results ---');
    console.log('Content:', content || '(none)');
    console.log('Tool calls:', JSON.stringify(toolCalls.filter(Boolean), null, 2));
    console.log('\n✅ Streaming + tools test PASSED!');

  } catch (error) {
    console.error('\n❌ Streaming + tools test FAILED!');
    console.error('Error:', error.message);
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
}

testStreamingWithTools();
