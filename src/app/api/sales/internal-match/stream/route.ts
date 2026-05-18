import { NextRequest } from 'next/server';
import { ensureEnvLoaded } from '@/lib/env-loader';
import {
  buildInternalMatchBundles,
  type InternalMatchInputLine,
} from '@/lib/sales-quote-copilot/internal-match-service';
import type { InternalMatchProgressEvent } from '@/lib/sales-quote-copilot/internal-match-progress';

/**
 * POST /api/sales/internal-match/stream
 * SSE progress + AI thinking deltas while Internal Match runs.
 */
export async function POST(request: NextRequest) {
  await ensureEnvLoaded();

  let body: { items?: InternalMatchInputLine[]; customerName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  if (!body.items?.length) {
    return new Response(JSON.stringify({ error: 'items array is required' }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: InternalMatchProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await buildInternalMatchBundles(body.items!, body.customerName, send);
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal match failed';
        console.error('[Internal Match Stream]', message);
        send({ type: 'error', message });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
