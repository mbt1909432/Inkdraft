/**
 * Test different models with tools + max_tokens
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

async function testModel(model) {
  console.log(`\n=== Testing model: ${model} ===`);
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 100,
      tools,
      tool_choice: { type: 'function', function: { name: 'output_result' } },
    });
    console.log(`✅ ${model}: SUCCESS`);
    console.log('Tool call:', completion.choices[0]?.message?.tool_calls?.[0]?.function?.arguments);
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
    results[model] = await testModel(model);
  }

  console.log('\n=== Summary ===');
  for (const [model, success] of Object.entries(results)) {
    console.log(`${model}: ${success ? '✅ OK' : '❌ FAIL'}`);
  }
}

main();
