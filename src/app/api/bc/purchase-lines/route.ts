import { NextRequest, NextResponse } from 'next/server';
import { isBCConfigured, getPurchaseDocumentLines } from '@/lib/business-central';
import { mockPurchaseLinesForKeyword } from '@/lib/mock-purchase-lines';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/bc/purchase-lines
 * Purchase document lines (similar-item purchase history)
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const top = parseInt(searchParams.get('top') || '20', 10);

    if (!(await isBCConfigured())) {
      return NextResponse.json({
        success: true,
        source: 'mock',
        data: mockPurchaseLinesForKeyword(search || 'bolt'),
      });
    }

    let filter: string | undefined;
    if (search) {
      const safe = search.replace(/'/g, "''");
      filter = `(contains(No, '${safe}') or contains(Description, '${safe}'))`;
    }

    const lines = await getPurchaseDocumentLines({ top, filter });

    return NextResponse.json({
      success: true,
      source: 'business_central',
      count: lines.length,
      data: lines,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch purchase lines';
    console.error('[BC Purchase Lines API Error]', message);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    return NextResponse.json({
      success: true,
      source: 'mock_fallback',
      error: message,
      data: mockPurchaseLinesForKeyword(search || 'item'),
    });
  }
}
