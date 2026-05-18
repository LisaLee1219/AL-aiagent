'use client';

import { AgentMessageContent } from '@/components/agent-message-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WebSearchResponseData } from '@/lib/web-search-types';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flag,
  Globe2,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { useState } from 'react';

function scoreTone(score: number): { badge: string; bar: string } {
  if (score >= 80) {
    return {
      badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 55) {
    return {
      badge: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-400',
      bar: 'bg-amber-500',
    };
  }
  return {
    badge: 'bg-muted text-muted-foreground border-border',
    bar: 'bg-muted-foreground/40',
  };
}

function regionLabel(region: string): string {
  if (region === 'singapore') return 'Singapore';
  if (region === 'sea') return 'SEA';
  return 'Global';
}

interface WebSearchResultsPanelProps {
  data: WebSearchResponseData;
  className?: string;
}

export function WebSearchResultsPanel({ data, className }: WebSearchResultsPanelProps) {
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const sgCount = data.searchResults.filter((r) => r.region === 'singapore').length;

  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-b from-muted/30 to-background overflow-hidden',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">Web research</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Singapore first · {data.totalResults} hit{data.totalResults !== 1 ? 's' : ''}
              {sgCount > 0 && ` · ${sgCount} SG`}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal gap-1">
          <Flag className="h-3 w-3" />
          SG priority
        </Badge>
      </div>

      {data.searchResults.length > 0 && (
        <ol className="divide-y max-h-[min(420px,55vh)] overflow-y-auto">
          {data.searchResults.map((item, idx) => {
            const tone = scoreTone(item.matchScore);
            return (
              <li
                key={`${item.url}-${idx}`}
                className="group px-4 py-3 hover:bg-muted/25 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start gap-2 justify-between">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium leading-snug text-foreground hover:text-primary line-clamp-2 pr-2"
                      >
                        {item.title || item.source}
                      </a>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] tabular-nums font-medium', tone.badge)}
                        >
                          {item.matchScore}%
                        </Badge>
                        {item.region === 'singapore' && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-0.5 bg-sky-500/10 text-sky-800 border-sky-500/20 dark:text-sky-300"
                          >
                            <Flag className="h-2.5 w-2.5" />
                            SG
                          </Badge>
                        )}
                        {item.isSupplierResult && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Supplier
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="h-1 w-full max-w-[140px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', tone.bar)}
                        style={{ width: `${Math.min(100, item.matchScore)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.snippet}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate max-w-[12rem]">{item.source}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{regionLabel(item.region)}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="italic line-clamp-1">{item.matchReason}</span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] opacity-0 group-hover:opacity-100 focus:opacity-100"
                      asChild
                    >
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open source
                      </a>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {data.searchResults.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          <TrendingDown className="h-5 w-5 opacity-50" />
          No ranked results. Try a more specific product description.
        </div>
      )}

      {data.aiAnalysis && (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setAnalysisOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI summary (Singapore focus)
            </span>
            {analysisOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {analysisOpen && (
            <div className="px-4 pb-4 max-h-56 overflow-y-auto text-sm">
              <AgentMessageContent content={data.aiAnalysis} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}