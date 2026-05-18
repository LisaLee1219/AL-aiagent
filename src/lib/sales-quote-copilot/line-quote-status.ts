import type { MatchCandidate, RequestedItem, SupplierQuote } from './types';

export type LineQuoteSource = 'internal_match' | 'supplier_quote' | 'manual_price' | 'none';

export function getSelectedMatch(
  lineId: string,
  matchMap: Record<string, MatchCandidate[]>,
): MatchCandidate | null {
  const selected = (matchMap[lineId] || []).filter((m) => m.selected);
  if (selected.length === 0) return null;
  return [...selected].sort((a, b) => b.confidence_score - a.confidence_score)[0];
}

export function getLineQuoteSource(
  item: RequestedItem,
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): LineQuoteSource {
  if (item.excluded || item.readiness_status === 'cannot_quote') return 'none';
  if (item.manual_price?.confirmed) return 'manual_price';
  if (getSelectedMatch(item.line_id, matchMap)) return 'internal_match';
  if (supplierQuotes.some((q) => q.requested_item_id === item.line_id && q.supplier_price > 0)) {
    return 'supplier_quote';
  }
  return 'none';
}

export function isLineQuoteReady(
  item: RequestedItem,
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): boolean {
  return getLineQuoteSource(item, matchMap, supplierQuotes) !== 'none';
}

/** Lines that still need supplier / web research (no BC selection yet). */
export function needsSupplierSourcing(
  item: RequestedItem,
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): boolean {
  if (item.excluded || item.readiness_status === 'cannot_quote') return false;
  if (item.manual_price?.confirmed) return false;
  if (getSelectedMatch(item.line_id, matchMap)) return false;
  if (supplierQuotes.some((q) => q.requested_item_id === item.line_id && q.supplier_price > 0)) {
    return false;
  }
  return true;
}

export function countInternalMatchSelections(
  items: RequestedItem[],
  matchMap: Record<string, MatchCandidate[]>,
): number {
  return items.filter((item) => {
    if (item.excluded || item.readiness_status === 'cannot_quote') return false;
    if (item.manual_price?.confirmed) return false;
    return !!getSelectedMatch(item.line_id, matchMap);
  }).length;
}

export function countSupplierSourcedLines(
  items: RequestedItem[],
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): number {
  return items.filter(
    (item) => getLineQuoteSource(item, matchMap, supplierQuotes) === 'supplier_quote',
  ).length;
}

export function countQuoteReadyLines(
  items: RequestedItem[],
  matchMap: Record<string, MatchCandidate[]>,
  supplierQuotes: SupplierQuote[],
): number {
  return items.filter((item) => isLineQuoteReady(item, matchMap, supplierQuotes)).length;
}

export function describeSourcingReason(
  item: RequestedItem,
  matchMap: Record<string, MatchCandidate[]>,
): string {
  if (item.readiness_status === 'need_sourcing') {
    return 'Marked for external sourcing during readiness check';
  }
  const matches = matchMap[item.line_id] || [];
  if (matches.length === 0) {
    return 'No BC candidates — run Internal Match or search suppliers / web';
  }
  const best = [...matches].sort((a, b) => b.confidence_score - a.confidence_score)[0];
  if (best && best.confidence_score < 50) {
    return `Low confidence on best BC match (${best.confidence_score}%) — verify with supplier or web`;
  }
  return 'No item selected from Internal Match — contact supplier or use web search';
}
