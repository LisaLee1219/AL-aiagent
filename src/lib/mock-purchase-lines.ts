import { mockERPProducts } from '@/lib/mock-data';

/** Demo purchase history rows when BC purchase lines are unavailable */
export function mockPurchaseLinesForKeyword(keyword: string) {
  const kw = keyword.toLowerCase();
  const tokens = kw.replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter((t) => t.length > 2);

  return mockERPProducts
    .filter((p) => {
      const hay = `${p.sku} ${p.name} ${p.category}`.toLowerCase();
      return tokens.some((t) => hay.includes(t)) || hay.includes(kw.slice(0, 6));
    })
    .slice(0, 5)
    .map((p, i) => ({
      Document_Type: 'Order',
      Document_No: `PO/DEMO-${2400 + i}`,
      Line_No: 10000 + i,
      No: p.sku,
      Description: p.name,
      Quantity: 100 + i * 50,
      Unit_Cost_LCY: p.costPrice,
      Line_Amount: p.costPrice * (100 + i * 50),
      Buy_from_Vendor_No: 'V0001',
      Buy_from_Vendor_Name: p.category.includes('Fastener')
        ? 'FastenAll Trading Pte Ltd'
        : p.category.includes('Castor')
          ? 'Tente Castors Asia'
          : 'Industrial Valve Solutions',
      Expected_Receipt_Date: '2025-11-15',
    }));
}
