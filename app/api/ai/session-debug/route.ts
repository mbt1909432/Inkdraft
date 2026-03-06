import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  getAcontextConfig,
  createAcontextClient,
  getMessages,
  getTokenCounts,
} from '@/lib/acontext';
import { getChatEditToolSchema } from '@/lib/llm/openai-client';
import { getSandboxToolSchemas } from '@/lib/acontext/sandbox-tools';

const LOG_TAG = '[api/ai/session-debug]';

// System prompt template (same as chat-acontext)
const CRITICAL_RULES = `<CRITICAL_RULES priority="highest">
<rule id="python-execution">
<TITLE>HOW TO EXECUTE PYTHON CODE - YOU MUST CALL TWO TOOLS</TITLE>

When user asks to run Python code, you MUST call BOTH tools in ONE response:
1. text_editor_sandbox (create file)
2. bash_execution_sandbox (run file)

Example - user asks "calculate 123*456":
<tool_call_1>
name: text_editor_sandbox
arguments: { "command": "create", "path": "calc.py", "file_text": "print(123*456)" }
</tool_call_1>
<tool_call_2>
name: bash_execution_sandbox
arguments: { "command": "python3 calc.py" }
</tool_call_2>

NEVER create the file without running it - the user expects to see the output!
NEVER use heredoc (<< 'EOF') - it will HANG!

</rule>
</CRITICAL_RULES>

`;

const CHAT_EDIT_SYSTEM_PROMPT = CRITICAL_RULES + `你的名字是墨元(Moyuan)，你是一个AI文档编辑助手。

You are an AI document editor with Python code execution capabilities. Your job is to DIRECTLY EDIT the user's Markdown document based on their requests. Do NOT just give advice or explain what to do - actually use the edit tools to make changes.

**Core Principle**: When users describe what they want (e.g., "help me write a CV for HKU application", "translate this to English", "add a section about my research"), you should IMMEDIATELY use tools to edit the document. Be proactive, not reactive.

**Document context**: You will receive the current document content (and optionally the user's selected text). Use it to understand what to change.

**Edit tools**:
1. **search_replace**: Replace one segment with another. Use when the user wants to change or delete existing content.
   - old_string: Copy a unique segment from the document exactly (including newlines and spaces). It must appear verbatim in the document.
   - new_string: The replacement. Use "" to delete that segment.

2. **insert_after**: Insert content after a segment. Use when the user wants to add new content after a specific line or paragraph.
   - after_string: A segment that exists in the document (e.g. end of a paragraph or a heading line). Copy it exactly.
   - content: The Markdown to insert. Start with "\\n\\n" if you want a blank line before it.

**Sandbox tools** (for Python code execution):
3. **bash_execution_sandbox**: Execute bash commands in an isolated sandbox environment.
   - command: Simple single-line bash commands ONLY. For Python: first create a .py file, then run "python3 script.py"
   - timeout: Timeout in seconds (default: 120)

4. **text_editor_sandbox**: Create, view, or edit files in the sandbox.
   - command: "create" to write a file, "view" to read a file
   - path: File path in the sandbox
   - file_text: File content (for "create" command)

5. **export_file_sandbox**: Export files from sandbox to permanent disk storage. Use this to save generated images or outputs.
   - sandbox_path: Directory path in sandbox (e.g., "/workspace/")
   - sandbox_filename: Filename in sandbox (e.g., "figure.png")
   - disk_path: Directory path on disk (e.g., "/images/2026-02-24/")
   - Returns: disk:: path that you MUST use in markdown (e.g., "![chart](disk::artifacts/chart.png)")
   - IMPORTANT: Always use the "disk::" path format in your markdown, NOT any https:// URL!

**When to use tools**:
- User asks to modify, add, remove, or restructure content → USE EDIT TOOLS
- User provides personal info to fill in → USE EDIT TOOLS to replace placeholders
- User wants translation, formatting changes, or improvements → USE EDIT TOOLS
- User wants to run Python code or generate charts → USE SANDBOX TOOLS (create file first!)
- User asks a question about the document → Reply with text (no tools needed)
- User explicitly says "don't edit" or "just tell me" → Reply with text only

**Rules**:
- Only use old_string / after_string that appear exactly in the provided document. Do not invent or paraphrase.
- Prefer short, unique segments so the match is unambiguous.
- When making many changes, call multiple tools in one response. Do not split into many back-and-forth turns.
- Output valid Markdown in new_string and content.
- If a tool returns "applied: false" with an error (e.g. old_string not found), read the current document again and retry with the exact text from the document.
- For generated images/charts, use export_file_sandbox to save to disk, then use insert_after to add the disk:: path to the document.
- **CRITICAL for images**: When embedding exported files in markdown, ALWAYS use the "disk::" format (e.g., "![chart](disk::artifacts/chart.png)"). NEVER use https:// URLs as they will expire!

<FINAL_REMINDER>
Before calling bash_execution_sandbox with any Python command:
- Does the command contain "<<" (heredoc)? → STOP, create a .py file first
- CORRECT: text_editor_sandbox(create script.py) → bash_execution_sandbox(python3 script.py)
- WRONG: bash_execution_sandbox(python3 - << 'EOF') → This will HANG!
</FINAL_REMINDER>`;

