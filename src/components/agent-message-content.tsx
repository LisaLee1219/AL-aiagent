'use client';

import { useMemo } from 'react';

function parseTableLines(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter((l) => l.trim().startsWith('|'));
  if (tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headers = parseRow(tableLines[0]);
  const sep = tableLines[1];
  if (!sep.includes('---') && !sep.includes(':--')) return null;

  const rows = tableLines.slice(2).map(parseRow).filter((r) => r.some(Boolean));
  if (headers.length < 2 || rows.length === 0) return null;
  return { headers, rows };
}

function formatCell(text: string): React.ReactNode {
  const trimmed = text.trim();
  if (/^\*\*.+\*\*$/.test(trimmed)) {
    return <strong className="font-medium text-foreground">{trimmed.slice(2, -2)}</strong>;
  }
  return <span className="tabular-nums">{trimmed}</span>;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-medium text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const revenueCol = headers.findIndex((h) => /revenue|amount|total|sales/i.test(h));

  return (
    <div className="my-3 overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${
                    i === revenueCol ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border/60 last:border-0">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 text-foreground/90 ${
                      ci === revenueCol ? 'text-right' : ''
                    } ${ci === 0 ? 'font-medium' : ''}`}
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-1.5 border-t text-[10px] text-muted-foreground bg-muted/30">
        Source: Business Central
      </p>
    </div>
  );
}

function ObservationList({ items }: { items: string[] }) {
  return (
    <div className="my-3 rounded-md border bg-muted/30 px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">Observations</p>
      <ul className="space-y-2 text-sm text-foreground/90">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="text-muted-foreground shrink-0">–</span>
            <span>
              <InlineText text={item.replace(/^[-*]\s*/, '')} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderBlock(block: string, index: number): React.ReactNode {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  const table = parseTableLines(lines);
  if (table) {
    const firstTableIdx = lines.findIndex((l) => l.trim().startsWith('|'));
    let lastTableIdx = firstTableIdx;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('|')) {
        lastTableIdx = i;
        break;
      }
    }
    const before = lines.slice(0, firstTableIdx).join('\n').trim();
    const after = lines.slice(lastTableIdx + 1).join('\n').trim();

    return (
      <div key={index}>
        {before && (
          <p className="mb-2 leading-relaxed text-foreground/90">
            <InlineText text={before} />
          </p>
        )}
        <DataTable headers={table.headers} rows={table.rows} />
        {after ? renderBlock(after, index + 1000) : null}
      </div>
    );
  }

  const obsHeader = trimmed.match(/\*\*Key observations:?\*\*/i);
  if (obsHeader) {
    const parts = trimmed.split(/\*\*Key observations:?\*\*/i);
    const intro = parts[0]?.trim();
    const rest = parts[1]?.trim() ?? '';
    const bullets = rest
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-') || l.startsWith('*'));

    if (bullets.length > 0) {
      return (
        <div key={index}>
          {intro && (
            <p className="mb-2 leading-relaxed text-foreground/90">
              <InlineText text={intro} />
            </p>
          )}
          <ObservationList items={bullets} />
        </div>
      );
    }
  }

  if (/^[-*]\s/m.test(trimmed)) {
    const items = trimmed.split('\n').filter((l) => /^[-*]\s/.test(l.trim()));
    if (items.length > 0) {
      const intro = trimmed
        .split('\n')
        .filter((l) => !/^[-*]\s/.test(l.trim()))
        .join('\n')
        .trim();
      return (
        <div key={index}>
          {intro && (
            <p className="mb-2 leading-relaxed text-foreground/90">
              <InlineText text={intro} />
            </p>
          )}
          <ul className="my-2 space-y-1.5 text-sm text-foreground/90">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="text-muted-foreground">–</span>
                <InlineText text={item.replace(/^[-*]\s*/, '')} />
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  if (trimmed.startsWith('### ')) {
    return (
      <h4 key={index} className="mt-3 mb-1 text-sm font-medium text-foreground">
        {trimmed.slice(4)}
      </h4>
    );
  }

  return (
    <p key={index} className="my-1.5 leading-relaxed text-foreground/90">
      <InlineText text={trimmed} />
    </p>
  );
}

interface AgentMessageContentProps {
  content: string;
  isStreaming?: boolean;
}

export function AgentMessageContent({ content, isStreaming }: AgentMessageContentProps) {
  const blocks = useMemo(() => content.split(/\n\n+/).filter(Boolean), [content]);

  if (!content.trim()) return null;

  return (
    <div className="min-w-0 text-sm">
      {blocks.map((block, i) => renderBlock(block, i))}
      {isStreaming && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-muted-foreground/50 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
