import { NextRequest, NextResponse } from 'next/server';
import { ensureEnvLoaded } from '@/lib/env-loader';
import {
  buildInternalMatchBundles,
  type InternalMatchInputLine,
} from '@/lib/sales-quote-copilot/internal-match-service';

/**
 * POST /api/sales/internal-match
 * Aggregate BC item master, sales lines, purchase lines, and AI best match per RFQ line.
 */
export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const body = (await request.json()) as {
      items?: InternalMatchInputLine[];
      customerName?: string;
    };

    if (!body.items?.length) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const bundles = await buildInternalMatchBundles(body.items, body.customerName);

    return NextResponse.json({
      success: true,
      data: bundles,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal match failed';
    console.error('[Internal Match API]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
