import { NextRequest, NextResponse } from 'next/server';
import { isBCConfigured, getSalesOrders } from '@/lib/business-central';
import { mockHistoricalOrders } from '@/lib/mock-data';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/erp/orders
 * Query historical orders
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  const searchParams = request.nextUrl.searchParams;
  const customer = searchParams.get('customer') || '';

  if ((await isBCConfigured())) {
    try {
      const orders = await getSalesOrders({
        search: customer || undefined,
        top: 20,
      });

      const results = orders.map((order) => ({
        id: order.No,
        orderId: order.No,
        customer: order.Sell_to_Customer_Name,
        customerNo: order.Sell_to_Customer_No,
        product: '',
        quantity: 0,
        unitPrice: 0,
        totalPrice: 0,
        date: order.Order_Date?.split('T')[0] || '',
        status: order.Status,
        currency: order.Currency_Code || 'SGD',
        salesperson: order.Shortcut_Dimension_2_Code,
        paymentTerms: order.Payment_Terms_Code,
      }));

      return NextResponse.json({
        success: true,
        data: results,
        total: results.length,
        source: 'business_central',
      });
    } catch (error) {
      console.error('Business Central orders API error, falling back to mock:', error);
    }
  }

  // Mock fallback
  let results = mockHistoricalOrders;
  if (customer) {
    const kw = customer.toLowerCase();
    results = results.filter((o) => o.customer.toLowerCase().includes(kw));
  }

  return NextResponse.json({
    success: true,
    data: results,
    total: results.length,
    source: 'mock',
  });
}
