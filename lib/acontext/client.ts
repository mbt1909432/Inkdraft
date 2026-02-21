/**
 * Acontext client wrapper for server-side usage
 */

import { AcontextClient } from '@acontext/acontext';
import type { AcontextConfig, AcontextMessage, GetMessagesOptions } from './types';

const LOG_TAG = '[acontext/client]';

/**
 * Get Acontext configuration from environment
 */
export function getAcontextConfig(): AcontextConfig | null {
  const apiKey = process.env.ACONTEXT_API_KEY;
  if (!apiKey) {
    console.log(LOG_TAG, 'ACONTEXT_API_KEY not set, Acontext features disabled');
    return null;
  }

  return {
    apiKey,
    baseUrl: process.env.ACONTEXT_BASE_URL,
  };
}

/**
 * Create Acontext client instance
 */
export function createAcontextClient(config: AcontextConfig): AcontextClient {
  return new AcontextClient({
    apiKey: config.apiKey,
    // baseUrl is optional - only needed for self-hosted
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  });
}

/**
 * Create a new session with associated disk (1:1 binding)
 */
export async function createSessionWithDisk(
  client: AcontextClient,
  options: { user?: string }
): Promise<{ sessionId: string; diskId: string }> {
  console.log(LOG_TAG, 'Creating new session with disk');

  const session = await client.sessions.create({
    user: options.user,
  });

  const disk = await client.disks.create();

  console.log(LOG_TAG, 'Created session and disk', {
    sessionId: session.id,
    diskId: disk.id,
  });

  return {
    sessionId: session.id,
    diskId: disk.id,
  };
}

/**
 * Store a message in the session
 */
export async function storeMessage(
  client: AcontextClient,
  sessionId: string,
  message: AcontextMessage
): Promise<void> {
  // Cast to unknown first, then to Record<string, unknown> to satisfy Acontext SDK typing
  await client.sessions.storeMessage(sessionId, message as unknown as Record<string, unknown>);
}

/**
 * Get messages from session with optional formatting
 */
export async function getMessages(
  client: AcontextClient,
  sessionId: string,
  options?: { limit?: number }
): Promise<AcontextMessage[]> {
  const result = await client.sessions.getMessages(sessionId, {
    format: 'openai',  // Use OpenAI format for compatibility
    limit: options?.limit,
  });

  // Filter out tool messages for display (they're used internally)
  const items = (result?.items || []) as AcontextMessage[];
  return items.filter((m) => m.role !== 'tool');
}

/**
 * Get token counts for a session
 */
export async function getTokenCounts(
  client: AcontextClient,
  sessionId: string
): Promise<number> {
  try {
    const result = await client.sessions.getTokenCounts(sessionId);
    return result?.total_tokens || 0;
  } catch (error) {
    console.error(LOG_TAG, 'Failed to get token counts', error);
    return 0;
  }
}

/**
 * Delete a session and its associated disk
 */
export async function deleteSessionAndDisk(
  client: AcontextClient,
  sessionId: string,
  diskId: string
): Promise<void> {
  console.log(LOG_TAG, 'Deleting session and disk', { sessionId, diskId });

  await client.sessions.delete(sessionId);
  // Note: Disk deletion might need a separate API call if available
  // await client.disks.delete(diskId);
}

/**
 * Test Acontext connection
 */
export async function testConnection(client: AcontextClient): Promise<boolean> {
  try {
    await client.ping();
    console.log(LOG_TAG, 'Acontext connection successful');
    return true;
  } catch (error) {
    console.error(LOG_TAG, 'Acontext connection failed', error);
    return false;
  }
}
