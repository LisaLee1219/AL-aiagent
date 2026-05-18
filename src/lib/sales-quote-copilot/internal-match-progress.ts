import type { InternalMatchBundle } from './internal-match-types';

export type InternalMatchProgressEvent =
  | { type: 'start'; total: number; customerName?: string }
  | { type: 'line_start'; lineIndex: number; lineId: string; label: string }
  | { type: 'log'; lineId?: string; message: string }
  | {
      type: 'bc_result';
      lineId: string;
      items: number;
      sales: number;
      purchases: number;
      evidenceCount: number;
    }
  | { type: 'ai_delta'; lineId: string; text: string }
  | { type: 'ai_done'; lineId: string; thinking: string }
  | { type: 'line_done'; lineIndex: number; bundle: InternalMatchBundle }
  | { type: 'complete'; bundles: InternalMatchBundle[] }
  | { type: 'error'; message: string };

export interface InternalMatchLogEntry {
  lineId?: string;
  message: string;
  ts: number;
}

export interface InternalMatchLiveState {
  totalLines: number;
  currentLineIndex: number;
  currentLineId?: string;
  currentLineLabel?: string;
  logs: InternalMatchLogEntry[];
  aiStreamByLine: Record<string, string>;
  aiThinkingByLine: Record<string, string>;
  completedLineIds: string[];
}

export function createInternalMatchLiveState(totalLines: number): InternalMatchLiveState {
  return {
    totalLines,
    currentLineIndex: 0,
    logs: [],
    aiStreamByLine: {},
    aiThinkingByLine: {},
    completedLineIds: [],
  };
}

export function applyInternalMatchProgressEvent(
  prev: InternalMatchLiveState,
  event: InternalMatchProgressEvent,
): InternalMatchLiveState {
  switch (event.type) {
    case 'start':
      return { ...prev, totalLines: event.total };
    case 'line_start':
      return {
        ...prev,
        currentLineIndex: event.lineIndex,
        currentLineId: event.lineId,
        currentLineLabel: event.label,
        aiStreamByLine: { ...prev.aiStreamByLine, [event.lineId]: '' },
      };
    case 'log':
      return {
        ...prev,
        logs: [
          ...prev.logs,
          { lineId: event.lineId, message: event.message, ts: Date.now() },
        ],
      };
    case 'ai_delta': {
      const prior = prev.aiStreamByLine[event.lineId] ?? '';
      return {
        ...prev,
        aiStreamByLine: {
          ...prev.aiStreamByLine,
          [event.lineId]: prior + event.text,
        },
      };
    }
    case 'ai_done':
      return {
        ...prev,
        aiThinkingByLine: {
          ...prev.aiThinkingByLine,
          [event.lineId]: event.thinking,
        },
      };
    case 'line_done':
      return {
        ...prev,
        completedLineIds: prev.completedLineIds.includes(event.bundle.lineId)
          ? prev.completedLineIds
          : [...prev.completedLineIds, event.bundle.lineId],
      };
    default:
      return prev;
  }
}

export async function consumeInternalMatchStream(
  response: Response,
  onEvent: (event: InternalMatchProgressEvent) => void,
): Promise<void> {
  if (!response.ok) {
    throw new Error(await response.text().catch(() => 'Internal Match stream failed'));
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Internal Match stream returned no body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          onEvent(JSON.parse(data) as InternalMatchProgressEvent);
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}
