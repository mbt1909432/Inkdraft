'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessageSquare, X, Check, Ban, StopCircle, History, ChevronDown, ChevronUp, Settings, RefreshCw, ImagePlus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';
import { sanitizeHtml } from '@/lib/chat/sanitize-html';
import { useTranslations } from '@/contexts/LocaleContext';
import { SessionMemoryPanel } from './SessionMemoryPanel';
import { StreamingMarkdown } from './StreamingMarkdown';
import { SearchResultsCard } from './SearchResultsCard';
import { XiaohongshuCard } from '@/components/xiaohongshu';
import { QuizContainer } from '@/components/quiz';
import type { Quiz, QuizResult } from '@/lib/quiz/types';
import type { ContentPart } from '@/lib/acontext/types';
import type { PendingPDF, PDFParseMode, PDFParseResult } from '@/lib/pdf';
import { CommandMenu, useCommandDetection, type Command } from './CommandMenu';
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
  content: string | ContentPart[];
  placeholder?: string;
  className?: string;
  documentId?: string;
  isStreaming?: boolean;
}) {
  const [html, setHtml] = useState('');

  // Extract text from multimodal content
  const textContent = typeof content === 'string'
    ? content
    : content
        .filter(p => p.type === 'text')
        .map(p => p.text || '')
        .join('\n');

  // Extract images from multimodal content
  const imageParts = typeof content === 'string'
    ? []
    : content.filter(p => p.type === 'image_url' && p.image_url?.url);

  // Only parse Markdown when NOT streaming (for performance)
  useEffect(() => {
    if (!textContent?.trim()) {
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
          ? transformDiskUrlsInContent(textContent, documentId)
          : textContent;
        // Enable breaks: true to convert single \n to <br>
        const out = await marked.parse(transformedContent, { breaks: true, gfm: true });
        const sanitizedHtml = sanitizeHtml(typeof out === 'string' ? out : '');
        // Debug: log original content vs parsed HTML
        console.log('[ChatMessageContent] Markdown解析', {
          originalNewlines: (textContent.match(/\n/g) || []).length,
          parsedBrTags: (sanitizedHtml.match(/<br>/g) || []).length,
          contentPreview: textContent.slice(0, 100),
          htmlPreview: sanitizedHtml.slice(0, 200),
        });
        if (!cancelled) setHtml(sanitizedHtml);
      } catch (err) {
        console.error('[ChatMessageContent] Error:', err);
        if (!cancelled) setHtml('');
      }
    })();
    return () => { cancelled = true; };
  }, [textContent, documentId, isStreaming]);

  if (!textContent?.trim() && imageParts.length === 0 && placeholder) {
    return <span className={className}>{placeholder}</span>;
  }

  // During streaming: show plain text with animated cursor
  if (isStreaming) {
    return <StreamingText content={textContent} className={className} />;
  }

  // Render images if present
  const imageElements = imageParts.map((part, idx) => (
    <img
      key={idx}
      src={part.image_url?.url}
      alt={`Attached image ${idx + 1}`}
      className="max-w-full rounded-lg my-2 max-h-48 object-contain"
    />
  ));

  if (!html && !textContent) {
    return <div className={className}>{imageElements}</div>;
  }

  if (!html) {
    return (
      <div className={className}>
        {imageElements}
        <span className="whitespace-pre-wrap break-words">{textContent}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {imageElements}
      <div
        className={cn(
          'chat-message-markdown prose prose-sm dark:prose-invert max-w-none break-words',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2'
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
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
  /** Images attached to this message (for multimodal) */
  images?: Array<{
    id: string;
    dataUrl: string;  // base64 data URL
    file?: File;      // original file (before upload)
  }>;
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
  /** Quiz data for rendering QuizContainer */
  quiz?: Quiz;
  /** Quiz is loading */
  quizLoading?: boolean;
  /** Web search results for this message */
  searchResults?: {
    query: string;
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      source: string;
    }>;
  };
  /** Xiaohongshu card content */
  xiaohongshu?: {
    title: string;
    tags: string[];
    cards: Array<{ content: string }>;
  };
  /** Xiaohongshu card is loading */
  xiaohongshuLoading?: boolean;
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
  // Streaming search results (for web_search tool)
  const [streamingSearchResults, setStreamingSearchResults] = useState<{
    query: string;
    results: Array<{ title: string; url: string; snippet: string; source: string }>;
  } | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandMenuPosition, setCommandMenuPosition] = useState({ top: 0, left: 0 });
  // Pending images for multimodal messages
  const [pendingImages, setPendingImages] = useState<Array<{ id: string; dataUrl: string; file: File }>>([]);
  // Pending PDFs for multimodal messages
  const [pendingPDFs, setPendingPDFs] = useState<PendingPDF[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Command detection
  const { showMenu, commandFilter, atIndex } = useCommandDetection(input, cursorPosition);

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
                  const hasResponse = response !== undefined;
                  return {
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments || '{}'),
                    // For edit tools without response, they're pending (not applied yet)
                    // For non-edit tools (sandbox), default to applied if no response
                    applied: hasResponse ? response.applied : (isEditTool ? false : true),
                    error: response?.error,
                    result: response?.result, // Include sandbox tool results
                    // Only set userChoice if there's an actual response (user made a choice)
                    // If no response for edit tool, it's pending user choice (undefined)
                    userChoice: isEditTool && hasResponse && response.applied ? 'apply' as const
                              : isEditTool && hasResponse && !response.applied ? 'decline' as const
                              : undefined,
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

          toast.success(t('chat.confirm.appliedCount').replace('{count}', String(appliedCount)), {
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
        toast.success(t('chat.confirm.appliedCount').replace('{count}', String(appliedCount)));
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

  // Check if user is asking for a quiz
  const isQuizRequest = (text: string): { isQuiz: boolean; count?: number; error?: string } => {
    // First check for @quiz with invalid parameters
    const quizWithInvalidParam = text.match(/@quiz\s+(.+)$/i);
    if (quizWithInvalidParam) {
      const param = quizWithInvalidParam[1].trim();
      // If parameter exists but is not a valid number
      if (param && !/^\d+$/.test(param)) {
        return { isQuiz: false, error: 'quizInvalidParam' };
      }
    }

    const quizPatterns = [
      /@quiz(?:\s+(\d+))?$/i,     // @quiz or @quiz 5 (must be at end or followed by valid number)
      /帮我出(\d+)道题/,
      /出(\d+)道题/,
      /生成(\d+)道测验/,
      /生成(\d+)道题/,
      /出(\d+)道测试题/,
      /出(\d+)道考题/,
      /给我出(\d+)道题/,
      /帮我生成(\d+)道题/,
      /帮我写(\d+)道题/,
      /generate\s+(\d+)\s+quiz/i,
      /generate\s+(\d+)\s+question/i,
      /create\s+(\d+)\s+quiz/i,
      /帮我出题/,
      /出题/,
      /生成测验/,
      /生成测试/,
      /generate quiz/i,
      /quiz me/i,
      /test me/i,
    ];

    for (const pattern of quizPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = match[1] ? parseInt(match[1], 10) : 5;
        // Clamp count between 1 and 20
        const validCount = Math.min(Math.max(count, 1), 20);
        return { isQuiz: true, count: validCount };
      }
    }
    return { isQuiz: false };
  };

  // Check if user is asking for xiaohongshu card
  const isXiaohongshuRequest = (text: string): { isXiaohongshu: boolean; topic?: string } => {
    const xiaohongshuPatterns = [
      /@xiaohongshu(?:\s+(.+))?$/i,
      /小红书(?:\s+(.+))?$/i,
      /生成小红书卡片(?:\s+(.+))?$/i,
    ];

    for (const pattern of xiaohongshuPatterns) {
      const match = text.match(pattern);
      if (match) {
        const topic = match[1]?.trim();
        return { isXiaohongshu: true, topic };
      }
    }
    return { isXiaohongshu: false };
  };

  // Generate quiz from document content
  const generateQuiz = async (questionCount: number): Promise<void> => {
    const assistantId = `assistant-quiz-${Date.now()}`;

    // Add loading message
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        quizLoading: true,
      },
    ]);

    try {
      const documentContent = getMarkdown();

      if (!documentContent.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '文档内容为空，无法生成测验。', quizLoading: false }
              : m
          )
        );
        return;
      }

      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentContent,
          questionCount,
          questionTypes: ['mcq', 'fib'],
          language: 'zh',
        }),
      });

      const data = await response.json();

      if (data.success && data.quiz) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '', quiz: data.quiz, quizLoading: false }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.error || '生成测验失败', quizLoading: false }
              : m
          )
        );
      }
    } catch (error) {
      console.error('[ChatPanel] Quiz generation error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: '生成测验时发生错误', quizLoading: false }
            : m
        )
      );
    }
  };

  // Generate Xiaohongshu card content using function calling API
  const generateXiaohongshu = async (topic?: string): Promise<void> => {
    const assistantId = `assistant-xiaohongshu-${Date.now()}`;

    try {
      const documentContent = getMarkdown();

      const response = await fetch('/api/xiaohongshu/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentContent,
          topic,
          language: 'zh',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate xiaohongshu content');
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate content');
      }

      // Update the loading message with actual content
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: '',
                xiaohongshu: {
                  title: result.data.title || '',
                  tags: result.data.tags || [],
                  cards: result.data.cards || [],
                },
                xiaohongshuLoading: false,
              }
            : m
        )
      );
    } catch (error) {
      console.error('[ChatPanel] Xiaohongshu generation error:', error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: '生成小红书卡片时发生错误: ' + (error instanceof Error ? error.message : String(error)),
                xiaohongshuLoading: false,
              }
            : m
        )
      );
    }
  };

  // Handle image file selection
  const handleImageSelect = (files: FileList | null) => {
    if (!files) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    Array.from(files).forEach(file => {
      if (!validTypes.includes(file.type)) {
        toast.error(t('chat.image.invalidType') || 'Invalid image type. Use PNG, JPG, GIF, or WebP.');
        return;
      }
      if (file.size > maxSize) {
        toast.error(t('chat.image.tooLarge') || 'Image too large. Max 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setPendingImages(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            dataUrl,
            file,
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle paste event for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const hasImage = Array.from(items).some(item => item.type.startsWith('image/'));
    if (hasImage) {
      e.preventDefault();
      const files = new DataTransfer();
      Array.from(items).forEach(item => {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.items.add(file);
        }
      });
      handleImageSelect(files.files);
    }
  }, []);

  // Add paste listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Remove pending image
  const removePendingImage = (id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id));
  };

  // Handle PDF file selection
  const handlePDFSelect = async (files: FileList | null) => {
    if (!files) return;

    console.log('[ChatPanel] PDF files selected:', files.length);
    const validType = 'application/pdf';
    const maxSize = 50 * 1024 * 1024; // 50MB

    // Dynamically import PDF parsing functions (client-side only)
    console.log('[ChatPanel] Loading PDF parser...');
    const { parsePDF, getPDFInfo } = await import('@/lib/pdf');
    console.log('[ChatPanel] PDF parser loaded');

    for (const file of Array.from(files)) {
      console.log('[ChatPanel] Processing file:', file.name, file.type, file.size);
      if (file.type !== validType) {
        toast.error(t('chat.pdf.invalidType') || 'Invalid file type. Please use PDF.');
        continue;
      }
      if (file.size > maxSize) {
        toast.error(t('chat.pdf.tooLarge') || 'PDF too large. Max 50MB.');
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      console.log('[ChatPanel] Adding pending PDF with id:', id);

      // Add pending PDF with parsing status
      setPendingPDFs(prev => [...prev, {
        id,
        filename: file.name,
        pageCount: 0,
        parseMode: 'auto',
        status: 'parsing',
      }]);

      try {
        // Get page count first
        console.log('[ChatPanel] Getting PDF info...');
        const info = await getPDFInfo(file);
        console.log('[ChatPanel] PDF info:', info);

        // Update with page count
        setPendingPDFs(prev => prev.map(pdf =>
          pdf.id === id ? { ...pdf, pageCount: info.pageCount } : pdf
        ));

        // Parse PDF
        console.log('[ChatPanel] Parsing PDF...');
        const result = await parsePDF(file, {
          mode: 'auto',
          imageScale: 1.5,
          maxPages: 20,
        });
        console.log('[ChatPanel] PDF parsed, result type:', result.type, 'pageCount:', result.pageCount);

        // Update with result
        setPendingPDFs(prev => prev.map(pdf =>
          pdf.id === id ? { ...pdf, status: 'ready', result } : pdf
        ));
        console.log('[ChatPanel] PDF ready!');
      } catch (error) {
        console.error('[ChatPanel] PDF parsing error:', error);
        setPendingPDFs(prev => prev.map(pdf =>
          pdf.id === id ? {
            ...pdf,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          } : pdf
        ));
        toast.error(t('chat.pdf.parseError') || 'Failed to parse PDF');
      }
    }
  };

  // Change PDF parse mode
  const changePDFParseMode = async (id: string, mode: PDFParseMode) => {
    const pdf = pendingPDFs.find(p => p.id === id);
    if (!pdf || pdf.status !== 'ready') return;

    // If mode is the same, do nothing
    if (pdf.parseMode === mode && pdf.result) return;

    // Update mode and re-parse if needed
    setPendingPDFs(prev => prev.map(p =>
      p.id === id ? { ...p, parseMode: mode, status: 'parsing' } : p
    ));

    // Find the original file from input
    // Note: We need to store the file reference for re-parsing
    // For now, just update the mode and use existing result
    setPendingPDFs(prev => prev.map(p =>
      p.id === id ? { ...p, parseMode: mode, status: 'ready' } : p
    ));
  };

  // Remove pending PDF
  const removePendingPDF = (id: string) => {
    setPendingPDFs(prev => prev.filter(pdf => pdf.id !== id));
  };

  // Handle command selection from CommandMenu
  const handleCommandSelect = (command: Command) => {
    // Replace @ and filter text with the selected command
    const beforeAt = input.substring(0, atIndex);
    const afterFilter = input.substring(cursorPosition);
    const newInput = beforeAt + command.label + ' ' + afterFilter;
    setInput(newInput);
    setCommandMenuOpen(false);

    // Focus input and move cursor after the command
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeAt.length + command.label.length + 1;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);
  };

  // Update command menu visibility when showMenu changes
  useEffect(() => {
    if (showMenu && inputRef.current) {
      // Calculate menu position
      const rect = inputRef.current.getBoundingClientRect();
      setCommandMenuPosition({
        top: rect.top - 4,
        left: rect.left,
      });
      setCommandMenuOpen(true);
    } else {
      setCommandMenuOpen(false);
    }
  }, [showMenu]);

  const sendMessage = async () => {
    const text = input.trim();
    const hasImages = pendingImages.length > 0;
    const hasPDFs = pendingPDFs.length > 0 && pendingPDFs.every(p => p.status === 'ready');

    // Require either text, images, or PDFs
    if ((!text && !hasImages && !hasPDFs) || isLoading) return;

    // Check if this is a quiz request (only for text-only messages)
    const quizCheck = isQuizRequest(text);

    // Handle invalid @quiz parameters
    if (quizCheck.error === 'quizInvalidParam') {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${t('quiz.error.invalidParam')}`,
      };
      setMessages((prev) => [...prev, userMsg, errorMsg]);
      setInput('');
      return;
    }

    if (quizCheck.isQuiz && !hasImages && !hasPDFs) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      await generateQuiz(quizCheck.count ?? 5);

      setIsLoading(false);
      return;
    }

    // Check if this is a xiaohongshu request (only for text-only messages)
    const xiaohongshuCheck = isXiaohongshuRequest(text);

    if (xiaohongshuCheck.isXiaohongshu && !hasImages && !hasPDFs) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      // Add loading message for xiaohongshu
      const loadingMsg: ChatMessage = {
        id: `assistant-xiaohongshu-${Date.now()}`,
        role: 'assistant',
        content: '',
        xiaohongshuLoading: true,
      };
      setMessages((prev) => [...prev, loadingMsg]);

      // Generate xiaohongshu content
      await generateXiaohongshu(xiaohongshuCheck.topic);

      setIsLoading(false);
      return;
    }

    // Build user message with images and PDFs
    // For PDFs, add info text to the message
    const pdfInfoText = hasPDFs ? pendingPDFs.map(pdf => {
      if (pdf.result?.type === 'markdown') {
        return `\n\n[用户上传的文件: ${pdf.filename} (${pdf.pageCount} 页)]\n以下是用户上传的文件内容：\n${pdf.result.content}`;
      } else if (pdf.result?.type === 'images') {
        return `\n\n[用户上传的文件: ${pdf.filename} (${pdf.pageCount} 页，已转换为 ${pdf.result.content.length} 张图片)]`;
      }
      return '';
    }).join('') : '';

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text + (pdfInfoText && !hasImages ? pdfInfoText : ''),
      images: hasImages ? pendingImages.map(img => ({ id: img.id, dataUrl: img.dataUrl })) : undefined,
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

    // Store images and PDFs for request, then clear pending
    const imagesToSend = [...pendingImages];
    const pdfsToSend = [...pendingPDFs];
    setPendingImages([]);
    setPendingPDFs([]);

    const documentMarkdown = getMarkdown();
    const selectionMarkdown = getSelectionMarkdown?.()?.trim() || undefined;

    // Debug: Log document content
    console.log('[ChatPanel] Sending request with documentMarkdown:', {
      length: documentMarkdown.length,
      preview: documentMarkdown.substring(0, 500),
      selectionLength: selectionMarkdown?.length || 0,
    });

    // Create abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Choose API endpoint based on useAcontext setting
    const apiEndpoint = useAcontext ? '/api/ai/chat-acontext' : '/api/ai/chat-stream';

    // Build contentParts for multimodal message
    // Include images from both direct upload and PDF conversions
    const pdfImages: Array<{ type: 'image_url'; image_url: { url: string } }> = [];
    let pdfTextContent = '';

    if (hasPDFs) {
      for (const pdf of pdfsToSend) {
        if (pdf.result?.type === 'images') {
          // Add PDF page images
          pdfImages.push(...pdf.result.content.map(dataUrl => ({
            type: 'image_url' as const,
            image_url: { url: dataUrl },
          })));
        } else if (pdf.result?.type === 'markdown') {
          // Add text content with clear labeling
          pdfTextContent += `\n\n---\n**[用户上传的文件: ${pdf.filename}]**\n以下是用户上传的文件内容，请注意这不是当前编辑器中的文档内容：\n\n${pdf.result.content}`;
        }
      }
    }

    const hasMultimodalContent = hasImages || hasPDFs;
    // Combine user text with PDF text content
    const fullTextContent = text + (pdfTextContent ? `\n\n${pdfTextContent}` : '');
    const contentParts = hasMultimodalContent ? [
      { type: 'text' as const, text: fullTextContent || '请分析这些内容' },
      ...imagesToSend.map(img => ({
        type: 'image_url' as const,
        image_url: { url: img.dataUrl },
      })),
      ...pdfImages,
    ] : undefined;

    // Build request body based on API type
    const requestBody = useAcontext
      ? {
          content: text,
          contentParts,
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

            // Web search results
            if (data.type === 'web_search_result') {
              console.log('[ChatPanel] 🔍 Web search result received', {
                query: data.query,
                resultsCount: data.results?.length || 0,
              });
              setStreamingSearchResults({
                query: data.query,
                results: data.results || [],
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
          searchResults: streamingSearchResults || undefined,
        },
      ]);
      setStreamingContent('');
      setStreamingToolCalls([]);
      setStreamingSearchResults(null); // Reset search results

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
    <div className={cn('flex flex-col h-full bg-background', className)} data-testid="chat-panel">
      {/* Header - similar to Sidebar header */}
      <div className="flex items-center justify-between py-2 px-4 border-b border-border shrink-0">
        <span className="flex items-center gap-2 font-semibold">
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
      </div>
      {/* Content area */}
      <div className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
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
                {/* User images */}
                {m.role === 'user' && m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {m.images.map(img => (
                      <img
                        key={img.id}
                        src={img.dataUrl}
                        alt="Attached"
                        className="h-20 w-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
                {/* Web search results (for assistant messages) */}
                {m.role === 'assistant' && m.searchResults && m.searchResults.results.length > 0 && (
                  <SearchResultsCard
                    query={m.searchResults.query}
                    results={m.searchResults.results}
                  />
                )}
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
                {/* Quiz loading indicator */}
                {m.role === 'assistant' && m.quizLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在生成测验...</span>
                  </div>
                )}
              </div>
              {/* Quiz container - render outside the message bubble for full width */}
              {m.role === 'assistant' && m.quiz && !m.quizLoading && (
                <div className="w-full mt-2">
                  <QuizContainer
                    quiz={m.quiz}
                    onComplete={(result: QuizResult) => {
                      console.log('[ChatPanel] Quiz completed', result);
                    }}
                  />
                </div>
              )}
              {/* Xiaohongshu loading indicator */}
              {m.role === 'assistant' && m.xiaohongshuLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>正在生成小红书卡片...</span>
                </div>
              )}
              {/* Xiaohongshu card */}
              {m.role === 'assistant' && m.xiaohongshu && !m.xiaohongshuLoading && (
                <div className="w-full mt-2">
                  <XiaohongshuCard
                    data={m.xiaohongshu}
                    onRegenerate={() => {
                      // Re-generate with same topic
                      generateXiaohongshu(m.xiaohongshu?.title);
                    }}
                  />
                </div>
              )}
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
          {isLoading && (streamingContent || streamingToolCalls.length > 0 || streamingSearchResults) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm">
                {/* Streaming search results */}
                {streamingSearchResults && streamingSearchResults.results.length > 0 && (
                  <SearchResultsCard
                    query={streamingSearchResults.query}
                    results={streamingSearchResults.results}
                  />
                )}
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
          {/* Pending PDFs preview */}
          {pendingPDFs.length > 0 && (
            <div className="space-y-2">
              {pendingPDFs.map(pdf => (
                <div key={pdf.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg border">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{pdf.filename}</span>
                      <span className="text-xs text-muted-foreground">({pdf.pageCount} {t('chat.pdf.pages')})</span>
                    </div>
                    {pdf.status === 'parsing' && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('chat.pdf.parsing')}
                      </div>
                    )}
                    {pdf.status === 'error' && (
                      <div className="text-xs text-destructive">{pdf.error}</div>
                    )}
                    {pdf.status === 'ready' && pdf.result && (
                      <div className="text-xs text-muted-foreground">
                        {pdf.result.type === 'markdown'
                          ? `${t('chat.pdf.textExtracted')} (${pdf.result.content.length} ${t('chat.pdf.characters')})`
                          : `${t('chat.pdf.convertedToImages')} (${pdf.result.content.length} ${t('chat.pdf.images')})`
                        }
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removePendingPDF(pdf.id)}
                    className="h-5 w-5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Pending images preview */}
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pendingImages.map(img => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt="Pending"
                    className="h-16 w-16 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removePendingImage(img.id)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
          {/* Hidden file input for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            data-testid="image-upload-input"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleImageSelect(e.target.files)}
          />
          {/* Hidden file input for PDF upload */}
          <input
            type="file"
            data-testid="pdf-upload-input"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handlePDFSelect(e.target.files)}
            id="pdf-upload-input"
          />
          {/* Image upload button */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            data-testid="image-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isLoadingHistory || isRefreshing}
            className="shrink-0"
            title={t('chat.image.upload') || 'Upload image'}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          {/* PDF upload button */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            data-testid="pdf-upload-button"
            onClick={() => document.getElementById('pdf-upload-input')?.click()}
            disabled={isLoading || isLoadingHistory || isRefreshing}
            className="shrink-0"
            title={t('chat.pdf.upload') || 'Upload PDF'}
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            data-testid="chat-input"
            placeholder={
              isLoadingHistory ? t('chat.loadingHistory') :
              isRefreshing ? t('chat.refreshSession') + '...' :
              t('chat.inputPlaceholderShort')
            }
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setCursorPosition(e.target.selectionStart || 0);
            }}
            onSelect={(e) => {
              setCursorPosition((e.target as HTMLInputElement).selectionStart || 0);
            }}
            onKeyDown={(e) => {
              // Don't send if command menu is open
              if (e.key === 'Enter' && !e.shiftKey && !commandMenuOpen) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading || isLoadingHistory || isRefreshing}
            className="flex-1"
          />
          <Button
            size="icon"
            data-testid="chat-send-button"
            onClick={isLoading ? cancelRequest : sendMessage}
            disabled={isLoading || isLoadingHistory || isRefreshing || (!input.trim() && pendingImages.length === 0 && pendingPDFs.length === 0)}
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

        {/* Command Menu */}
        <CommandMenu
          isOpen={commandMenuOpen}
          position={commandMenuPosition}
          filter={commandFilter}
          onSelect={handleCommandSelect}
          onClose={() => setCommandMenuOpen(false)}
        />
      </div>
    </div>
  );
}
