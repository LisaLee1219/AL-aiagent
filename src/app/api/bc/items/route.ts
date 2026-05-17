import { NextRequest, NextResponse } from 'next/server';
import {
  isBCConfigured,
  getItems,
  findItemByNumber,
} from '@/lib/business-central';
import { mockERPProducts } from '@/lib/mock-data';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/bc/items
 * Fetch Business Central Item data
 *
 * Query params:
 * - search: Search keyword
 * - itemNo: Exact lookup by product number
 * - top: Number of results (default 50)
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const itemNo = searchParams.get('itemNo') || undefined;
    const top = parseInt(searchParams.get('top') || '50', 10);

    if (!(await isBCConfigured())) {
      return NextResponse.json({
        success: true,
        source: 'mock',
        data: mockERPProducts.map((p) => ({
          number: p.sku,
          description: p.name,
          type: 'Inventory',
          baseUnitOfMeasure: 'PCS',
          unitPrice: p.listPrice,
          unitCost: p.costPrice,
          profitPercent: p.listPrice > 0 ? ((p.listPrice - p.costPrice) / p.listPrice) * 100 : 0,
          inventoryPostingGroup: p.category,
          blocked: false,
        })),
      });
    }

    // Exact lookup for a single product
    if (itemNo) {
      const item = await findItemByNumber(itemNo);
      return NextResponse.json({
        success: true,
        source: 'business_central',
        data: item ? [item] : [],
      });
    }

    const items = await getItems({ search, top });

    return NextResponse.json({
      success: true,
      source: 'business_central',
      count: items.length,
      data: items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch items';
    console.error('[BC Items API Error]', message);

    return NextResponse.json({
      success: true,
      source: 'mock_fallback',
      error: message,
      data: mockERPProducts.map((p) => ({
        number: p.sku,
        description: p.name,
        type: 'Inventory',
        baseUnitOfMeasure: 'PCS',
        unitPrice: p.listPrice,
        unitCost: p.costPrice,
        profitPercent: p.listPrice > 0 ? ((p.listPrice - p.costPrice) / p.listPrice) * 100 : 0,
        inventoryPostingGroup: p.category,
        blocked: false,
      })),
    });
  }
}
