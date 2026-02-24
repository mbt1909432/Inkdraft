/**
 * Acontext Sandbox Tools
 * Provides Python code execution and file export capabilities
 */

import type { AcontextClient } from '@acontext/acontext';
import { SANDBOX_TOOLS } from '@acontext/acontext';

const LOG_TAG = '[acontext/sandbox-tools]';

export interface SandboxContext {
  acontextClient: AcontextClient;
  sandboxId: string;
  diskId: string;
}

export interface BashExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime?: number;
}

export interface ExportFileResult {
  diskPath: string; // disk:: path
  publicUrl?: string;
}

/**
 * Create a new sandbox
 */
export async function createSandbox(
  acontextClient: AcontextClient
): Promise<{ sandboxId: string }> {
  console.log(LOG_TAG, 'Creating sandbox...');

  const result = await acontextClient.sandboxes.create();

  console.log(LOG_TAG, 'Sandbox created:', result.sandbox_id);

  return { sandboxId: result.sandbox_id };
}

/**
 * Kill a sandbox
 */
export async function killSandbox(
  acontextClient: AcontextClient,
  sandboxId: string
): Promise<void> {
  console.log(LOG_TAG, 'Killing sandbox:', sandboxId);

  await acontextClient.sandboxes.kill(sandboxId);

  console.log(LOG_TAG, 'Sandbox killed');
}

/**
 * Format sandbox context for tool execution
 */
export function formatSandboxContext(
  acontextClient: AcontextClient,
  sandboxId: string,
  diskId: string
): SandboxContext {
  return {
    acontextClient,
    sandboxId,
    diskId,
  };
}

/**
 * Parse tool result string to object
 * The executeTool returns a string, which may be JSON or plain text
 */
function parseToolResult(result: string): Record<string, unknown> {
  try {
    return JSON.parse(result);
  } catch {
    // If not JSON, return as plain content
    return { content: result };
  }
}

/**
 * Execute bash command in sandbox
 * @param timeout - Timeout in SECONDS (default: 120 seconds)
 */
export async function executeBashCommand(
  ctx: SandboxContext,
  command: string,
  timeout: number = 120
): Promise<BashExecutionResult> {
  console.log(LOG_TAG, 'Executing bash command:', command.slice(0, 100));

  const formattedCtx = await SANDBOX_TOOLS.formatContext(
    ctx.acontextClient,
    ctx.sandboxId,
    ctx.diskId
  );

  const resultStr = await SANDBOX_TOOLS.executeTool(
    formattedCtx,
    'bash_execution_sandbox',
    {
      command,
      timeout,
    }
  );

  const result = parseToolResult(resultStr);

  console.log(LOG_TAG, 'Bash result:', {
    stdoutLength: (result.stdout as string)?.length || 0,
    stderrLength: (result.stderr as string)?.length || 0,
    exitCode: result.exit_code,
  });

  return {
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
    exitCode: (result.exit_code as number) ?? 0,
    executionTime: result.execution_time as number | undefined,
  };
}

/**
 * Create or edit a file in sandbox
 */
export async function writeSandboxFile(
  ctx: SandboxContext,
  path: string,
  content: string
): Promise<{ success: boolean; path: string }> {
  console.log(LOG_TAG, 'Writing file:', path);

  const formattedCtx = await SANDBOX_TOOLS.formatContext(
    ctx.acontextClient,
    ctx.sandboxId,
    ctx.diskId
  );

  const resultStr = await SANDBOX_TOOLS.executeTool(
    formattedCtx,
    'text_editor_sandbox',
    {
      command: 'create',
      path,
      file_text: content,
    }
  );

  const result = parseToolResult(resultStr);

  console.log(LOG_TAG, 'File write result:', result);

  return {
    success: !result.error,
    path,
  };
}

/**
 * Read a file from sandbox
 */
