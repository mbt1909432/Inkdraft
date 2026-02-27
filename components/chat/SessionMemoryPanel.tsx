'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Brain,
  Wrench,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import { useTranslations } from '@/contexts/LocaleContext';

interface SessionDebugData {
  session: {
    id: string;
    acontextSessionId: string;
    acontextDiskId: string;
    title?: string;
    createdAt: string;
  } | null;
  systemPrompt: {
    template: string;
    current: string;
    documentLength: number;
    hasSelection: boolean;
  };
  tools: {
    edit: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
    sandbox: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  };
  messages: Array<{
    index: number;
    role: string;
    contentLength: number;
    contentPreview: string;
    hasToolCalls: boolean;
    toolCallsCount: number;
    toolCalls?: Array<{
      name: string;
      argumentsLength: number;
    }>;
  }>;
  stats: {
    messageCount: number;
    tokenCount: number;
    userMessages: number;
    assistantMessages: number;
    toolMessages: number;
  };
}

interface SessionMemoryPanelProps {
  documentId?: string;
  documentMarkdown?: string;
  selectionMarkdown?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function JsonView({ data, title }: { data: unknown; title: string }) {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium cursor-pointer hover:text-primary w-full">
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
        <CopyButton text={jsonStr} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap break-all">
          {jsonStr}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SessionMemoryPanel({
  documentId,
  documentMarkdown = '',
  selectionMarkdown,
}: SessionMemoryPanelProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SessionDebugData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        documentId,
        documentMarkdown,
      });
      if (selectionMarkdown) {
        params.set('selectionMarkdown', selectionMarkdown);
      }

      const res = await fetch(`/api/ai/session-debug?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const debugData = await res.json();
      setData(debugData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debug data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && documentId) {
      fetchDebugData();
    }
  }, [open, documentId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Session Memory">
          <Database className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Session Memory Debug
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading...
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm p-4 bg-destructive/10 rounded">
            Error: {error}
          </div>
        )}

        {data && !loading && (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Stats Overview */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="p-2 bg-muted rounded">
                      <div className="text-lg font-bold">{data.stats.messageCount}</div>
                      <div className="text-xs text-muted-foreground">Messages</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-lg font-bold">{Math.round(data.stats.tokenCount / 1000)}K</div>
                      <div className="text-xs text-muted-foreground">Tokens</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-blue-600">{data.stats.userMessages}</div>
                      <div className="text-xs text-muted-foreground">User</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-green-600">{data.stats.assistantMessages}</div>
                      <div className="text-xs text-muted-foreground">Assistant</div>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <div className="text-lg font-bold text-orange-600">{data.stats.toolMessages}</div>
                      <div className="text-xs text-muted-foreground">Tool</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Info */}
              {data.session && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Session Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 space-y-1 text-xs font-mono">
                    <div><span className="text-muted-foreground">ID:</span> {data.session.id}</div>
                    <div><span className="text-muted-foreground">Acontext Session:</span> {data.session.acontextSessionId}</div>
                    <div><span className="text-muted-foreground">Acontext Disk:</span> {data.session.acontextDiskId}</div>
                    <div><span className="text-muted-foreground">Created:</span> {new Date(data.session.createdAt).toLocaleString()}</div>
                  </CardContent>
                </Card>
              )}

              {/* System Prompt */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    System Prompt
                    <Badge variant="outline" className="ml-auto">
                      Doc: {data.systemPrompt.documentLength} chars
                      {data.systemPrompt.hasSelection && ' + selection'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer hover:text-primary">
                      <ChevronRight className="h-4 w-4" />
                      View Full System Prompt
                      <CopyButton text={data.systemPrompt.current} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap break-words">
                        {data.systemPrompt.current}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Tools */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Available Tools
                    <Badge variant="outline" className="ml-auto">
                      {data.tools.edit.length + data.tools.sandbox.length} tools
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Edit Tools</div>
                    {data.tools.edit.map((tool) => (
                      <JsonView key={tool.name} data={tool} title={tool.name} />
                    ))}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Sandbox Tools</div>
                    {data.tools.sandbox.map((tool) => (
                      <JsonView key={tool.name} data={tool} title={tool.name} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Message History */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Message History
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="space-y-1 max-h-60 overflow-auto">
                    {data.messages.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No messages yet</div>
                    ) : (
                      data.messages.map((msg) => (
                        <div
                          key={msg.index}
                          className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs"
                        >
                          <Badge
                            variant={
                              msg.role === 'user' ? 'default' :
                              msg.role === 'assistant' ? 'secondary' :
                              'outline'
                            }
                            className="text-[10px] px-1"
                          >
                            {msg.role}
                          </Badge>
                          <span className="text-muted-foreground">
                            {msg.contentLength} chars
                          </span>
                          {msg.hasToolCalls && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              {msg.toolCallsCount} tools
                            </Badge>
                          )}
                          <span className="truncate flex-1 text-muted-foreground">
                            {msg.contentPreview || '(empty)'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
