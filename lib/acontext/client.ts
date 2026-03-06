/**
 * Acontext client wrapper for server-side usage
 */

import { AcontextClient, FileUpload } from '@acontext/acontext';
import type { AcontextConfig, AcontextMessage, ContentPart } from './types';

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
 * Supports both text-only and multimodal messages
 *
 * FIXME: Acontext Multimodal Storage Bug (2026-03-03)
 * =====================================================
 * The Acontext API does NOT preserve image_url content parts when storing
 * messages, regardless of format (OpenAI base64, OpenAI URL, or native format).
 * Tested with @acontext/acontext SDK - image parts are silently dropped.
 *
 * Workaround: For multimodal messages, we strip out image parts and only store
 * text content. The actual multimodal content is passed directly to the LLM
 * in route.ts, bypassing Acontext history for the current message.
 *
 * Impact:
 * - Chat works: AI can see and describe images correctly
 * - Context works: AI remembers image content within a session
 * - Limitation: Historical image data is not persisted in Acontext storage
 *
 * TODO: Re-enable multimodal storage once Acontext fixes this bug.
 * Ref: https://docs.acontext.io/store/messages/multi-modal (claims support but broken)
 */
export async function storeMessage(
  client: AcontextClient,
  sessionId: string,
  message: AcontextMessage
): Promise<void> {
  // Check if this is a multimodal message with images
  const isMultimodal = Array.isArray(message.content);
  const imageParts = isMultimodal
    ? (message.content as ContentPart[]).filter(p => p.type === 'image_url')
    : [];

  // Log what we're storing
  console.log(LOG_TAG, 'Storing message', {
    role: message.role,
    isMultimodal,
    partsCount: isMultimodal ? (message.content as ContentPart[]).length : 0,
    hasImage: imageParts.length > 0,
  });

  // Build message blob
  let contentToStore: string | ContentPart[] = message.content;

  // WORKAROUND: Strip image parts from multimodal messages before storing
  // (Acontext API drops them anyway, but we're explicit about it)
  if (isMultimodal && imageParts.length > 0) {
    const textParts = (message.content as ContentPart[])
      .filter(p => p.type === 'text')
      .map(p => p.text || '')
      .join('\n');
    contentToStore = textParts || '[image]';  // Store text only, fallback if no text
    console.log(LOG_TAG, 'Stripped image parts, storing text only:', {
      originalParts: (message.content as ContentPart[]).length,
      storedText: contentToStore.substring(0, 100),
    });
  }

  const messageBlob: Record<string, unknown> = {
    role: message.role,
    content: contentToStore,
  };

  // Include tool_calls for assistant messages
  if (message.role === 'assistant' && message.tool_calls) {
    messageBlob.tool_calls = message.tool_calls;
  }

  // Include tool_call_id for tool response messages
  if (message.role === 'tool' && message.tool_call_id) {
    messageBlob.tool_call_id = message.tool_call_id;
  }

  // Store with OpenAI format
  await client.sessions.storeMessage(sessionId, messageBlob, {
    format: 'openai',
  });

  console.log(LOG_TAG, 'Message stored successfully');
}

/**
 * Get messages from session with optional formatting
 * Returns ALL messages including tool responses (needed to show execution results)
 */
export async function getMessages(
  client: AcontextClient,
  sessionId: string,
  options?: { limit?: number }
): Promise<AcontextMessage[]> {
  const result = await client.sessions.getMessages(sessionId, {
    format: 'openai',
    limit: options?.limit,
    withAssetPublicUrl: true,  // Get presigned URLs for assets
  });

  if (!result?.items) {
    console.log(LOG_TAG, 'getMessages: No items returned');
    return [];
  }

  // Log loaded messages for debugging
  const messages = result.items as AcontextMessage[];
  console.log(LOG_TAG, 'getMessages loaded', {
    count: messages.length,
    firstMsgIsMultimodal: messages.length > 0 && Array.isArray(messages[0].content),
    firstMsgPreview: messages.length > 0
      ? (Array.isArray(messages[0].content)
          ? JSON.stringify(messages[0].content).substring(0, 200)
          : String(messages[0].content).substring(0, 100))
      : 'no messages',
    multimodalCount: messages.filter(m => Array.isArray(m.content)).length,
    publicUrls: result.public_urls ? Object.keys(result.public_urls).length : 0,
  });

  return messages;
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

/**
 * Upload an image to Acontext disk and get public URL
 */
export async function uploadImage(
  client: AcontextClient,
  diskId: string,
  options: {
    filename: string;
    content: Buffer;
    mimeType: string;
    path?: string;
  }
): Promise<{ publicUrl: string; filePath: string }> {
  const filePath = options.path || '/chat-images/';
  const fullFilePath = `${filePath}${options.filename}`;

  console.log(LOG_TAG, 'Uploading image to disk', {
    diskId,
    filePath: fullFilePath,
    mimeType: options.mimeType,
    contentSize: options.content.length,
  });

  // Upload the file (FileUpload accepts Buffer directly)
  await client.disks.artifacts.upsert(diskId, {
    file: new FileUpload({
      filename: options.filename,
      content: options.content,
      contentType: options.mimeType,
    }),
    filePath: filePath,
  });

  // Get public URL
  const result = await client.disks.artifacts.get(diskId, {
    filePath: filePath,
    filename: options.filename,
    withPublicUrl: true,
  });

  if (!result?.public_url) {
    throw new Error('Failed to get public URL for uploaded image');
  }

  console.log(LOG_TAG, 'Image uploaded successfully', {
    publicUrl: result.public_url,
  });

  return {
    publicUrl: result.public_url,
    filePath: fullFilePath,
  };
}

/**
 * Get public URL for an existing image on disk
 */
export async function getImageUrl(
  client: AcontextClient,
  diskId: string,
  filePath: string,
  filename: string
): Promise<string | null> {
  try {
    const result = await client.disks.artifacts.get(diskId, {
      filePath: filePath,
      filename,
      withPublicUrl: true,
    });
    return result?.public_url || null;
  } catch (error) {
    console.error(LOG_TAG, 'Failed to get image URL', error);
    return null;
  }
}
