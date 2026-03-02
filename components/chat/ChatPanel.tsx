'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Send, MessageSquare, X, Check, Ban, StopCircle, History, ChevronDown, ChevronUp, Settings, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';
import { sanitizeHtml } from '@/lib/chat/sanitize-html';
import { useTranslations } from '@/contexts/LocaleContext';
import { SessionMemoryPanel } from './SessionMemoryPanel';
import { StreamingMarkdown } from './StreamingMarkdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Transform disk:: URLs to proxy URLs for rendering in chat */
function transformDiskUrlsInContent(content: string, documentId: string): string {
  // Match markdown image syntax: ![alt](disk::path)
  return content.replace(
    /!\[([^\]]*)\]\(disk::([^)]+)\)/g,
    (match, alt, path) => {
      const proxyUrl = `/api/images/proxy?path=${encodeURIComponent(path)}&documentId=${encodeURIComponent(documentId)}`;
      return `![${alt}](${proxyUrl})`;
    }
  );
}

/** Streaming text with typewriter cursor - optimized for real-time display */
function StreamingText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {content}
      {/* Animated cursor */}
      <span className="inline-block w-0.5 h-[1.1em] ml-0.5 bg-current align-middle animate-[blink_1s_step-end_infinite]" />
    </span>
  );
}

