/**
 * Test script to verify LLM API connectivity
 * Run: node test-llm.mjs
 */

import 'dotenv/config';
import OpenAI from 'openai';

const LOG_TAG = '[LLM Test]';

async function testLLM() {
  console.log(LOG_TAG, 'Starting LLM connectivity test...\n');

  // Check environment variables
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;
  const model = process.env.OPENAI_LLM_MODEL;
  const maxTokensEnv = process.env.OPENAI_LLM_MAX_TOKENS;

  console.log(LOG_TAG, 'Environment variables:');
  console.log('  - OPENAI_LLM_ENDPOINT:', endpoint ? '✅ Set' : '❌ Not set');
  console.log('  - OPENAI_LLM_API_KEY:', apiKey ? `✅ Set (${apiKey.slice(0, 10)}...)` : '❌ Not set');
  console.log('  - OPENAI_LLM_MODEL:', model || 'gpt-4o-mini (default)');
  console.log('  - OPENAI_LLM_MAX_TOKENS:', maxTokensEnv || '2048 (default)');
  console.log();

  if (!endpoint || !apiKey) {
    console.error(LOG_TAG, '❌ Missing required environment variables');
    process.exit(1);
  }

  // Parse maxTokens with validation
  let maxTokens = 2048;
  if (maxTokensEnv) {
    const parsed = parseInt(maxTokensEnv, 10);
    if (!isNaN(parsed) && parsed >= 16) {
      maxTokens = parsed;
    } else {
      console.warn(LOG_TAG, `⚠️ Invalid maxTokens value: ${maxTokensEnv}, using default 2048`);
    }
  }

  console.log(LOG_TAG, `Using max_tokens: ${maxTokens}`);
  console.log();

  // Create OpenAI client
  const client = new OpenAI({
    apiKey,
    baseURL: endpoint,
  });

  console.log(LOG_TAG, 'Sending test request to LLM...');
  console.log(LOG_TAG, `Model: ${model || 'gpt-4o-mini'}`);
  console.log(LOG_TAG, `Endpoint: ${endpoint}`);
  console.log();

  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond briefly.' },
        { role: 'user', content: 'Say "Hello, LLM is working!" in Chinese.' },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: false,
    });

    const duration = Date.now() - startTime;

    console.log(LOG_TAG, '✅ LLM Response received!');
    console.log(LOG_TAG, `Duration: ${duration}ms`);
    console.log(LOG_TAG, `Usage:`);
    console.log(`  - Prompt tokens: ${response.usage?.prompt_tokens || 'N/A'}`);
    console.log(`  - Completion tokens: ${response.usage?.completion_tokens || 'N/A'}`);
    console.log(`  - Total tokens: ${response.usage?.total_tokens || 'N/A'}`);
    console.log();
    console.log(LOG_TAG, 'Response content:');
    console.log('---');
    console.log(response.choices[0]?.message?.content || 'No content');
    console.log('---');
    console.log();
    console.log(LOG_TAG, '✅ LLM connectivity test PASSED!');

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(LOG_TAG, `❌ LLM request failed after ${duration}ms`);
    console.error();

    if (error instanceof Error) {
      console.error(LOG_TAG, 'Error type:', error.constructor.name);
      console.error(LOG_TAG, 'Error message:', error.message);

      // Try to extract more details
      if ('status' in error) {
        console.error(LOG_TAG, 'HTTP Status:', error.status);
      }
      if ('error' in error && typeof error.error === 'object') {
        console.error(LOG_TAG, 'Error details:', JSON.stringify(error.error, null, 2));
      }
    } else {
      console.error(LOG_TAG, 'Unknown error:', error);
    }

    console.log();
    console.log(LOG_TAG, '❌ LLM connectivity test FAILED!');
    process.exit(1);
  }
}

testLLM();
