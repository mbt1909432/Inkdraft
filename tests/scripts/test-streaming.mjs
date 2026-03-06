/**
 * Test script for streaming chat endpoint
 * Usage: node test-streaming.mjs
 */

const API_URL = 'http://localhost:3000/api/ai/chat-acontext';

async function testStreaming() {
  console.log('Starting streaming test...\n');
  console.log('Time:', new Date().toISOString());
  console.log('---');

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You need a valid session cookie for authentication
        // For testing, you can get this from your browser's dev tools
        'Cookie': process.env.AUTH_COOKIE || '',
      },
      body: JSON.stringify({
        content: 'Say "Hello World" and count from 1 to 5 slowly.',
        documentId: 'test-doc-' + Date.now(),
        documentMarkdown: '# Test Document\n\nThis is a test.',
        selectionMarkdown: null,
      }),
    });

    if (!response.ok) {
      console.error('Request failed:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    let contentChunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkCount++;
      const elapsed = Date.now() - startTime;
      const data = decoder.decode(value, { stream: true });

      console.log(`[${elapsed}ms] Chunk #${chunkCount} (${value.length} bytes):`);

      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(line.slice(6));

          if (json.type === 'content') {
            contentChunks++;
            console.log(`  📝 CONTENT: "${json.content}"`);
          } else if (json.type === 'session') {
            console.log(`  🔗 SESSION: ${json.chatSessionId?.slice(0, 8)}...`);
          } else if (json.type === 'agent_loop_start') {
            console.log(`  🔄 AGENT LOOP START (max: ${json.maxIterations})`);
          } else if (json.type === 'agent_loop_iteration') {
            console.log(`  🔄 ITERATION: ${json.iteration}/${json.maxIterations}`);
          } else if (json.type === 'agent_loop_tool') {
            console.log(`  🔧 TOOL: ${json.toolName} - ${json.status}`);
          } else if (json.type === 'agent_loop_end') {
            console.log(`  🔄 AGENT LOOP END`);
          } else if (json.type === 'done') {
            console.log(`  ✅ DONE (content length: ${json.content?.length})`);
          } else if (json.type === 'error') {
            console.log(`  ❌ ERROR: ${json.error}`);
          } else {
            console.log(`  ❓ UNKNOWN: ${JSON.stringify(json).slice(0, 100)}`);
          }
        } catch (e) {
          console.log(`  Parse error: ${line.slice(0, 100)}`);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    console.log('\n---');
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Total chunks: ${chunkCount}`);
    console.log(`Content chunks: ${contentChunks}`);

    if (contentChunks > 1) {
      console.log('\n✅ STREAMING IS WORKING! Multiple content chunks received over time.');
    } else if (contentChunks === 1) {
      console.log('\n⚠️ PARTIAL: Only one content chunk received (might be buffered).');
    } else {
      console.log('\n❌ STREAMING NOT WORKING: No content chunks received.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testStreaming();
