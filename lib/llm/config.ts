/**
 * Load LLM config from environment (shared with typo correction / draft)
 */

import type { LLMConfig } from './types';

const LOG_TAG = '[llm/config]';

export function getLLMConfig(): LLMConfig {
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;

  if (!endpoint) {
    throw new Error('OPENAI_LLM_ENDPOINT is not set');
  }
  if (!apiKey) {
    throw new Error('OPENAI_LLM_API_KEY is not set');
  }

  // Parse maxTokens with validation (minimum 16)
  const maxTokensEnv = process.env.OPENAI_LLM_MAX_TOKENS;
  let maxTokens = 2048;
  if (maxTokensEnv) {
    const parsed = parseInt(maxTokensEnv, 10);
    console.log(LOG_TAG, 'Parsing maxTokens:', { maxTokensEnv, parsed, isNaN: isNaN(parsed) });
    if (!isNaN(parsed) && parsed >= 16) {
      maxTokens = parsed;
    } else {
      console.warn(LOG_TAG, 'Invalid maxTokens value, using default 2048:', { maxTokensEnv, parsed });
    }
  }

  console.log(LOG_TAG, 'LLM config loaded:', {
    endpoint,
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini',
    maxTokens,
    hasApiKey: !!apiKey,
  });

  return {
    endpoint,
    apiKey,
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini',
    temperature: process.env.OPENAI_LLM_TEMPERATURE
      ? parseFloat(process.env.OPENAI_LLM_TEMPERATURE)
      : 0.7,
    maxTokens,
  };
}
