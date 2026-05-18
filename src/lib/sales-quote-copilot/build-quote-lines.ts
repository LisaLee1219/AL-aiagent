import { sourceBadgeLabel } from './logic';
import {
  countInternalMatchSelections,
  countQuoteReadyLines,
  isLineQuoteReady,
} from './line-quote-status';
import type {
  FinalQuoteLine,
  ManualPriceEntry,
  MatchCandidate,
  RequestedItem,
  SupplierQuote,
} from './types';

export { countInternalMatchSelections, countQuoteReadyLines, isLineQuoteReady };

function resolveQuotePricing(
  selected: MatchCandidate | null,
  mp: ManualPriceEntry | null,
  sq: SupplierQuote | undefined,
): { cost: number; sell: number; priceFlags: string[] } {
  const flags: string[] = [];

  if (mp) {
    return { cost: mp.cost, sell: mp.selling_price, priceFlags: flags };
  }

  const cost = sq?.supplier_price ?? selected?.cost ?? 0;
  let sell =
    sq?.supplier_price != null
      ? sq.supplier_price * 1.25
      : (selected?.suggested_selling_price ?? 0);

  if (sell <= 0 && selected?.last_sold_price && selected.last_sold_price > 0) {
    sell = selected.last_sold_price;
    flags.push('Using last sold price');
  }
  if (sell <= 0 && selected?.last_quoted_price && selected.last_quoted_price > 0) {
    sell = selected.last_quoted_price;
    flags.push('Using last quoted price');
  }
  if (sell <= 0 && cost > 0) {
    sell = Math.round(cost * 1.35 * 100) / 100;
    flags.push('Estimated sell price from cost (35% markup)');
  }
  if (sell <= 0) {
    flags.push('Unit price TBC — update in Manual Review or BC');
  }

  return { cost, sell, priceFlags: flags };
}

/** Quote lines: Internal Match selection, confirmed manual price, or supplier quote from sourcing. */
export function buildQuoteLinesFromMatchSelections(
  items: RequestedItem[],
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): FinalQuoteLine[] {
  const lines: FinalQuoteLine[] = [];

  for (const item of items) {
    if (item.excluded || item.readiness_status === 'cannot_quote') continue;

    const mp = item.manual_price?.confirmed ? item.manual_price : null;
    const matches = matchMap[item.line_id] || [];
    const selectedMatches = matches.filter((m) => m.selected);
    const selected =
      selectedMatches.length > 0
        ? [...selectedMatches].sort((a, b) => b.confidence_score - a.confidence_score)[0]
        : null;

    const sq = supplierQuotes.find((q) => q.requested_item_id === item.line_id);
    if (!mp && !selected && !sq) continue;

    const { cost, sell, priceFlags } = resolveQuotePricing(selected, mp, selected ? undefined : sq);
    const margin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
    const useManual = !!mp;
    const qty = item.quantity || 1;

    lines.push({
      id: `ql-${item.line_id}`,
      requested_item_id: item.line_id,
      requested_label: item.original_text,
      description: selected?.description || item.normalized_name || item.original_text,
      source_type: useManual ? 'manual' : sq ? 'supplier_quote' : selected?.source_type || 'manual',
      source_label: useManual
        ? 'Manual Price'
        : sq
          ? `Supplier: ${sq.supplier_name}`
          : sourceBadgeLabel(selected?.source_type || 'manual'),
      supplier: sq?.supplier_name,
      quantity: qty,
      cost,
      selling_price: sell,
      discount: 0,
      final_price: sell,
      margin_percent: margin,
      lead_time: mp?.lead_time || sq?.lead_time || '3–5 days',
      confidence_score: selected?.confidence_score ?? (sq ? 75 : useManual ? 80 : 50),
      approval_status: 'pending',
      risk_flags: [
        ...priceFlags,
        ...(sq && !selected ? ['Supplier quote — not in BC item master'] : []),
        ...(useManual ? ['Manual price used'] : []),
        ...(cost === 0 && sell === 0 ? ['No price source — verify before sending'] : []),
        ...(cost === 0 && sell > 0 ? ['Cost is zero'] : []),
        ...(selected && selected.confidence_score < 70
          ? ['Low confidence — requires human verification']
          : []),
        ...((selected?.risk_flags || []).slice(0, 2)),
      ],
      manual_override: useManual,
      item_no: selected?.item_no,
      uom: item.uom || 'pcs',
    });
  }

  return lines;
}

/** @deprecated Use countQuoteReadyLines — includes supplier-sourced lines */
export function countSelectedMatchLines(
  items: RequestedItem[],
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[] = [],
): number {
  return countQuoteReadyLines(items, matchMap, supplierQuotes);
}
