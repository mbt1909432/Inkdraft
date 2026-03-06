'use client';

import { ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface SearchResultsCardProps {
  query: string;
  results: SearchResult[];
  className?: string;
}

export function SearchResultsCard({ query, results, className }: SearchResultsCardProps) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border border-border bg-muted/30 mb-3', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 text-sm">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">
          已搜索: <span className="text-foreground font-medium">{query}</span>
        </span>
      </div>

      {/* Results */}
      <div className="p-3 space-y-2">
        {results.map((result, index) => (
          <div key={index} className="group">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm hover:bg-accent/50 rounded p-1 -mx-1 transition-colors"
            >
              <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded bg-primary/10 text-primary text-xs font-medium">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-primary truncate">
                    {result.title}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {result.source}
                </div>
                {result.snippet && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {result.snippet}
                  </div>
                )}
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