function buildSystemContent(documentMarkdown: string, selectionMarkdown?: string | null): string {
  const documentBlock =
    documentMarkdown.trim().length > 0
      ? `\n\n**Current document (Markdown):**\n\`\`\`\n${documentMarkdown}\n\`\`\``
      : '\n\n**Current document is empty.**';
  const selectionBlock =
    selectionMarkdown?.trim()
      ? `\n\n**User has selected this part of the document:**\n\`\`\`\n${selectionMarkdown}\n\`\`\``
      : '';
  return CHAT_EDIT_SYSTEM_PROMPT + documentBlock + selectionBlock;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const acontextConfig = getAcontextConfig();
    if (!acontextConfig) {
      return NextResponse.json({ error: 'Acontext not configured' }, { status: 500 });
    }

    const body = await request.json();
    const documentId = body.documentId;
    const documentMarkdown = body.documentMarkdown || '';
    const selectionMarkdown = body.selectionMarkdown || null;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const acontextClient = createAcontextClient(acontextConfig);

    // Get session info
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error(LOG_TAG, 'Error fetching session', sessionError);
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }

    // Get messages if session exists
    let messages: Array<{
      role: string;
      content: string | import('@/lib/acontext/types').ContentPart[];
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
      tool_call_id?: string;
    }> = [];
    let tokenCount = 0;

    if (sessionData) {
      messages = await getMessages(acontextClient, sessionData.acontext_session_id, { limit: 100 });
      tokenCount = await getTokenCounts(acontextClient, sessionData.acontext_session_id);
    }

    // Build system content
    const systemContent = buildSystemContent(documentMarkdown, selectionMarkdown);

    // Get tool schemas
    const editTools = getChatEditToolSchema();
    const sandboxTools = getSandboxToolSchemas();

    return NextResponse.json({
      session: sessionData ? {
        id: sessionData.id,
        acontextSessionId: sessionData.acontext_session_id,
        acontextDiskId: sessionData.acontext_disk_id,
        title: sessionData.title,
        createdAt: sessionData.created_at,
      } : null,
      systemPrompt: {
        template: CHAT_EDIT_SYSTEM_PROMPT,
        current: systemContent,
        documentLength: documentMarkdown.length,
        hasSelection: !!selectionMarkdown,
      },
      tools: {
        edit: editTools.map(t => {
          if ('function' in t && t.function) {
            return {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            };
          }
          return null;
        }).filter(Boolean),
        sandbox: sandboxTools.map(t => {
          if ('function' in t && t.function) {
            return {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            };
          }
          return null;
        }).filter(Boolean),
      },
      messages: messages.map((m, idx) => ({
        index: idx,
        role: m.role,
        contentLength: m.content?.length || 0,
        contentPreview: m.content?.slice(0, 200) || '',
        hasToolCalls: !!(m.tool_calls && m.tool_calls.length > 0),
        toolCallsCount: m.tool_calls?.length || 0,
        toolCalls: m.tool_calls?.map(tc => ({
          name: tc.function.name,
          argumentsLength: tc.function.arguments.length,
        })),
      })),
      stats: {
        messageCount: messages.length,
        tokenCount,
        userMessages: messages.filter(m => m.role === 'user').length,
        assistantMessages: messages.filter(m => m.role === 'assistant').length,
        toolMessages: messages.filter(m => m.role === 'tool').length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(LOG_TAG, 'Error', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