/** Renders message content - plain text during streaming, Markdown after */
function ChatMessageContent({
  content,
  placeholder,
  className,
  documentId,
  isStreaming = false,
}: {
  content: string;
  placeholder?: string;
  className?: string;
  documentId?: string;
  isStreaming?: boolean;
}) {
  const [html, setHtml] = useState('');

  // Only parse Markdown when NOT streaming (for performance)
  useEffect(() => {
    if (!content?.trim()) {
      setHtml('');
      return;
    }

    // Skip Markdown parsing during streaming for better performance
    if (isStreaming) {
      setHtml('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Transform disk:: URLs to proxy URLs before parsing
        const transformedContent = documentId
          ? transformDiskUrlsInContent(content, documentId)
          : content;
        // Enable breaks: true to convert single \n to <br>
        const out = await marked.parse(transformedContent, { breaks: true, gfm: true });
        const sanitizedHtml = sanitizeHtml(typeof out === 'string' ? out : '');
        // Debug: log original content vs parsed HTML
        console.log('[ChatMessageContent] Markdown解析', {
          originalNewlines: (content.match(/\n/g) || []).length,
          parsedBrTags: (sanitizedHtml.match(/<br>/g) || []).length,
          contentPreview: content.slice(0, 100),
          htmlPreview: sanitizedHtml.slice(0, 200),
        });
        if (!cancelled) setHtml(sanitizedHtml);
      } catch (err) {
        console.error('[ChatMessageContent] Error:', err);
        if (!cancelled) setHtml('');
      }
    })();
    return () => { cancelled = true; };
  }, [content, documentId, isStreaming]);

  if (!content?.trim() && placeholder) {
    return <span className={className}>{placeholder}</span>;
  }

  // During streaming: show plain text with animated cursor
  if (isStreaming) {
    return <StreamingText content={content} className={className} />;
  }

  if (!html) {
    return <span className={cn('whitespace-pre-wrap break-words', className)}>{content}</span>;
  }
  return (
    <div
      className={cn(
        'chat-message-markdown prose prose-sm dark:prose-invert max-w-none break-words',
        'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Truncate long strings for display
function truncate(str: string, maxLen: number = 100): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// Check if a tool is a sandbox tool (doesn't need user confirmation)
function isSandboxTool(name: string): boolean {
  return ['bash_execution_sandbox', 'text_editor_sandbox', 'export_file_sandbox'].includes(name);
}

// Collapsible content component
function CollapsibleContent({ label, content, maxLines = 3, maxChars = 100, t }: { label: string; content: string; maxLines?: number; maxChars?: number; t: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const isLongContent = lines.length > maxLines || content.length > maxChars;

  if (!content) return null;

  // When collapsed, show truncated content
  const getDisplayContent = () => {
    if (expanded || !isLongContent) return content;

    // If multiple lines, show first N lines
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '\n...';
    }

    // If single long line, truncate by characters
    return content.slice(0, maxChars) + '...';
  };

  const displayContent = getDisplayContent();

  return (
    <div className="text-muted-foreground">
      <span className="font-medium">{label}:</span>{' '}
      <pre className="bg-muted px-2 py-1 rounded text-xs mt-1 whitespace-pre-wrap break-all font-mono">
        {displayContent}
      </pre>
      {isLongContent && (
        <button
          className="text-primary hover:underline text-xs mt-1 flex items-center gap-0.5"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> {t('chat.collapsed')}</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> {t('chat.expandAll')}{lines.length > 1 ? ` (${lines.length} ${t('chat.lines')})` : ''}</>
          )}
        </button>
      )}
    </div>
  );
}

function ToolCallBlock({
  tool,
  pending,
  messageId,
  toolIndex,
  onChoice,
  t,
}: {
  tool: ToolCallDisplay;
  pending?: boolean;
  messageId?: string;
  toolIndex?: number;
  onChoice?: (messageId: string, toolIndex: number, choice: 'apply' | 'decline') => void;
  t: (key: string) => string;
}) {
  const { name, arguments: args, applied, userChoice, error, result } = tool;
  const isSandbox = isSandboxTool(name);

  // Different name labels for different tools
  let nameLabel = name;
  if (name === 'search_replace') nameLabel = t('chat.tools.searchReplace');
  else if (name === 'insert_after') nameLabel = t('chat.tools.insertAfter');
  else if (name === 'bash_execution_sandbox') nameLabel = t('chat.tools.bashExecution');
  else if (name === 'text_editor_sandbox') nameLabel = t('chat.tools.textEditor');
  else if (name === 'export_file_sandbox') nameLabel = t('chat.tools.exportFile');

  // Sandbox tools: show execution status (no user confirmation needed)
  // Edit tools: show match/apply status (needs user confirmation)
  let statusLabel: string;
  let statusColor: string;

  if (isSandbox) {
    // Sandbox tools - show execution result
    if (applied) {
      statusLabel = t('chat.status.executed');
      statusColor = 'text-green-600 dark:text-green-400';
    } else if (error) {
      statusLabel = `${t('chat.status.failed')}: ${error}`;
      statusColor = 'text-red-600 dark:text-red-400';
    } else {
      statusLabel = t('chat.status.pending');
      statusColor = 'text-amber-600 dark:text-amber-400';
    }
  } else {
    // Edit tools - show match/apply status
    statusLabel = pending
      ? userChoice === 'apply'
        ? t('chat.edit.selectedApply')
        : userChoice === 'decline'
          ? t('chat.edit.selectedSkip')
          : t('chat.edit.canApply')
      : applied
        ? t('chat.edit.applied')
        : userChoice === 'decline'
          ? t('chat.edit.skipped')
          : error
            ? `${t('chat.edit.matchFailed')}: ${error}`
            : t('chat.edit.notMatched');
    statusColor =
      userChoice === 'apply' || (applied && !pending)
        ? 'text-green-600 dark:text-green-400'
        : error
          ? 'text-red-600 dark:text-red-400'
          : userChoice === 'decline' || (!applied && !pending)
            ? 'text-muted-foreground'
            : 'text-amber-600 dark:text-amber-400';
  }

  // Sandbox tools don't need user confirmation buttons
  const canClick = !isSandbox && pending && messageId != null && toolIndex != null && onChoice;

  // Helper to get public URL (may be in _meta for export_file_sandbox)
  const getPublicUrl = () => result?.publicUrl || result?.public_url || result?._meta?.publicUrl;

  // Helper to check if there are any results to show
  const hasResult = result && (
    result.stdout ||
    result.stderr ||
    result.diskPath ||
    getPublicUrl() ||
    result.message ||
    result.exit_code !== undefined
  );

  return (
    <div className="text-xs rounded bg-background/60 p-2 space-y-2">
      {/* Header: tool name + status */}
      <p className="font-medium flex items-center gap-1.5 flex-wrap">
        {nameLabel}
        {statusLabel != null && <span className={statusColor}>{statusLabel}</span>}
        {canClick && (
          <span className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs px-1.5"
              onClick={() => onChoice(messageId, toolIndex, 'apply')}
            >
              {t('chat.edit.apply')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1.5"
              onClick={() => onChoice(messageId, toolIndex, 'decline')}
            >
              {t('chat.edit.skip')}
            </Button>
          </span>
        )}
      </p>

      {/* Parameters section */}
      <div className="space-y-1">
        {name === 'search_replace' && (
          <>
            <CollapsibleContent label="old_string" content={String(args.old_string ?? '')} t={t} />
            <CollapsibleContent label="new_string" content={String(args.new_string ?? '')} t={t} />
          </>
        )}
        {name === 'insert_after' && (
          <>
            <CollapsibleContent label="after_string" content={String(args.after_string ?? '')} t={t} />
            <CollapsibleContent label="content" content={String(args.content ?? '')} t={t} />
          </>
        )}
        {name === 'bash_execution_sandbox' && (
          <p className="text-muted-foreground">
            <span className="font-medium text-blue-600 dark:text-blue-400">command:</span>{' '}
            <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.command ?? '')}</code>
          </p>
        )}
        {name === 'text_editor_sandbox' && (
          <>
            <p className="text-muted-foreground">
              <span className="font-medium text-blue-600 dark:text-blue-400">command:</span>{' '}
              <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.command ?? '')}</code>
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-blue-600 dark:text-blue-400">path:</span>{' '}
              <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.path ?? '')}</code>
            </p>
            {args.file_text && <CollapsibleContent label="file_text" content={String(args.file_text)} t={t} />}
          </>
        )}
        {name === 'export_file_sandbox' && (
          <>
            {(args.sandbox_file_path || args.sandbox_path) && (
              <p className="text-muted-foreground">
                <span className="font-medium text-blue-600 dark:text-blue-400">sandbox_path:</span>{' '}
                <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.sandbox_file_path ?? args.sandbox_path)}</code>
              </p>
            )}
            {(args.sandbox_filename) && (
              <p className="text-muted-foreground">
                <span className="font-medium text-blue-600 dark:text-blue-400">filename:</span>{' '}
                <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.sandbox_filename)}</code>
              </p>
            )}
            {(args.disk_file_path || args.disk_path) && (
              <p className="text-muted-foreground">
                <span className="font-medium text-blue-600 dark:text-blue-400">disk_path:</span>{' '}
                <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded text-xs">{String(args.disk_file_path ?? args.disk_path)}</code>
              </p>
            )}
          </>
        )}
      </div>

      {/* Results section (for sandbox tools) */}
      {hasResult && (
        <div className="border-t border-border/50 pt-2 mt-2 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{t('chat.edit.result')}</p>
          {name === 'bash_execution_sandbox' && (
            <>
              {result?.stdout && <CollapsibleContent label="stdout" content={String(result.stdout)} t={t} />}
              {result?.stderr && <CollapsibleContent label="stderr" content={String(result.stderr)} t={t} />}
              {result?.exit_code !== undefined && (
                <p className="text-muted-foreground">
                  <span className="font-medium">exit_code:</span>{' '}
                  <code className="bg-muted px-1 rounded text-xs">{result.exit_code === 0 ? (
                    <span className="text-green-600">0 (success)</span>
                  ) : (
                    <span className="text-red-600">{String(result.exit_code)}</span>
                  )}</code>
                </p>
              )}
            </>
          )}
          {name === 'text_editor_sandbox' && result?.message && (
            <p className="text-muted-foreground">
              <span className="font-medium">message:</span>{' '}
              <code className="bg-muted px-1 rounded text-xs text-green-600">{String(result.message)}</code>
            </p>
          )}
          {name === 'export_file_sandbox' && (
            <>
              {result?.diskPath && (
                <p className="text-muted-foreground">
                  <span className="font-medium">diskPath:</span>{' '}
                  <code className="bg-muted px-1 rounded text-xs text-green-600">{result.diskPath}</code>
                </p>
              )}
              {getPublicUrl() && (
                <CollapsibleContent
                  label="publicUrl"
                  content={String(getPublicUrl())}
                  maxLines={1}
                  t={t}
                />
              )}
              {result?.message && (
                <p className="text-muted-foreground">
                  <span className="font-medium">message:</span>{' '}
                  <code className="bg-muted px-1 rounded text-xs text-green-600">{String(result.message)}</code>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface ToolCallDisplay {
  name: string;
  arguments: Record<string, unknown>;
  /** 预演时是否匹配（整条消息全量应用时的结果） */
  applied?: boolean;
  /** 用户选择：应用 / 不应用；确认后用于显示「已应用」「未应用」 */
  userChoice?: 'apply' | 'decline';
  /** Error message if tool failed to apply */
  error?: string;
  /** Sandbox tool execution result (stdout, diskPath, etc.) */
  result?: {
    stdout?: string;
    stderr?: string;
    diskPath?: string;
    publicUrl?: string;
    public_url?: string;
    message?: string;
    exit_code?: number;
    success?: boolean;
    _meta?: {
      originalDiskPath?: string;
      publicUrl?: string;
    };
    [key: string]: unknown;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** When assistant applied edits (after user confirmed) */
  appliedEdits?: number;
  editError?: string;
  /** Tool calls for display (name + args) */
  toolCalls?: ToolCallDisplay[];
  /** 有待用户确认的编辑：不写入文档，等用户点「确认应用」 */
  pendingApply?: boolean;
  /** 收到 tool calls 时的文档快照，用于按用户选择逐条应用 */
  initialMarkdown?: string;
  /** 若用户确认应用，将写入的完整文档内容（可选，也可用 initialMarkdown + 选中的 tool 计算） */
  pendingNewMarkdown?: string;
  /** 用户点击了「取消」 */
  editDeclined?: boolean;
}

interface ChatPanelProps {
  /** Current document markdown (for API context) */
  getMarkdown: () => string;
  /** Apply new document content after edit tools */
  setMarkdown: (markdown: string) => void;
  /** Optional: current selection as markdown (for API context) */
  getSelectionMarkdown?: () => string;
  /** Optional: document ID for Acontext session binding */
  documentId?: string;
  /** Enable Acontext for message persistence */
  useAcontext?: boolean;
  /** Optional: save document immediately (called after applying edits) */
  saveDocument?: () => void;
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({
  getMarkdown,
  setMarkdown,
  getSelectionMarkdown,
  documentId,
  useAcontext = false,
  saveDocument,
  className,
  onClose,
}: ChatPanelProps) {
  const t = useTranslations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typewriterSpeed, setTypewriterSpeed] = useState(3); // 1=slow, 5=fast, 10=instant
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<Array<{ name: string; arguments: string }>>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Agent loop state
  const [agentLoopState, setAgentLoopState] = useState<{
    isRunning: boolean;
    iteration: number;
    maxIterations: number;
    currentTool: {
      name: string;
      args: Record<string, unknown>;
      status: 'executing' | 'success' | 'error';
      result?: Record<string, unknown>;
      error?: string;
    } | null;
    completedTools: Array<{
      name: string;
      args: Record<string, unknown>;
      applied: boolean;
      result?: Record<string, unknown>;
      error?: string;
    }>;
  }>({
    isRunning: false,
    iteration: 0,
    maxIterations: 20,
    currentTool: null,
    completedTools: [],
  });

  // Load chat history from Acontext on mount
  useEffect(() => {
    if (!useAcontext || !documentId) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/ai/chat-acontext?documentId=${documentId}`);
        if (!res.ok) {
          console.error('[ChatPanel] Failed to load history');
          return;
        }

        const data = await res.json();
        if (data.session) {
          setChatSessionId(data.session.id);
          setTokenCount(data.tokenCount || 0);
        }

        if (data.messages && data.messages.length > 0) {
          // Build a map of tool_call_id -> tool response (applied, error, result)
          const toolResponses = new Map<string, { applied: boolean; error?: string; result?: Record<string, unknown> }>();
          for (const m of data.messages) {
            if (m.role === 'tool' && m.tool_call_id) {
              try {
                const responseContent = JSON.parse(m.content || '{}');
                toolResponses.set(m.tool_call_id, {
                  applied: responseContent.applied ?? false,
                  error: responseContent.error,
                  result: responseContent.result, // Include sandbox tool results
                });
              } catch {
                // Ignore parse errors
              }
            }
          }

          setMessages(
            data.messages
              .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
              .map((m: {
                role: string;
                content: string;
                id?: string;
                tool_calls?: Array<{
                  id: string;
                  type: 'function';
                  function: { name: string; arguments: string };
                }>;
              }, idx: number) => ({
                id: m.id || `loaded-${idx}`,
                role: m.role as 'user' | 'assistant',
                content: m.content,
                // Include ALL tools (sandbox + edit) in toolCalls
                toolCalls: m.tool_calls?.map((tc, tcIdx) => {
                  // Look up the tool response for this tool call
                  const response = toolResponses.get(tc.id);
                  const isEditTool = ['search_replace', 'insert_after'].includes(tc.function.name);
                  return {
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || '{}'),
                    applied: response?.applied ?? true,
                    error: response?.error,
                    result: response?.result, // Include sandbox tool results
                    userChoice: isEditTool && (response?.applied ?? true) ? 'apply' as const : undefined,
                  };
                }),
              }))
          );
          console.log('[ChatPanel] Loaded', data.messages.length, 'messages from Acontext');
        }
      } catch (error) {
        console.error('[ChatPanel] Error loading history:', error);
        toast.error(t('chat.error.loadFailed'));
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [useAcontext, documentId, t]);

  const setToolChoice = (messageId: string, toolIndex: number, choice: 'apply' | 'decline') => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.toolCalls?.length) return m;
        const next = [...m.toolCalls];
        if (next[toolIndex]) next[toolIndex] = { ...next[toolIndex], userChoice: choice };
        return { ...m, toolCalls: next };
      })
    );
  };

  const applyPendingEdit = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.pendingApply || !msg.toolCalls?.length) return;
    const base = msg.initialMarkdown ?? msg.pendingNewMarkdown ?? getMarkdown();
    let currentMarkdown = base;
    const appliedPerTool: boolean[] = [];
    const errorsPerTool: (string | undefined)[] = [];
    for (let i = 0; i < msg.toolCalls.length; i++) {
      const tc = msg.toolCalls[i];
      if (tc.userChoice !== 'apply') {
        appliedPerTool.push(false);
        errorsPerTool.push(undefined);
        continue;
      }
      const result = applyEditTool(currentMarkdown, tc.name, tc.arguments);
      appliedPerTool.push(result.applied);
      errorsPerTool.push(result.error);
      if (result.applied) currentMarkdown = result.newMarkdown;
    }

    const appliedCount = appliedPerTool.filter(Boolean).length;

    // Update messages state first
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const toolCalls = (m.toolCalls ?? []).map((t, i) => ({
          ...t,
          applied: appliedPerTool[i] ?? t.applied,
          error: errorsPerTool[i] ?? t.error,
        }));
        return {
          ...m,
          pendingApply: false,
          pendingNewMarkdown: undefined,
          initialMarkdown: undefined,
          appliedEdits: appliedCount,
          toolCalls,
        };
      })
    );

    // Apply markdown and save to database
    if (appliedCount > 0) {
      // Update local state
      setMarkdown(currentMarkdown);

      // Save directly to database via API
      if (documentId) {
        const saveToastId = toast.loading(t('chat.edit.saving') || 'Saving...');

        try {
          const res = await fetch(`/api/documents/${documentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: currentMarkdown }),
          });

          if (!res.ok) {
            throw new Error('Failed to save document');
          }

          toast.success(t('chat.confirm.appliedCount', { count: appliedCount }), {
            id: saveToastId,
          });
        } catch (error) {
          console.error('[ChatPanel] Save error:', error);
          toast.error(t('chat.error.saveFailed') || 'Failed to save', {
            id: saveToastId,
          });
        }
      } else {
        // No documentId, just show success
        toast.success(t('chat.confirm.appliedCount', { count: appliedCount }));
      }
    }
  };

  const declinePendingEdit = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              pendingApply: false,
              pendingNewMarkdown: undefined,
              editDeclined: true,
            }
          : m
      )
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, streamingContent, streamingToolCalls]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStreamingContent('');
    setStreamingToolCalls([]);
  }, []);

  // Refresh session - clear message history but keep disk files
  const handleRefreshSession = useCallback(async () => {
    if (!documentId || isRefreshing) return;

    if (!confirm(t('chat.confirm.refreshSession'))) return;

    setIsRefreshing(true);
    try {
      const res = await fetch('/api/ai/chat-acontext/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(t('chat.error.refreshFailed') + ': ' + (data.error || 'Unknown error'));
        return;
      }

      const data = await res.json();
      setChatSessionId(data.session.acontextSessionId);
      setMessages([]);
      setTokenCount(0);
      toast.success(t('chat.refreshSuccess'));
    } catch (error) {
      console.error('[ChatPanel] Refresh session error:', error);
      toast.error(t('chat.error.refreshFailed'));
    } finally {
      setIsRefreshing(false);
    }
  }, [documentId, isRefreshing, t]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setStreamingToolCalls([]);
    // Reset agent loop state
    setAgentLoopState({
      isRunning: false,
      iteration: 0,
      maxIterations: 5,
      currentTool: null,
      completedTools: [],
    });

    const documentMarkdown = getMarkdown();
    const selectionMarkdown = getSelectionMarkdown?.()?.trim() || undefined;

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Choose API endpoint based on useAcontext setting
    const apiEndpoint = useAcontext ? '/api/ai/chat-acontext' : '/api/ai/chat-stream';

    // Build request body based on API type
    const requestBody = useAcontext
      ? {
          content: text,
          documentId,
          documentMarkdown,
          selectionMarkdown: selectionMarkdown || null,
          chatSessionId,
        }
      : {
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          documentMarkdown,
          selectionMarkdown: selectionMarkdown || null,
        };

    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(t('chat.error.requestFailed') + ': ' + (data.error ?? t('chat.error.unknownError')));
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: data.error ?? 'Request failed',
          },
        ]);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: 'No response stream',
          },
        ]);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';
      let finalToolCalls: Array<{
        name: string;
        arguments: Record<string, unknown>;
        applied: boolean;
        error?: string;
        result?: Record<string, unknown>;
      }> = [];
      let finalDoc: string | undefined;

      const streamStartTime = Date.now();
      let chunkCount = 0;
      console.log('[ChatPanel] 🚀 Stream started', { timestamp: streamStartTime });

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('[ChatPanel] ✅ Stream done', {
            duration: `${Date.now() - streamStartTime}ms`,
            totalChunks: chunkCount,
            finalContentLen: finalContent.length,
          });
          break;
        }

        chunkCount++;
        const bytesLen = value?.length || 0;
        if (chunkCount <= 5 || chunkCount % 10 === 0) {
          console.log('[ChatPanel] 📡 Stream read', {
            chunk: chunkCount,
            bytesLen,
            elapsed: `${Date.now() - streamStartTime}ms`,
          });
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            // Acontext session info
            if (data.type === 'session' && useAcontext) {
              setChatSessionId(data.chatSessionId);
              console.log('[ChatPanel] Got session', data.chatSessionId);
            }

            // Agent loop events
            if (data.type === 'agent_loop_start') {
              setAgentLoopState({
                isRunning: true,
                iteration: 0,
                maxIterations: data.maxIterations,
                currentTool: null,
                completedTools: [],
              });
            }

            if (data.type === 'agent_loop_iteration') {
              setAgentLoopState((prev) => ({
                ...prev,
                iteration: data.iteration,
                currentTool: null, // Reset for new iteration
              }));
            }

            if (data.type === 'agent_loop_tool') {
              if (data.status === 'executing') {
                // Tool is being executed
                setAgentLoopState((prev) => ({
                  ...prev,
                  currentTool: {
                    name: data.toolName,
                    args: data.args,
                    status: 'executing',
                  },
                }));
              } else {
                // Tool completed (success or error)
                const toolResult = {
                  name: data.toolName,
                  arguments: data.args,
                  applied: data.applied,
                  result: data.result,
                  error: data.error,
                };

                setAgentLoopState((prev) => {
                  const newCompletedTools = [...prev.completedTools, {
                    name: data.toolName,
                    args: data.args,
                    applied: data.applied,
                    result: data.result,
                    error: data.error,
                  }];
                  return {
                    ...prev,
                    currentTool: null,
                    completedTools: newCompletedTools,
                  };
                });

                // Also update finalToolCalls for the done handler
                finalToolCalls.push(toolResult);
              }
            }

            if (data.type === 'agent_loop_end') {
              setAgentLoopState((prev) => ({
                ...prev,
                isRunning: false,
              }));
            }

            if (data.type === 'content') {
              finalContent += data.content;
              console.log('[ChatPanel] 📦 Content chunk received', {
                chunkLen: data.content.length,
                chunkPreview: data.content.slice(0, 30),
                totalLen: finalContent.length,
                timestamp: Date.now(),
              });
              // Use regular state update - StreamingMarkdown handles smooth rendering
              setStreamingContent(finalContent);
            }

            if (data.type === 'tool_call_delta') {
              setStreamingToolCalls((prev) => {
                const next = [...prev];
                next[data.index] = data.toolCall;
                return next;
              });
            }

            if (data.type === 'done') {
              finalContent = data.content;
              finalToolCalls = data.toolCalls || [];
              finalDoc = data.documentMarkdown;
              // Update token count from Acontext
              if (data.tokenCount !== undefined) {
                setTokenCount(data.tokenCount);
              }
            }

            if (data.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  role: 'assistant',
                  content: data.error,
                },
              ]);
              return;
            }
          } catch {
            // Ignore parse errors for individual lines
          }
        }
      }

      // Process final tool calls
      const editToolNames = ['search_replace', 'insert_after'];

      // Include ALL tools in the final message for display
      // Sandbox tools: already executed, just show results
      // Edit tools: need user confirmation
      const toolCallsDisplay: ToolCallDisplay[] = finalToolCalls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
        applied: tc.applied,
        userChoice: editToolNames.includes(tc.name) ? 'apply' as const : undefined,
        error: tc.error,
        result: tc.result, // Include sandbox tool results (stdout, diskPath, etc.)
      }));

      // Only EDIT tools need user confirmation
      const editToolCalls = toolCallsDisplay.filter((t) => editToolNames.includes(t.name));
      const appliedEditCount = editToolCalls.filter((t) => t.applied).length;
      const hasPendingEdits = editToolCalls.length > 0 && appliedEditCount > 0;
      const assistantId = `assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: finalContent,
          appliedEdits: hasPendingEdits ? undefined : (appliedEditCount > 0 ? appliedEditCount : undefined),
          toolCalls: toolCallsDisplay.length > 0 ? toolCallsDisplay : undefined,
          pendingApply: hasPendingEdits,
          initialMarkdown: hasPendingEdits ? documentMarkdown : undefined,
          pendingNewMarkdown: hasPendingEdits ? finalDoc : undefined,
        },
      ]);
      setStreamingContent('');
      setStreamingToolCalls([]);

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled - add a note
        setMessages((prev) => [
          ...prev,
          {
            id: `cancelled-${Date.now()}`,
            role: 'assistant',
            content: `(${t('chat.confirm.cancelled')})`,
          },
        ]);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(t('chat.error.sendFailed') + ': ' + message);
        setMessages((prev) => [
          ...prev,
            {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: message,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setStreamingToolCalls([]);
      abortControllerRef.current = null;
    }
  };

  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4 border-b">
        <span className="flex items-center gap-2 font-medium">
          <MessageSquare className="h-4 w-4" />
          {t('chat.title')}
          {useAcontext && tokenCount > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({Math.round(tokenCount / 1000)}K tokens)
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {isLoadingHistory && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('chat.loadingHistory')}
            </span>
          )}
          {useAcontext && messages.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <History className="h-3 w-3" />
              {messages.length} {t('chat.messageCount')}
            </span>
          )}
          {useAcontext && documentId && (
            <SessionMemoryPanel
              documentId={documentId}
              documentMarkdown={getMarkdown()}
              selectionMarkdown={getSelectionMarkdown?.()}
            />
          )}
          {/* Refresh session button */}
          {useAcontext && documentId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('chat.refreshSession')}
              type="button"
              onClick={handleRefreshSession}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          )}
          {/* Chat settings (typewriter speed, etc.) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t('settings.title')}
                type="button"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t('chat.title')} · {t('sidebar.settings')}
              </DropdownMenuLabel>
              <div className="px-2 py-1.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 w-20">{t('chat.speed.label')}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={typewriterSpeed}
                    onChange={(e) => setTypewriterSpeed(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    title={t('chat.speed.title')}
                  />
                  <span className="shrink-0 w-10 text-right font-medium">
                    {typewriterSpeed === 10
                      ? '⚡'
                      : typewriterSpeed <= 3
                        ? '🐢'
                        : typewriterSpeed >= 7
                          ? '🚀'
                          : typewriterSpeed}
                  </span>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-4 space-y-4"
        >
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('chat.inputPlaceholder')}
            </p>
          ) : null}
          {!isLoadingHistory && messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {/* LLM 文字回复（Markdown 渲染） */}
                {(m.role === 'user' || m.content || (m.role === 'assistant' && m.toolCalls?.length)) && (
                  <ChatMessageContent
                    content={m.content ?? ''}
                    placeholder={
                      m.role === 'assistant' && !m.content && m.toolCalls?.length
                        ? t('chat.empty.toolOnly')
                        : undefined
                    }
                    documentId={documentId}
                  />
                )}
                {/* 工具调用详情 */}
                {m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('chat.tools.title')}</p>
                    {m.toolCalls.map((tc, i) => (
                      <ToolCallBlock
                        key={i}
                        tool={tc}
                        pending={m.pendingApply}
                        messageId={m.id}
                        toolIndex={i}
                        onChoice={setToolChoice}
                        t={t}
                      />
                    ))}
                  </div>
                )}
                {/* 待确认：勾选后点「确认应用」或「取消」 */}
                {m.role === 'assistant' && m.pendingApply && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {t('chat.confirm.hint')}
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => applyPendingEdit(m.id)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t('chat.confirm.confirmApply')}
                      {(m.toolCalls?.filter((t) => t.userChoice === 'apply').length ?? 0) > 0 &&
                        ` (${m.toolCalls!.filter((t) => t.userChoice === 'apply').length} ${t('chat.confirm.places')})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => declinePendingEdit(m.id)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      {t('chat.confirm.cancelled')}
                    </Button>
                  </div>
                )}
                {m.role === 'assistant' && m.appliedEdits != null && m.appliedEdits > 0 && !m.pendingApply && (
                  <p className="text-xs mt-1.5 text-green-600 dark:text-green-400">
                    {t('chat.confirm.appliedCount').replace('{count}', String(m.appliedEdits))}
                  </p>
                )}
                {m.role === 'assistant' && m.editDeclined && (
                  <p className="text-xs mt-1.5 text-muted-foreground">{t('chat.confirm.cancelledHint')}</p>
                )}
                {m.role === 'assistant' && m.editError && (
                  <p className="text-xs mt-1.5 text-destructive">{m.editError}</p>
                )}
              </div>
            </div>
          ))}
          {/* Agent loop progress indicator */}
          {isLoading && agentLoopState.isRunning && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {t('chat.loop.processing')} ({agentLoopState.iteration}/{agentLoopState.maxIterations})
                  </span>
                </div>
                {/* Current tool being executed */}
                {agentLoopState.currentTool && (
                  <div className="text-xs rounded bg-background/60 p-2 space-y-1">
                    <p className="font-medium flex items-center gap-1.5">
                      {agentLoopState.currentTool.name === 'bash_execution_sandbox' && t('chat.tools.bashExecution')}
                      {agentLoopState.currentTool.name === 'text_editor_sandbox' && t('chat.tools.textEditor')}
                      {agentLoopState.currentTool.name === 'export_file_sandbox' && t('chat.tools.exportFile')}
                      {agentLoopState.currentTool.name === 'search_replace' && t('chat.tools.searchReplace')}
                      {agentLoopState.currentTool.name === 'insert_after' && t('chat.tools.insertAfter')}
                      <span className="text-amber-600 dark:text-amber-400">{t('chat.status.executing')}</span>
                    </p>
                    {Boolean(agentLoopState.currentTool.args.command) && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">command:</span>{' '}
                        <code className="bg-muted px-1 rounded text-xs">
                          {truncate(String(agentLoopState.currentTool.args.command ?? ''))}
                        </code>
                      </p>
                    )}
                    {Boolean(agentLoopState.currentTool.args.path) && (
                      <p className="text-muted-foreground">
                        <span className="font-medium">path:</span>{' '}
                        <code className="bg-muted px-1 rounded text-xs">
                          {String(agentLoopState.currentTool.args.path ?? '')}
                        </code>
                      </p>
                    )}
                  </div>
                )}
                {/* Completed tools in this loop */}
                {agentLoopState.completedTools.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('chat.loop.completed').replace('{count}', String(agentLoopState.completedTools.length))}
                    </p>
                    {agentLoopState.completedTools.map((tool, idx) => (
                      <div key={idx} className="text-xs rounded bg-background/60 p-2 space-y-1">
                        <p className="font-medium flex items-center gap-1.5">
                          {tool.name === 'bash_execution_sandbox' && 'bash_execution'}
                          {tool.name === 'text_editor_sandbox' && 'text_editor'}
                          {tool.name === 'export_file_sandbox' && 'export_file'}
                          {tool.name === 'search_replace' && 'search_replace'}
                          {tool.name === 'insert_after' && 'insert_after'}
                          <span className={tool.applied ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {tool.applied ? t('chat.status.success') : `${t('chat.status.failed')}: ${tool.error}`}
                          </span>
                        </p>
                        {/* Show sandbox tool results */}
                        {tool.result && (
                          <>
                            {tool.result.stdout && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">stdout:</span>{' '}
                                <code className="bg-muted px-1 rounded text-xs">{truncate(String(tool.result.stdout ?? ''))}</code>
                              </p>
                            )}
                            {tool.result.stderr && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">stderr:</span>{' '}
                                <code className="bg-muted px-1 rounded text-xs text-red-500">{truncate(String(tool.result.stderr ?? ''))}</code>
                              </p>
                            )}
                            {tool.result.diskPath && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">diskPath:</span>{' '}
                                <code className="bg-muted px-1 rounded text-xs">{String(tool.result.diskPath ?? '')}</code>
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Streaming content / Loading indicator - show during agent loop too */}
          {isLoading && (streamingContent || streamingToolCalls.length > 0) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm">
                {streamingContent && (
                  <StreamingMarkdown
                    content={streamingContent}
                    isStreaming={isLoading}
                    speed={typewriterSpeed}
                    documentId={documentId}
                    className="text-sm"
                  />
                )}
                {streamingToolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('chat.streaming.editing').replace('{count}', String(streamingToolCalls.length))}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {isLoading && !streamingContent && streamingToolCalls.length === 0 && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-muted flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('chat.streaming.thinking')}
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t space-y-2">
          <div className="flex gap-2">
          <Input
            placeholder={
              isLoadingHistory ? t('chat.loadingHistory') :
              isRefreshing ? t('chat.refreshSession') + '...' :
              t('chat.inputPlaceholderShort')
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading || isLoadingHistory || isRefreshing}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={isLoading ? cancelRequest : sendMessage}
            disabled={isLoading || isLoadingHistory || isRefreshing || !input.trim()}
            variant={isLoading ? 'destructive' : 'default'}
            className="shrink-0"
            title={isLoading ? t('chat.cancel') : t('chat.send')}
          >
            {isLoading ? (
              <StopCircle className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
