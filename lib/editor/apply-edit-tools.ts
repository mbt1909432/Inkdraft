/**
 * Apply edit tools (search_replace, insert_after) to markdown string.
 * Used by ChatPanel when the model returns tool_calls.
 */

export interface ApplySearchReplaceResult {
  newMarkdown: string;
  applied: boolean;
  error?: string;
}

export function applySearchReplace(
  markdown: string,
  old_string: string,
  new_string: string
): ApplySearchReplaceResult {
  if (typeof old_string !== 'string' || typeof new_string !== 'string') {
    return { newMarkdown: markdown, applied: false, error: 'Invalid arguments' };
  }

  const index = markdown.indexOf(old_string);
  if (index === -1) {
    return {
      newMarkdown: markdown,
      applied: false,
      error: 'old_string not found in document',
    };
  }
  const newMarkdown =
    markdown.slice(0, index) + new_string + markdown.slice(index + old_string.length);
  return { newMarkdown, applied: true };
}

export interface ApplyInsertAfterResult {
  newMarkdown: string;
  applied: boolean;
  error?: string;
}

export function applyInsertAfter(
  markdown: string,
  after_string: string,
  content: string
): ApplyInsertAfterResult {
  if (typeof after_string !== 'string' || typeof content !== 'string') {
    return { newMarkdown: markdown, applied: false, error: 'Invalid arguments' };
  }

  const index = markdown.indexOf(after_string);
  if (index === -1) {
    return {
      newMarkdown: markdown,
      applied: false,
      error: 'after_string not found in document',
    };
  }
  const insertIndex = index + after_string.length;
  const newMarkdown =
    markdown.slice(0, insertIndex) + content + markdown.slice(insertIndex);
  return { newMarkdown, applied: true };
}

export interface ApplyEditToolResult {
  newMarkdown: string;
  applied: boolean;
  error?: string;
}

/**
 * Apply a single tool call (search_replace or insert_after) to the current markdown.
 * Returns the new markdown and whether it was applied.
 */
export function applyEditTool(
  markdown: string,
  toolName: string,
  args: Record<string, unknown>
): ApplyEditToolResult {
  if (toolName === 'search_replace') {
    return applySearchReplace(
      markdown,
      String(args.old_string ?? ''),
      String(args.new_string ?? '')
    );
  }
  if (toolName === 'insert_after') {
    return applyInsertAfter(
      markdown,
      String(args.after_string ?? ''),
      String(args.content ?? '')
    );
  }
  return {
    newMarkdown: markdown,
    applied: false,
    error: `Unknown tool: ${toolName}`,
  };
}
