/**
 * Test streaming with OpenAI SDK
 */

import 'dotenv/config';
import OpenAI from 'openai';

const endpoint = process.env.OPENAI_LLM_ENDPOINT;
const apiKey = process.env.OPENAI_LLM_API_KEY;
const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

console.log('Testing OpenAI SDK with streaming...');
console.log('Endpoint:', endpoint);
console.log('Model:', model);
console.log('SDK version:', OpenAI.VERSION || 'unknown');
console.log();

const client = new OpenAI({
  apiKey,
  baseURL: endpoint,
});

async function testStreaming() {
  console.log('Creating streaming completion with max_tokens: 100...');

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'Say hello in one sentence.' }
      ],
      max_tokens: 100,
      temperature: 0.7,
      stream: true,
    });

    console.log('Stream created successfully!');
    console.log('Receiving chunks...');

    let content = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
        process.stdout.write(delta);
      }
    }

    console.log('\n\nFull response:', content);
    console.log('\n✅ Streaming test PASSED!');

  } catch (error) {
    console.error('\n❌ Streaming test FAILED!');
    console.error('Error:', error.message);
    if (error.error) {
      console.error('Error details:', JSON.stringify(error.error, null, 2));
    }
  }
}

testStreaming();
