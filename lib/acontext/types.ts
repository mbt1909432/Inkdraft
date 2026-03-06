/**
 * Core types for Acontext integration
 */

export interface AcontextConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  acontextSessionId: string;
  acontextDiskId: string;
  documentId?: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Content part for multimodal messages
 */
export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export interface AcontextMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  created_at?: string | Date;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface TokenCounts {
  total_tokens: number;
}

export interface CreateSessionOptions {
  userId: string;
  documentId?: string;
  title?: string;
}

export interface GetMessagesOptions {
  limit?: number;
  format?: string;
}
