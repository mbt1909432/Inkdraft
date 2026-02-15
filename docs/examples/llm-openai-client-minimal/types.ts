/**
 * Minimal types for LLM chat + streaming (migration example)
 * Copy this file to your project and adjust paths/aliases as needed.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolInvocation {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  invokedAt: Date;
}
