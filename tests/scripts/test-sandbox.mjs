import { getAcontextConfig, createAcontextClient } from './lib/acontext';
import { createSandbox, executeBashCommand } from './lib/acontext/sandbox-tools';

async function testSandbox() {
  console.log('Starting sandbox test...');
  
  const config = getAcontextConfig();
  if (!config) {
    console.error('Acontext not configured');
    return;
  }
  
  const client = createAcontextClient(config);
  
  // Create sandbox
  console.log('Creating sandbox...');
  const { sandboxId } = await createSandbox(client);
  console.log('Sandbox created:', sandboxId);
  
  // Test simple command
  const ctx = {
    acontextClient: client,
    sandboxId,
    diskId: 'test-disk',
  };
  
  console.log('Executing simple echo command...');
  const result = await executeBashCommand(ctx, 'echo "Hello from sandbox!"');
  console.log('Echo result:', result);
  
  // Test python version
  console.log('Executing python --version...');
  const pyResult = await executeBashCommand(ctx, 'python3 --version');
  console.log('Python version result:', pyResult);
  
  console.log('Test complete!');
}

testSandbox().catch(console.error);
