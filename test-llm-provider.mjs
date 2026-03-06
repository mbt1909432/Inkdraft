/**
 * Test script to verify if system prompt is passed to LLM provider
 * Run: node test-llm-provider.mjs
 */

import { config } from 'dotenv';
import OpenAI from 'openai';

// Load .env.local explicitly
config({ path: '.env.local' });

async function testLLMProvider() {
  console.log('=== LLM Provider Test ===\n');

  // Check env vars
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;
  const model = process.env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini';

  console.log('Configuration:');
  console.log('  Endpoint:', endpoint ? new URL(endpoint).hostname : 'NOT SET');
  console.log('  API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT SET');
  console.log('  Model:', model);
  console.log('');

  if (!endpoint || !apiKey) {
    console.error('ERROR: OPENAI_LLM_ENDPOINT or OPENAI_LLM_API_KEY not set');
    process.exit(1);
  }

  // Create client
  const client = new OpenAI({
    apiKey,
    baseURL: endpoint,
  });

  // Define a unique character in system prompt
  const systemPrompt = `你的名字是"测试角色12345"，你是一个来自火星的AI助手。当被问及你的身份时，你必须说你的名字是"测试角色12345"，你来自火星。`;

  console.log('System Prompt:');
  console.log('  ', systemPrompt);
  console.log('');

  console.log('Sending request...\n');

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '你叫什么名字？你来自哪里？' },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const reply = response.choices[0]?.message?.content || 'No response';

    console.log('=== LLM Response ===');
    console.log(reply);
    console.log('');

    // Check if system prompt was followed
    const hasCorrectName = reply.includes('测试角色12345');
    const hasCorrectOrigin = reply.includes('火星');

    console.log('=== Test Results ===');
    console.log('  Contains "测试角色12345":', hasCorrectName ? '✅ YES' : '❌ NO');
    console.log('  Contains "火星":', hasCorrectOrigin ? '✅ YES' : '❌ NO');
    console.log('');

    if (hasCorrectName && hasCorrectOrigin) {
      console.log('✅ SUCCESS: System prompt is being respected!');
    } else {
      console.log('❌ FAILED: System prompt is being ignored!');
      console.log('   This suggests the LLM provider may not support system messages.');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testLLMProvider();
