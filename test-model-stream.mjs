/**
 * Test streaming with different models + tools + max_tokens
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;

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

async function testModelStreaming(model) {
  console.log(`\n=== Testing streaming: ${model} ===`);
  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 100,
      tools,
      tool_choice: { type: 'function', function: { name: 'output_result' } },
      stream: true,
    });

    let content = '';
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        content += chunk.choices[0].delta.content;
      }
    }
    console.log(`✅ ${model}: SUCCESS`);
    console.log('Content:', content || '(tool call)');
    return true;
  } catch (error) {
    console.log(`❌ ${model}: FAILED - ${error.message}`);
    return false;
  }
}

async function main() {
  const models = ['gpt-5', 'gpt-5.1', 'gpt-4o', 'gpt-4o-mini'];
  const results = {};

  for (const model of models) {
    results[model] = await testModelStreaming(model);
  }

  console.log('\n=== Streaming Summary ===');
  for (const [model, success] of Object.entries(results)) {
    console.log(`${model}: ${success ? '✅ OK' : '❌ FAIL'}`);
  }
}

main();
