import { getItemLastDirectCost, type BCItem, type BCSalesLine, type BCPurchaseLine } from '@/lib/business-central';
import { mockERPProducts } from '@/lib/mock-data';
import type { ExtractedSearchTerms, QuoteEvidence, RankedQuoteEvidence } from './quote-evidence-types';
import type { BcItemMasterRow } from './internal-match-types';
import type { MatchCandidate } from './types';
import { heuristicRelevanceScore } from './match-ranking';

const MARGIN_ESTIMATE = 1.35;

function stockForSku(sku: string): number {
  return mockERPProducts.find((p) => p.sku === sku)?.stock ?? 0;
}

function itemCostLookup(itemMaster: BcItemMasterRow[], itemNo: string): number {
  if (!itemNo || itemNo === '—') return 0;
  return itemMaster.find((m) => m.itemNo === itemNo)?.unitCost ?? 0;
}

function ruleScore(keyword: string, description: string, itemNo: string): number {
  return heuristicRelevanceScore(keyword, description, itemNo);
}

export function buildItemEvidence(
  item: BCItem,
  keyword: string,
  dataOrigin: 'business_central' | 'mock',
): QuoteEvidence {
  const unitCost = getItemLastDirectCost(item);
  const unitPrice = item.unitPrice ?? 0;
  const warnings: string[] = [];
  if (unitCost === 0) warnings.push('Item cost is zero — verify Last Direct Cost in BC');
  if (unitPrice === 0) warnings.push('Item list price is zero — verify before quoting');
  const stock = stockForSku(item.number);

  return {
    id: `ev-item-${item.number}`,
    source: 'item_master',
    itemNo: item.number,
    description: item.description,
    category: item.inventoryPostingGroup || item.type,
    uom: item.baseUnitOfMeasure || 'PCS',
    unitCost,
    unitPrice,
    document: {},
    ruleConfidence: ruleScore(keyword, item.description, item.number),
    ruleConfidenceReason: 'BC Item List match to RFQ wording',
    costSource: dataOrigin === 'mock' ? 'mock' : 'item_last_direct_cost',
    priceSource: dataOrigin === 'mock' ? 'mock' : 'item_list_price',
    warnings,
    availableStock: stock,
  };
}

export function buildSalesEvidence(
  line: BCSalesLine,
  keyword: string,
  itemMaster: BcItemMasterRow[],
  customerName?: string,
): QuoteEvidence {
  const itemNo = line.No || '—';
  const unitPrice = line.Unit_Price ?? 0;
  let unitCost = line.Unit_Cost_LCY ?? 0;
  const warnings: string[] = [];
  let costSource: QuoteEvidence['costSource'] = 'sales_line_unit_cost';

  if (unitCost <= 0) {
    const fallback = itemCostLookup(itemMaster, itemNo);
    if (fallback > 0) {
      unitCost = fallback;
      costSource = 'sales_line_cost_from_item_fallback';
      warnings.push('Sales line cost missing — using Item Master Last Direct Cost for same item');
    } else {
      warnings.push('Sales line and Item Master cost both missing');
    }
  }

  if (unitPrice <= 0) {
    warnings.push('Sales line unit price is zero');
  }

  return {
    id: `ev-sales-${line.Document_No}-${line.Line_No}`,
    source: 'past_sales',
    itemNo,
    description: line.Description || '—',
    quantity: line.Quantity ?? 0,
    uom: line.Unit_of_Measure_Code,
    unitCost,
    unitPrice,
    document: {
      documentNo: line.Document_No,
      documentType: line.Document_Type,
      date: line.Shipment_Date || line.Requested_Delivery_Date,
      partyName: customerName || line.Shortcut_Dimension_2_Code,
      lineNo: line.Line_No,
    },
    ruleConfidence: ruleScore(keyword, line.Description || '', itemNo),
    ruleConfidenceReason: 'BC sales document line match to RFQ wording',
    costSource,
    priceSource: 'sales_line_unit_price',
    warnings,
    availableStock: 0,
  };
}

