import { NextRequest, NextResponse } from 'next/server';
import {
  isBCConfigured,
  getSalesOrders,
  getSalesLines,
} from '@/lib/business-central';
import { mockHistoricalOrders } from '@/lib/mock-data';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/bc/sales-orders
 * Fetch Business Central Sales Order data
 *
 * Query params:
 * - customerNo: Filter by customer number
 * - status: Filter by status (Draft, Released)
 * - salesperson: Filter by salesperson
 * - top: Number of results (default 30)
 * - withLines: Whether to include order lines (default true)
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const { searchParams } = new URL(request.url);
    const customerNo = searchParams.get('customerNo') || undefined;
    const status = searchParams.get('status') || undefined;
    const salesperson = searchParams.get('salesperson') || undefined;
    const top = parseInt(searchParams.get('top') || '30', 10);
    const withLines = searchParams.get('withLines') !== 'false';

    if (!(await isBCConfigured())) {
      return NextResponse.json({
        success: true,
        source: 'mock',
        data: mockHistoricalOrders.map((o) => ({
          No: o.orderId,
          Sell_to_Customer_No: o.customer,
          Sell_to_Customer_Name: o.customer,
          Order_Date: o.date,
          Status: o.status === 'completed' ? 'Released' : 'Open',
          Currency_Code: 'SGD',
          Payment_Terms_Code: '30 DAYS',
          Salesperson_Code: '',
          lines: [],
        })),
      });
    }

    const orders = await getSalesOrders({
      customerNo,
      status,
      salesperson,
      top,
    });

    // If line data is needed, fetch per order (BC OData does not support complex OR filters)
    let ordersWithLines = orders;
    if (withLines && orders.length > 0) {
      // Limit to first 10 orders for lines to avoid too many requests
      const topOrders = orders.slice(0, 10);

      const ordersWithLinesArr = await Promise.all(
        topOrders.map(async (order) => {
          try {
            const lines = await getSalesLines({
              documentNo: order.No,
              top: 100,
            });
            return { ...order, lines };
          } catch {
            return { ...order, lines: [] };
          }
        })
      );

      // Merge: first 10 with lines + remaining orders without lines
      ordersWithLines = [
        ...ordersWithLinesArr,
        ...orders.slice(10).map((o) => ({ ...o, lines: [] })),
      ];
    }

    return NextResponse.json({
      success: true,
      source: 'business_central',
      count: ordersWithLines.length,
      data: ordersWithLines,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sales orders';
    console.error('[BC Sales Orders API Error]', message);

    return NextResponse.json({
      success: true,
      source: 'mock_fallback',
      error: message,
      data: mockHistoricalOrders.map((o) => ({
        No: o.orderId,
        Sell_to_Customer_No: o.customer,
        Sell_to_Customer_Name: o.customer,
        Order_Date: o.date,
        Status: o.status === 'completed' ? 'Released' : 'Open',
        Currency_Code: 'SGD',
        lines: [],
      })),
    });
  }
}
