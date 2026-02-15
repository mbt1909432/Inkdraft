/**
 * Load LLM config from environment (shared with typo correction / draft)
 */

import type { LLMConfig } from './types';

export function getLLMConfig(): LLMConfig {
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;

  if (!endpoint) {
    throw new Error('OPENAI_LLM_ENDPOINT is not set');
  }
  if (!apiKey) {
    throw new Error('OPENAI_LLM_API_KEY is not set');
  }

  return {
    endpoint,
    apiKey,
    model: process.env.OPENAI_LLM_MODEL ?? 'gpt-4o-mini',
    temperature: process.env.OPENAI_LLM_TEMPERATURE
      ? parseFloat(process.env.OPENAI_LLM_TEMPERATURE)
      : 0.7,
    maxTokens: process.env.OPENAI_LLM_MAX_TOKENS
      ? parseInt(process.env.OPENAI_LLM_MAX_TOKENS, 10)
      : 2048,
  };
}