export function buildPurchaseEvidence(
  line: BCPurchaseLine,
  keyword: string,
): QuoteEvidence {
  const unitCost = line.Unit_Cost_LCY ?? 0;
  const warnings: string[] = [];
  let unitPrice = 0;
  let priceSource: QuoteEvidence['priceSource'] = 'missing';

  if (unitCost > 0) {
    unitPrice = Math.round(unitCost * MARGIN_ESTIMATE * 100) / 100;
    priceSource = 'purchase_margin_estimate';
    warnings.push(
      `Purchase line has no sell price — estimated at ${Math.round((MARGIN_ESTIMATE - 1) * 100)}% margin on unit cost`,
    );
  } else {
    warnings.push('Purchase line unit cost is zero');
  }

  return {
    id: `ev-po-${line.Document_No}-${line.Line_No}`,
    source: 'past_purchase',
    itemNo: line.No || '—',
    description: line.Description || '—',
    quantity: line.Quantity ?? 0,
    uom: line.Unit_of_Measure_Code,
    unitCost,
    unitPrice,
    document: {
      documentNo: line.Document_No,
      documentType: line.Document_Type,
      date: line.Expected_Receipt_Date,
      partyName: line.Buy_from_Vendor_Name || line.Buy_from_Vendor_No,
      lineNo: line.Line_No,
    },
    ruleConfidence: ruleScore(keyword, line.Description || '', line.No || ''),
    ruleConfidenceReason: 'BC purchase document line match to RFQ wording',
    costSource: 'purchase_line_unit_cost',
    priceSource,
    warnings,
    availableStock: 0,
  };
}

export function buildEvidencePool(
  keyword: string,
  items: BCItem[],
  salesLines: BCSalesLine[],
  purchaseLines: BCPurchaseLine[],
  itemMaster: BcItemMasterRow[],
  customerName?: string,
  dataOrigin: 'business_central' | 'mock' = 'business_central',
): QuoteEvidence[] {
  const seen = new Set<string>();
  const pool: QuoteEvidence[] = [];

  const add = (ev: QuoteEvidence) => {
    if (seen.has(ev.id)) return;
    seen.add(ev.id);
    pool.push(ev);
  };

  for (const item of items) {
    add(buildItemEvidence(item, keyword, dataOrigin));
  }
  for (const line of salesLines) {
    add(buildSalesEvidence(line, keyword, itemMaster, customerName));
  }
  for (const line of purchaseLines) {
    add(buildPurchaseEvidence(line, keyword));
  }

  return pool.sort((a, b) => b.ruleConfidence - a.ruleConfidence);
}

export function rankedEvidenceToMatchCandidate(
  ev: RankedQuoteEvidence,
  lineId: string,
): MatchCandidate {
  const risks = [...ev.warnings];
  if (ev.confidence < 70) risks.push('Low confidence — requires human verification');
  if (ev.unitCost === 0) risks.push('Cost is zero — verify before quoting');
  if (ev.priceSource === 'missing' || ev.unitPrice === 0) {
    risks.push('Selling price missing on selected evidence');
  }

  return {
    id: ev.id,
    requested_item_id: lineId,
    source_type: ev.source,
    item_no: ev.itemNo,
    description: ev.description,
    matched_specs: ev.category ? [ev.category] : [],
    missing_specs:
      ev.priceSource === 'missing' ? ['Selling price not available on this evidence row'] : [],
    available_stock: ev.availableStock ?? 0,
    last_sold_price: ev.source === 'past_sales' ? ev.unitPrice : undefined,
    last_sold_date: ev.document.date,
    customer_name: ev.source === 'past_sales' ? ev.document.partyName : undefined,
    cost: ev.unitCost,
    suggested_selling_price: ev.unitPrice,
    confidence_score: ev.confidence,
    confidence_reason: ev.reason,
    risk_flags: [...new Set(risks)],
    selected: ev.selected,
    verified: ev.confidence >= 90,
    cost_source: ev.costSource,
    price_source: ev.priceSource,
    warnings: ev.warnings,
    evidence_id: ev.id,
  };
}

export function termsMatchHaystack(terms: ExtractedSearchTerms, haystack: string): boolean {
  const hay = haystack.toLowerCase();
  if (terms.allTerms.some((t) => hay.includes(t))) return true;
  return terms.primary.length > 2 && hay.includes(terms.primary.toLowerCase());
}
