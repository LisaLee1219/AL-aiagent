import { NextRequest, NextResponse } from 'next/server';
import {
  isBCConfigured,
  getSalesLines,
  getSalesDocumentLines,
} from '@/lib/business-central';
import { mockERPProducts } from '@/lib/mock-data';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/bc/sales-lines
 * Fetch Business Central Sales Line data
 *
 * Query params:
 * - documentNo: Filter by order number
 * - itemNo: Filter by product number
 * - source: "order" (SalesOrderSalesLines) | "document" (salesDocumentLines)
 * - top: Number of results (default 50)
 * - search: Search keyword (Match product number or description)
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const { searchParams } = new URL(request.url);
    const documentNo = searchParams.get('documentNo') || undefined;
    const itemNo = searchParams.get('itemNo') || undefined;
    const source = searchParams.get('source') || 'order';
    const top = parseInt(searchParams.get('top') || '50', 10);
    const search = searchParams.get('search') || undefined;

    if (!(await isBCConfigured())) {
      // Fallback to mock data
      return NextResponse.json({
        success: true,
        source: 'mock',
        data: mockERPProducts.map((p) => ({
          Document_No: p.id,
          Document_Type: 'Order',
          Line_No: 10000,
          Type: 'Item',
          No: p.sku,
          Description: p.name,
          Quantity: p.stock,
          Unit_of_Measure_Code: 'PCS',
          Unit_Cost_LCY: p.costPrice,
          Unit_Price: p.listPrice,
          Line_Amount: p.listPrice * p.stock,
          Line_Discount_Percent: 0,
          Item_Category_Code: p.category,
          Location_Code: 'MAIN',
          Shipment_Date: new Date().toISOString().split('T')[0],
        })),
      });
    }

    let filter: string | undefined;
    if (search) {
      filter = `(contains(No, '${search}') or contains(Description, '${search}'))`;
    }

    const fetchFn = source === 'document' ? getSalesDocumentLines : getSalesLines;
    const lines = await fetchFn({
      documentNo,
      itemNo,
      top,
      filter,
    });

    return NextResponse.json({
      success: true,
      source: 'business_central',
      count: lines.length,
      data: lines,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sales lines';
    console.error('[BC Sales Lines API Error]', message);

    // Fallback to mock when BC call fails
    return NextResponse.json({
      success: true,
      source: 'mock_fallback',
      error: message,
      data: mockERPProducts.map((p) => ({
        Document_No: p.id,
        Document_Type: 'Order',
        Line_No: 10000,
        Type: 'Item',
        No: p.sku,
        Description: p.name,
        Quantity: p.stock,
        Unit_of_Measure_Code: 'PCS',
        Unit_Cost_LCY: p.costPrice,
        Unit_Price: p.listPrice,
        Line_Amount: p.listPrice * p.stock,
        Line_Discount_Percent: 0,
        Item_Category_Code: p.category,
        Location_Code: 'MAIN',
        Shipment_Date: new Date().toISOString().split('T')[0],
      })),
    });
  }
}
