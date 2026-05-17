import type { MatchCandidate, SupplierProfile } from './types';

export const DEMO_SUPPLIERS: SupplierProfile[] = [
  {
    id: 'sup-1',
    name: 'FastenAll Trading Pte Ltd',
    categories: ['Fasteners', 'Bolts', 'Nuts', 'Washers'],
    brands: ['Unbrako', 'Generic'],
    contact_person: 'Mr. Tan',
    email: 'sales@fastenall.sg',
    whatsapp: '+65 9123 4567',
    typical_lead_time: '3–5 days',
    moq: '100 pcs / line',
    payment_terms: 'Net 30',
    reliability_score: 92,
    price_level: 'mid',
    last_quote: 'Bolt M16 G8.8 — SGD 0.85/pc (Jan 2025)',
    notes: 'Strong for standard metric fasteners.',
  },
  {
    id: 'sup-2',
    name: 'Tente Castors Asia',
    categories: ['Castors', 'Wheels', 'Material Handling'],
    brands: ['Tente'],
    contact_person: 'Ms. Lim',
    email: 'quotes@tente-asia.com',
    whatsapp: '+65 9876 5432',
    typical_lead_time: '10–14 days',
    moq: '4 pcs',
    payment_terms: '50% deposit',
    reliability_score: 88,
    price_level: 'high',
    last_quote: 'Flat wheel 4" — POA, datasheet required',
    notes: 'Preferred for castors; needs full wheel spec.',
  },
  {
    id: 'sup-3',
    name: 'Industrial Valve Solutions',
    categories: ['Valves', 'Pressure instruments'],
    brands: ['Kitz', 'Honeywell'],
    contact_person: 'David Wong',
    email: 'rfq@ivs.com.sg',
    typical_lead_time: '7–10 days',
    moq: '1 pc',
    payment_terms: 'Net 45',
    reliability_score: 85,
    price_level: 'mid',
    notes: 'Butterfly valves and pressure switches.',
  },
];

export function recommendSuppliers(productType: string): SupplierProfile[] {
  const t = productType.toLowerCase();
  if (t.includes('wheel') || t.includes('castor')) {
    return DEMO_SUPPLIERS.filter((s) => s.id === 'sup-2' || s.id === 'sup-1');
  }
  if (t.includes('valve') || t.includes('pressure')) {
    return DEMO_SUPPLIERS.filter((s) => s.id === 'sup-3');
  }
  return DEMO_SUPPLIERS.filter((s) => s.categories.some((c) => t.includes(c.toLowerCase()) || c.toLowerCase().includes('fastener')));
}

/** Enrich ERP matches with past sales/quotes and intentional bad match demo */
export function buildMatchCandidates(
  itemId: string,
  keyword: string,
  erpMatches: Array<{
    id: string;
    sku: string;
    name: string;
    category: string;
    costPrice: number;
    listPrice: number;
    stock: number;
    leadTime: string;
    relevanceScore: number;
    relevanceReason: string;
  }>,
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const kw = keyword.toLowerCase();

  erpMatches.forEach((p, i) => {
    const score = p.relevanceScore;
    const risks: string[] = [];
    if (p.costPrice === 0) risks.push('Cost is zero — verify before quoting');
    if (p.stock === 0) risks.push('No stock on hand');
    if (score < 70) risks.push('Low confidence — requires human verification');

    if (kw.includes('m16') && kw.includes('100') && p.name.toLowerCase().includes('m10')) {
      risks.push('Size mismatch: requested M16 x 100mm but matched M10 x 40mm');
    }

    candidates.push({
      id: `mc-${itemId}-erp-${i}`,
      requested_item_id: itemId,
      source_type: 'item_master',
      item_no: p.sku,
      description: p.name,
      matched_specs: [p.category],
      missing_specs: score < 70 ? ['Verify size/grade with customer'] : [],
      available_stock: p.stock,
      last_sold_price: p.listPrice * 0.95,
      last_sold_date: '2024-11-12',
      cost: p.costPrice,
      suggested_selling_price: p.listPrice,
      confidence_score: score,
      confidence_reason: p.relevanceReason,
      risk_flags: risks,
      selected: score >= 70,
      verified: score >= 90,
    });
  });

  if (kw.includes('m16') && kw.includes('bolt')) {
    candidates.push({
      id: `mc-${itemId}-bad`,
      requested_item_id: itemId,
      source_type: 'item_master',
      item_no: 'FAKE-M10-40',
      description: 'H/T G8.8 M10 x 40mm Bolt & Nut',
      matched_specs: ['Fasteners'],
      missing_specs: ['M16 length', 'Grade confirmation'],
      available_stock: 120,
      cost: 0.35,
      suggested_selling_price: 0.55,
      confidence_score: 28,
      confidence_reason: 'Keyword overlap only — wrong bolt size',
      risk_flags: ['Size mismatch: requested M16 x 100mm but matched M10 x 40mm', 'Low confidence — requires human verification'],
      selected: false,
      verified: false,
    });
  }

  if (candidates.length > 0 && !candidates.some((c) => c.source_type === 'past_sales')) {
    const best = candidates[0];
    candidates.push({
      id: `mc-${itemId}-ps`,
      requested_item_id: itemId,
      source_type: 'past_sales',
      item_no: best.item_no,
      description: best.description,
      matched_specs: ['Historical pattern'],
      missing_specs: [],
      available_stock: 0,
      last_sold_price: (best.last_sold_price || best.suggested_selling_price) * 0.98,
      last_sold_date: '2025-01-08',
      customer_name: 'Client A Construction Pte Ltd',
      cost: best.cost,
      suggested_selling_price: best.suggested_selling_price,
      confidence_score: Math.min(best.confidence_score + 5, 95),
      confidence_reason: 'Sold to similar customer in last 90 days',
      risk_flags: best.confidence_score < 70 ? ['Low confidence — requires human verification'] : [],
      selected: false,
      verified: false,
    });
  }

  return candidates.sort((a, b) => b.confidence_score - a.confidence_score);
}

export function buildSupplierRfqDraft(
  supplierName: string,
  items: Array<{ name: string; qty: number; specs: string }>,
): string {
  const list = items
    .map((it, i) => `${i + 1}. ${it.name} — Qty: ${it.qty}${it.specs ? ` — ${it.specs}` : ''}`)
    .join('\n');

  return `Hi ${supplierName},

Please quote your best price and lead time for the following items:

${list}

Please include:
- Unit price
- Availability / lead time
- MOQ if any
- Delivery cost if applicable
- Product photo or datasheet if available
- Quote validity

Thank you.`;
}