export async function readSandboxFile(
  ctx: SandboxContext,
  path: string
): Promise<{ content: string; success: boolean }> {
  console.log(LOG_TAG, 'Reading file:', path);

  const formattedCtx = await SANDBOX_TOOLS.formatContext(
    ctx.acontextClient,
    ctx.sandboxId,
    ctx.diskId
  );

  const resultStr = await SANDBOX_TOOLS.executeTool(
    formattedCtx,
    'text_editor_sandbox',
    {
      command: 'view',
      path,
    }
  );

  const result = parseToolResult(resultStr);

  return {
    content: (result.content as string) || '',
    success: !result.error,
  };
}

/**
 * Export a file from sandbox to disk
 * Returns disk:: path for embedding in document
 */
export async function exportFileToDisk(
  ctx: SandboxContext,
  sandboxPath: string,
  diskPath: string
): Promise<ExportFileResult> {
  console.log(LOG_TAG, 'Exporting file:', sandboxPath, '→', diskPath);

  const formattedCtx = await SANDBOX_TOOLS.formatContext(
    ctx.acontextClient,
    ctx.sandboxId,
    ctx.diskId
  );

  const resultStr = await SANDBOX_TOOLS.executeTool(
    formattedCtx,
    'export_file_sandbox',
    {
      sandbox_path: sandboxPath,
      disk_path: diskPath,
    }
  );

  const result = parseToolResult(resultStr);

  console.log(LOG_TAG, 'Export result:', result);

  // Return disk:: path
  const diskFilePath = (result.disk_path as string) || diskPath;

  return {
    diskPath: `disk::${diskFilePath}`,
    publicUrl: result.public_url as string | undefined,
  };
}

/**
 * Get OpenAI tool schemas for sandbox tools
 */
export function getSandboxToolSchemas() {
  return SANDBOX_TOOLS.toOpenAIToolSchema();
}

/**
 * Check if a tool name is a sandbox tool
 */
export function isSandboxToolName(name: string): boolean {
  const sandboxToolNames = [
    'bash_execution_sandbox',
    'text_editor_sandbox',
    'export_file_sandbox',
  ];
  return sandboxToolNames.includes(name);
}

/**
 * Execute a sandbox tool by name
 */
export async function executeSandboxTool(
  ctx: SandboxContext,
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  console.log(LOG_TAG, 'Executing tool:', toolName, args);

  // IMPORTANT: Acontext SDK expects timeout in SECONDS, not milliseconds!
  // If AI passes a large number (> 1000), it's likely in milliseconds - convert to seconds
  // Default to 120 seconds for data analysis tasks
  if (toolName === 'bash_execution_sandbox') {
    const currentTimeout = args.timeout;
    if (typeof currentTimeout === 'number') {
      let newTimeout = currentTimeout;
      if (currentTimeout > 1000) {
        // Convert from milliseconds to seconds
        newTimeout = Math.ceil(currentTimeout / 1000);
        console.log(LOG_TAG, 'Converted timeout from ms to seconds:', newTimeout);
      }
      // If timeout is too short (< 10 seconds), increase to 120 seconds
      if (newTimeout < 10) {
        newTimeout = 120;
        console.log(LOG_TAG, 'Increased timeout to 120 seconds for data analysis');
      }
      args = { ...args, timeout: newTimeout };
    } else {
      // Default timeout: 120 seconds
      args = { ...args, timeout: 120 };
      console.log(LOG_TAG, 'Set default timeout to 120 seconds');
    }
  }

  console.log(LOG_TAG, 'Formatting context...');
  const formattedCtx = await SANDBOX_TOOLS.formatContext(
    ctx.acontextClient,
    ctx.sandboxId,
    ctx.diskId
  );
  console.log(LOG_TAG, 'Context formatted, executing tool...');

  const resultStr = await SANDBOX_TOOLS.executeTool(formattedCtx, toolName, args);
  console.log(LOG_TAG, 'Tool execution completed, parsing result...');

  const result = parseToolResult(resultStr);

  console.log(LOG_TAG, 'Tool result:', result);

  return result;
}
