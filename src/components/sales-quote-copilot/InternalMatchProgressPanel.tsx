'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Brain, CheckCircle2, Loader2, Search } from 'lucide-react';
import type { InternalMatchLiveState } from '@/lib/sales-quote-copilot/internal-match-progress';

interface InternalMatchProgressPanelProps {
  progress: InternalMatchLiveState;
}

function formatThinkingPreview(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const thinkingMatch = trimmed.match(/"thinking"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (thinkingMatch?.[1]) {
    return thinkingMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'AI is composing analysis…';
  }
  return trimmed;
}

export function InternalMatchProgressPanel({ progress }: InternalMatchProgressPanelProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  const lineNo = progress.currentLineIndex + 1;
  const total = Math.max(progress.totalLines, 1);
  const currentStream = progress.currentLineId
    ? (progress.aiStreamByLine[progress.currentLineId] ?? '')
    : '';
  const currentThinking =
    (progress.currentLineId && progress.aiThinkingByLine[progress.currentLineId]) ||
    formatThinkingPreview(currentStream);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [progress.logs.length]);

  useEffect(() => {
    aiEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStream.length, currentThinking]);

  return (
    <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-blue-200/60 dark:border-blue-900/40 bg-blue-100/40 dark:bg-blue-950/30">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Internal Match running
        </span>
        <Badge variant="secondary" className="text-xs font-normal">
          Line {Math.min(lineNo, total)} / {total}
        </Badge>
        {progress.completedLineIds.length > 0 && (
          <Badge variant="outline" className="text-xs font-normal gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {progress.completedLineIds.length} done
          </Badge>
        )}
      </div>

      {progress.currentLineLabel && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-blue-200/40 dark:border-blue-900/30 flex gap-2">
          <Search className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-2">{progress.currentLineLabel}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-blue-200/50 dark:divide-blue-900/40">
        <div className="px-4 py-3 max-h-44 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Steps
          </p>
          <ul className="space-y-1.5 text-xs">
            {progress.logs.length === 0 ? (
              <li className="text-muted-foreground">Starting…</li>
            ) : (
              progress.logs.slice(-12).map((entry, i) => (
                <li key={`${entry.ts}-${i}`} className="flex gap-2 text-foreground/90">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>{entry.message}</span>
                </li>
              ))
            )}
          </ul>
          <div ref={logEndRef} />
        </div>

        <div className="px-4 py-3 max-h-52 overflow-y-auto bg-white/50 dark:bg-background/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
            <Brain className="h-3 w-3" />
            AI analysis
          </p>
          {currentThinking ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
              {currentThinking}
            </p>
          ) : currentStream ? (
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground break-words">
              {currentStream.slice(-1200)}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">Waiting for AI…</p>
          )}
          <div ref={aiEndRef} />
        </div>
      </div>
    </div>
  );
}
