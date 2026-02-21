/**
 * Test endpoint for Acontext connection
 * GET /api/ai/test-acontext
 */

import { NextResponse } from 'next/server';
import { AcontextClient } from '@acontext/acontext';
import { getAcontextConfig } from '@/lib/acontext/client';

export async function GET() {
  const config = getAcontextConfig();

  if (!config) {
    return NextResponse.json({
      success: false,
      error: 'ACONTEXT_API_KEY not configured',
    });
  }

  const client = new AcontextClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  try {
    // Test 1: Ping
    console.log('[test-acontext] Testing ping...');
    const pingResult = await client.ping();
    console.log('[test-acontext] Ping result:', pingResult);

    // Test 2: Create session
    console.log('[test-acontext] Creating session...');
    const session = await client.sessions.create({
      user: 'test@example.com',
    });
    console.log('[test-acontext] Session created:', session);

    // Test 3: Store message
    console.log('[test-acontext] Storing message...');
    const message = await client.sessions.storeMessage(
      session.id,
      {
        role: 'user',
        content: 'Hello, this is a test message!',
      },
      { format: 'openai' }
    );
    console.log('[test-acontext] Message stored:', message);

    // Test 4: Get messages
    console.log('[test-acontext] Getting messages...');
    const messages = await client.sessions.getMessages(session.id, {
      format: 'openai',
      limit: 10,
    });
    console.log('[test-acontext] Messages:', messages);

    // Test 5: Create disk
    console.log('[test-acontext] Creating disk...');
    const disk = await client.disks.create();
    console.log('[test-acontext] Disk created:', disk);

    return NextResponse.json({
      success: true,
      tests: {
        ping: pingResult,
        session: {
          id: session.id,
          userId: session.user_id,
          createdAt: session.created_at,
        },
        message: {
          id: message.id,
          role: message.role,
        },
        messagesCount: messages.items?.length || 0,
        disk: {
          id: disk.id,
        },
      },
    });
  } catch (error) {
    console.error('[test-acontext] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
