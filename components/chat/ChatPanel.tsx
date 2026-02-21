'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Send, MessageSquare, X, Check, Ban, StopCircle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyEditTool } from '@/lib/editor/apply-edit-tools';
import { sanitizeHtml } from '@/lib/chat/sanitize-html';

const TRUNCATE_LEN = 120;

/** Renders message content as Markdown (prose styles for headings, lists, etc.) */
function ChatMessageContent({
  content,
  placeholder,
  className,
}: {
  content: string;
  placeholder?: string;
  className?: string;
}) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    if (!content?.trim()) {
      setHtml('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const out = await marked.parse(content);
        if (!cancelled) setHtml(sanitizeHtml(typeof out === 'string' ? out : ''));
      } catch {
        if (!cancelled) setHtml('');
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (!content?.trim() && placeholder) {
    return <span className={className}>{placeholder}</span>;
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

function truncate(s: string, max = TRUNCATE_LEN): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function ToolCallBlock({
  tool,
  pending,
  messageId,
  toolIndex,
  onChoice,
}: {
  tool: ToolCallDisplay;
  pending?: boolean;
  messageId?: string;
  toolIndex?: number;
  onChoice?: (messageId: string, toolIndex: number, choice: 'apply' | 'decline') => void;
}) {
  const { name, arguments: args, applied, userChoice } = tool;
  const nameLabel = name === 'search_replace' ? 'search_replace（替换）' : name === 'insert_after' ? 'insert_after（插入）' : name;
  const statusLabel = pending
    ? userChoice === 'apply'
      ? '已选应用'
      : userChoice === 'decline'
        ? '已选不应用'
        : '可应用'
    : applied
      ? '已应用'
      : userChoice === 'decline'
        ? '未应用'
        : '未匹配';
  const statusColor =
    userChoice === 'apply' || (applied && !pending)
      ? 'text-green-600 dark:text-green-400'
      : userChoice === 'decline' || (!applied && !pending)
        ? 'text-muted-foreground'
        : 'text-amber-600 dark:text-amber-400';
  const canClick = pending && messageId != null && toolIndex != null && onChoice;

  return (
    <div className="text-xs rounded bg-background/60 p-2 space-y-1">
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
              应用
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1.5"
              onClick={() => onChoice(messageId, toolIndex, 'decline')}
            >
              不应用
            </Button>
          </span>
        )}
      </p>
      {name === 'search_replace' && (
        <>
          <p className="text-muted-foreground">
            <span className="font-medium">old_string:</span>{' '}
            {truncate(String(args.old_string ?? ''))}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium">new_string:</span>{' '}
            {truncate(String(args.new_string ?? ''))}
          </p>
        </>
      )}
      {name === 'insert_after' && (
        <>
          <p className="text-muted-foreground">
            <span className="font-medium">after_string:</span>{' '}
            {truncate(String(args.after_string ?? ''))}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium">content:</span>{' '}
            {truncate(String(args.content ?? ''))}
          </p>
        </>
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
  className?: string;
  onClose?: () => void;
}

export function ChatPanel({
  getMarkdown,
  setMarkdown,
  getSelectionMarkdown,
  documentId,
  useAcontext = false,
  className,
  onClose,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<Array<{ name: string; arguments: string }>>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
          setMessages(
            data.messages.map((m: { role: string; content: string; id?: string }, idx: number) => ({
              id: m.id || `loaded-${idx}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          );
          console.log('[ChatPanel] Loaded', data.messages.length, 'messages from Acontext');
        }
      } catch (error) {
        console.error('[ChatPanel] Error loading history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [useAcontext, documentId]);

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

  const applyPendingEdit = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.pendingApply || !msg.toolCalls?.length) return;
    const base = msg.initialMarkdown ?? msg.pendingNewMarkdown ?? getMarkdown();
    let currentMarkdown = base;
    const appliedPerTool: boolean[] = [];
    for (let i = 0; i < msg.toolCalls.length; i++) {
      const tc = msg.toolCalls[i];
      if (tc.userChoice !== 'apply') {
        appliedPerTool.push(false);
        continue;
      }
      const result = applyEditTool(currentMarkdown, tc.name, tc.arguments);
      appliedPerTool.push(result.applied);
      if (result.applied) currentMarkdown = result.newMarkdown;
    }
    setMarkdown(currentMarkdown);
    const appliedCount = appliedPerTool.filter(Boolean).length;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const toolCalls = (m.toolCalls ?? []).map((t, i) => ({
          ...t,
          applied: appliedPerTool[i] ?? t.applied,
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
      }> = [];
      let finalDoc: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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

            if (data.type === 'content') {
              finalContent += data.content;
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
      const toolCallsDisplay: ToolCallDisplay[] = finalToolCalls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
        applied: tc.applied,
        userChoice: 'apply' as const,
      }));

      const appliedCount = toolCallsDisplay.filter((t) => t.applied).length;
      const hasPendingEdits = toolCallsDisplay.length > 0 && appliedCount > 0;
      const assistantId = `assistant-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: finalContent,
          appliedEdits: hasPendingEdits ? undefined : (appliedCount > 0 ? appliedCount : undefined),
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
            content: '（已取消）',
          },
        ]);
      } else {
        const message = err instanceof Error ? err.message : String(err);
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
          AI 编辑助手
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
              加载历史...
            </span>
          )}
          {useAcontext && messages.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <History className="h-3 w-3" />
              {messages.length} 条
            </span>
          )}
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
              输入指令修改文档，例如：「把第二段改得更正式」「在 2.1 下面加一条：注意时间管理」
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
                        ? '（仅执行了工具调用，无额外说明）'
                        : undefined
                    }
                  />
                )}
                {/* 工具调用详情 */}
                {m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">工具调用</p>
                    {m.toolCalls.map((tc, i) => (
                      <ToolCallBlock
                        key={i}
                        tool={tc}
                        pending={m.pendingApply}
                        messageId={m.id}
                        toolIndex={i}
                        onChoice={setToolChoice}
                      />
                    ))}
                  </div>
                )}
                {/* 待确认：勾选后点「确认应用」或「取消」 */}
                {m.role === 'assistant' && m.pendingApply && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      对每条编辑选择「应用」或「不应用」，然后：
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => applyPendingEdit(m.id)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      确认应用
                      {(m.toolCalls?.filter((t) => t.userChoice === 'apply').length ?? 0) > 0 &&
                        ` (${m.toolCalls!.filter((t) => t.userChoice === 'apply').length} 处)`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => declinePendingEdit(m.id)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      取消
                    </Button>
                  </div>
                )}
                {m.role === 'assistant' && m.appliedEdits != null && m.appliedEdits > 0 && !m.pendingApply && (
                  <p className="text-xs mt-1.5 text-green-600 dark:text-green-400">
                    已应用 {m.appliedEdits} 处编辑
                  </p>
                )}
                {m.role === 'assistant' && m.editDeclined && (
                  <p className="text-xs mt-1.5 text-muted-foreground">已取消，未写入文档</p>
                )}
                {m.role === 'assistant' && m.editError && (
                  <p className="text-xs mt-1.5 text-destructive">{m.editError}</p>
                )}
              </div>
            </div>
          ))}
          {/* Streaming content / Loading indicator */}
          {isLoading && (streamingContent || streamingToolCalls.length > 0) && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-sm">
                {streamingContent && (
                  <ChatMessageContent content={streamingContent} />
                )}
                {streamingToolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      正在执行 {streamingToolCalls.length} 个编辑操作…
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
                思考中…
              </div>
            </div>
          )}
        </div>
        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="输入指令…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={isLoading ? cancelRequest : sendMessage}
            disabled={!isLoading && !input.trim()}
            variant={isLoading ? 'destructive' : 'default'}
            className="shrink-0"
            title={isLoading ? '取消' : '发送'}
          >
            {isLoading ? (
              <StopCircle className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
