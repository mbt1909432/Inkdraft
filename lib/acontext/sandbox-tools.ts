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
 * @param timeout - Timeout in SECONDS (default: 120)
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
  sandboxFilename: string,
  diskPath: string
): Promise<ExportFileResult> {
  console.log(LOG_TAG, 'Exporting file:', sandboxPath, sandboxFilename, '→', diskPath);

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
      sandbox_filename: sandboxFilename,
      disk_path: diskPath,
    }
  );

  const result = parseToolResult(resultStr);

  console.log(LOG_TAG, 'Export result:', result);

  // Return disk:: path
  const diskFilePath = (result.disk_path as string) || `${diskPath}${sandboxFilename}`;

  return {
    diskPath: `disk::${diskFilePath}`,
    publicUrl: result.public_url as string | undefined,
  };
}

/**
 * Get OpenAI tool schemas for sandbox tools with custom descriptions
 * This overrides the SDK's default descriptions to add critical rules about heredoc
 */
export function getSandboxToolSchemas() {
  const schemas = SANDBOX_TOOLS.toOpenAIToolSchema() as Array<{
    type: string;
    function?: {
      name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;

  // Override bash_execution_sandbox description to forbid heredoc
  const bashSchema = schemas.find((s) => s.function?.name === 'bash_execution_sandbox');
  if (bashSchema && bashSchema.function) {
    bashSchema.function.description = `Execute bash commands in an isolated sandbox environment.

**FORBIDDEN COMMANDS (will cause execution to hang):**
- NEVER use heredoc syntax: python3 - << 'EOF', cat << 'EOF', etc.
- NEVER pass multi-line code via command parameter

**HOW TO RUN PYTHON CODE:**
1. First, use text_editor_sandbox to create a .py file:
   { command: "create", path: "script.py", file_text: "print('hello')" }
2. Then, run the file: python3 script.py

**Valid command examples:**
- ls -la
- python3 script.py
- pip install numpy
- mkdir output`;
  }

  // Enhance text_editor_sandbox description
  const textEditorSchema = schemas.find((s) => s.function?.name === 'text_editor_sandbox');
  if (textEditorSchema && textEditorSchema.function) {
    textEditorSchema.function.description = `Create, view, or edit files in the sandbox.

**Use this tool to create Python scripts before running them:**
1. Create a .py file with your code using command="create"
2. Then use bash_execution_sandbox to run "python3 script.py"

Commands:
- "create": Write a new file (path, file_text required)
- "view": Read file contents (path required)`;
  }

  return schemas;
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

  // RUNTIME GUARD: Block heredoc syntax (sandbox doesn't support multi-line input)
  if (toolName === 'bash_execution_sandbox' && typeof args.command === 'string') {
    const command = args.command;
    // Detect heredoc patterns: << 'EOF', << "EOF", <<EOF, << 'PY', etc.
    const heredocPattern = /<<\s*['"]?\w+['"]?/;

    if (heredocPattern.test(command)) {
      console.warn(LOG_TAG, 'BLOCKED: Heredoc syntax detected:', command.slice(0, 100));
      return {
        error: 'HEREDOC_NOT_SUPPORTED',
        message: 'The sandbox does NOT support heredoc syntax (<< \'EOF\', << "PY", etc.). It will hang indefinitely.',
        correct_pattern: {
          step1: { tool: 'text_editor_sandbox', args: { command: 'create', path: 'script.py', file_text: '<your python code>' } },
          step2: { tool: 'bash_execution_sandbox', args: { command: 'python3 script.py' } },
        },
        hint: 'First create a .py file with text_editor_sandbox, then run python3 script.py',
      };
    }
  }

  // SDK v0.1.10+ handles timeout conversion internally (seconds → milliseconds)
  // Default to 120 seconds for data analysis tasks
  if (toolName === 'bash_execution_sandbox' && typeof args.timeout !== 'number') {
    args = { ...args, timeout: 120 }; // 120 seconds
    console.log(LOG_TAG, 'Set default timeout to 120 seconds');
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

  // Special handling for export_file_sandbox: emphasize disk:: path for LLM
  if (toolName === 'export_file_sandbox' && !result.error) {
    // SDK may not return disk_path, so we build a default path
    // AI might use sandbox_filename or filename as parameter name
    const filename = (args.sandbox_filename || args.filename) as string | undefined;

    // Use returned disk_path, or fallback to artifacts/{filename}
    const diskPath = (result.disk_path as string) || (filename ? `artifacts/${filename}` : '');
    const publicUrl = result.public_url as string | undefined;

    console.log(LOG_TAG, 'Export file result', { diskPath, filename, hasPublicUrl: !!publicUrl });

    // Return formatted result with disk:: path prominently displayed
    // Move publicUrl to _meta to prevent LLM from using it directly (it expires!)
    return {
      success: true,
      diskPath: `disk::${diskPath}`,
      // Clear message telling LLM exactly what to use
      message: `File exported successfully. Use this path in markdown: disk::${diskPath}`,
      // IMPORTANT: The disk:: path will be converted to a fresh URL when the document is rendered.
      // Do NOT use any URL directly as it will expire.
      // Hidden metadata for frontend use (not for LLM to copy)
      _meta: {
        originalDiskPath: diskPath,
        publicUrl: publicUrl, // Expires in ~1 hour, only for immediate preview
      },
    };
  }

  console.log(LOG_TAG, 'Tool result:', result);

  return result;
}
