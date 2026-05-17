import type { BCItem, BCPurchaseLine, BCSalesLine } from '@/lib/business-central';
import type { MatchCandidate, MatchSourceType } from './types';
import type { BcItemMasterRow, BcPurchaseHistoryRow, BcSalesHistoryRow } from './internal-match-types';
import type { ProductResult, ScoredProduct } from '@/lib/erp-ai-rank';
import { extractSearchTerms } from '@/lib/erp-ai-rank';
import { confidenceTier } from './logic';

export const MIN_AI_MATCHES = 5;
export const MAX_AI_MATCHES = 8;
/** Max rows per panel section (Item / Sales / Purchase) in internal-match bundle */
export const MAX_PANEL_MATCHES = 10;

const DESCRIPTION_STOP_WORDS = new Set([
  'pcs',
  'pc',
  'each',
  'the',
  'and',
  'for',
  'with',
  'from',
  'your',
  'our',
  'qty',
  'uom',
]);

/** Tokens from RFQ text for description / OData contains search */
export function extractDescriptionTokens(keyword: string, max = 5): string[] {
  const tokens = keyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !DESCRIPTION_STOP_WORDS.has(t));
  return [...new Set(tokens)].slice(0, max);
}

/** OData filter for sales / purchase document lines (Pascal-case BC fields) */
export function buildDescriptionSearchFilter(keyword: string, escape: (v: string) => string): string {
  const primary = escape(extractSearchTerms(keyword).primary);
  const clauses = new Set([
    `contains(Description, '${primary}')`,
    `contains(No, '${primary}')`,
  ]);
  for (const token of extractDescriptionTokens(keyword)) {
    clauses.add(`contains(Description, '${escape(token)}')`);
    clauses.add(`contains(No, '${escape(token)}')`);
  }
  return `(${[...clauses].join(' or ')})`;
}

/** OData filter for workflowItems (camelCase API fields) */
export function buildItemMasterSearchFilter(keyword: string, escape: (v: string) => string): string {
  const primary = escape(extractSearchTerms(keyword).primary);
  const clauses = new Set([
    `contains(description, '${primary}')`,
    `contains(number, '${primary}')`,
  ]);
  for (const token of extractDescriptionTokens(keyword)) {
    clauses.add(`contains(description, '${escape(token)}')`);
    clauses.add(`contains(number, '${escape(token)}')`);
  }
  return `(${[...clauses].join(' or ')})`;
}

function describeDescriptionMatchReason(score: number): string {
  if (score >= 90) return 'Strong sales line description match to RFQ';
  if (score >= 70) return 'Sales line description overlaps key RFQ specs';
  if (score >= 40) return 'Partial sales line description similarity';
  return 'Weak description overlap — verify before quoting';
}

export type RankedSalesHistoryRow = BcSalesHistoryRow & {
  matchScore?: number;
  matchTier?: string;
  matchReason?: string;
};

export function rankSalesHistoryRows(
  keyword: string,
  rows: BcSalesHistoryRow[],
  options?: { minScore?: number; limit?: number },
): RankedSalesHistoryRow[] {
  const minScore = options?.minScore ?? 18;
  const limit = options?.limit ?? 10;
  return rows
    .map((row) => {
      const matchScore = heuristicRelevanceScore(keyword, row.description, row.itemNo);
      return {
        ...row,
        matchScore,
        matchTier: confidenceTier(matchScore),
        matchReason: describeDescriptionMatchReason(matchScore),
      };
    })
    .filter((row) => (row.matchScore ?? 0) >= minScore)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, limit);
}

/** Keyword overlap score when AI returns few / no results */
export function heuristicRelevanceScore(keyword: string, name: string, sku: string): number {
  const kw = keyword.toLowerCase();
  const hay = `${name} ${sku}`.toLowerCase();
  const tokens = kw
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 12;
  }

  const sizes = kw.match(/m\d+/gi) || [];
  for (const s of sizes) {
    if (hay.includes(s.toLowerCase())) score += 22;
  }

  if (/\bscrew\b/i.test(kw) && /\bscrew\b/i.test(hay)) score += 18;
  if (/\ballen\b/i.test(kw) && /\ballen\b/i.test(hay)) score += 15;
  if (/\bmachine\b/i.test(kw) && /\bmachine\b/i.test(hay)) score += 10;
  if (/\bwheel\b/i.test(kw) && /\bwheel\b/i.test(hay)) score += 15;
  if (/\bflat\b/i.test(kw) && /\bflat\b/i.test(hay)) score += 10;

  if (hay.includes(kw.slice(0, Math.min(12, kw.length)))) score += 8;

  return Math.min(100, Math.max(score, 8));
}

function sortByRelevance<T>(
  keyword: string,
  rows: T[],
  describe: (row: T) => { text: string; sku: string },
  limit = MAX_PANEL_MATCHES,
): T[] {
  return [...rows]
    .map((row) => {
      const { text, sku } = describe(row);
      return { row, score: heuristicRelevanceScore(keyword, text, sku) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.row);
}

export function limitItemMasterRows(
  keyword: string,
  rows: BcItemMasterRow[],
  limit = MAX_PANEL_MATCHES,
): BcItemMasterRow[] {
  return sortByRelevance(
    keyword,
    rows,
    (r) => ({ text: r.description, sku: r.itemNo }),
    limit,
  );
}

export function limitSalesHistoryRows(
  keyword: string,
  rows: BcSalesHistoryRow[],
  limit = MAX_PANEL_MATCHES,
): BcSalesHistoryRow[] {
  return sortByRelevance(
    keyword,
    rows,
    (r) => ({ text: r.description, sku: r.itemNo }),
    limit,
  );
}

export function limitPurchaseHistoryRows(
  keyword: string,
  rows: BcPurchaseHistoryRow[],
  limit = MAX_PANEL_MATCHES,
): BcPurchaseHistoryRow[] {
  return sortByRelevance(
    keyword,
    rows,
    (r) => ({ text: r.description, sku: r.itemNo }),
    limit,
  );
}

export function limitBcItemsByRelevance(
  keyword: string,
  items: BCItem[],
  limit = MAX_PANEL_MATCHES,
): BCItem[] {
  return sortByRelevance(
    keyword,
    items,
    (i) => ({ text: i.description, sku: i.number }),
    limit,
  );
}

export function limitSalesLinesByRelevance(
  keyword: string,
  lines: BCSalesLine[],
  limit = MAX_PANEL_MATCHES,
): BCSalesLine[] {
  return sortByRelevance(
    keyword,
    lines,
    (l) => ({
      text: `${l.Description || ''} ${l.Description_2 || ''}`,
      sku: l.No || '',
    }),
    limit,
  );
}

export function limitPurchaseLinesByRelevance(
  keyword: string,
  lines: BCPurchaseLine[],
  limit = MAX_PANEL_MATCHES,
): BCPurchaseLine[] {
  return sortByRelevance(
    keyword,
    lines,
    (l) => ({ text: l.Description || '', sku: l.No || '' }),
    limit,
  );
}

export function ensureMinScoredProducts(
  scored: ScoredProduct[],
  candidates: ProductResult[],
  keyword: string,
  min = MIN_AI_MATCHES,
): ScoredProduct[] {
  const bySku = new Map<string, ScoredProduct>();
  for (const s of scored) {
    bySku.set(s.sku, s);
  }

  const ranked = [...candidates]
    .map((p) => {
      const existing = bySku.get(p.sku);
      if (existing) return existing;
      const h = heuristicRelevanceScore(keyword, p.name, p.sku);
      return {
        ...p,
        relevanceScore: h,
        relevanceReason: 'BC keyword / spec overlap (heuristic)',
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return ranked.slice(0, Math.max(min, Math.min(ranked.length, MAX_AI_MATCHES)));
}

function candidateFromRow(
  itemId: string,
  sourceType: MatchSourceType,
  row: {
    itemNo: string;
    description: string;
    unitCost: number;
    unitPrice: number;
    stock?: number;
    category?: string;
  },
  keyword: string,
  suffix: string,
  confidenceReason?: string,
): MatchCandidate {
  const score = heuristicRelevanceScore(keyword, row.description, row.itemNo);
  const risks: string[] = [];
  if (score < 70) risks.push('Low confidence — requires human verification');
  if ((row.stock ?? 0) === 0) risks.push('No stock on hand');

  const defaultReason =
    sourceType === 'past_purchase'
      ? 'Similar item in past purchase history'
      : sourceType === 'past_sales'
        ? 'Historical sales line match (heuristic)'
        : 'BC Item List keyword match (heuristic)';

  return {
    id: `mc-${itemId}-${suffix}-${row.itemNo}`,
    requested_item_id: itemId,
    source_type: sourceType,
    item_no: row.itemNo,
    description: row.description,
    matched_specs: row.category ? [row.category] : [],
    missing_specs: score < 70 ? ['Verify size/grade with customer'] : [],
    available_stock: row.stock ?? 0,
    cost: row.unitCost,
    suggested_selling_price: row.unitPrice || row.unitCost * 1.35,
    confidence_score: score,
    confidence_reason: confidenceReason ?? defaultReason,
    risk_flags: risks,
    selected: score >= 70,
    verified: score >= 90,
  };
}

function lastDirectCostForItem(
  itemNo: string,
  itemMaster: BcItemMasterRow[],
  fallback = 0,
): number {
  const row = itemMaster.find((m) => m.itemNo === itemNo);
  return row?.unitCost ?? fallback;
}

function candidateFromSalesHistory(
  itemId: string,
  row: RankedSalesHistoryRow,
  keyword: string,
  itemMaster: BcItemMasterRow[],
): MatchCandidate {
  const score = row.matchScore ?? heuristicRelevanceScore(keyword, row.description, row.itemNo);
  const unitCost = lastDirectCostForItem(row.itemNo, itemMaster);
  const risks: string[] = [];
  if (score < 70) risks.push('Low confidence — requires human verification');

  return {
    id: `mc-${itemId}-sl-${row.documentNo}-${row.itemNo}`,
    requested_item_id: itemId,
    source_type: 'past_sales',
    item_no: row.itemNo,
    description: row.description,
    matched_specs: [],
    missing_specs: score < 70 ? ['Verify size/grade with customer'] : [],
    available_stock: 0,
    last_sold_price: row.unitPrice,
    last_sold_date: row.date,
    customer_name: row.customer !== '—' ? row.customer : undefined,
    cost: unitCost,
    suggested_selling_price: row.unitPrice > 0 ? row.unitPrice : unitCost * 1.35,
    confidence_score: score,
    confidence_reason: row.matchReason ?? describeDescriptionMatchReason(score),
    risk_flags: risks,
    selected: score >= 70,
    verified: score >= 90,
  };
}

export function finalizeRankedCandidates(
  candidates: MatchCandidate[],
  itemId: string,
  keyword: string,
  itemMaster: BcItemMasterRow[],
  purchaseHistory: BcPurchaseHistoryRow[],
  salesHistory: RankedSalesHistoryRow[] = [],
): MatchCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.confidence_score - a.confidence_score);
  const seen = new Set(sorted.map((c) => `${c.item_no}::${c.source_type}`));

  const tryAdd = (c: MatchCandidate) => {
    const key = `${c.item_no}::${c.source_type}`;
    if (seen.has(key)) return;
    seen.add(key);
    sorted.push(c);
  };

  const salesSorted = [...salesHistory].sort(
    (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
  );
  for (const sh of salesSorted) {
    if (sorted.length >= MIN_AI_MATCHES) break;
    const score =
      sh.matchScore ?? heuristicRelevanceScore(keyword, sh.description, sh.itemNo);
    if (score < 8) continue;
    tryAdd(candidateFromSalesHistory(itemId, { ...sh, matchScore: score }, keyword, itemMaster));
  }

  const purchaseSorted = [...purchaseHistory].sort(
    (a, b) =>
      heuristicRelevanceScore(keyword, b.description, b.itemNo) -
      heuristicRelevanceScore(keyword, a.description, a.itemNo),
  );
  for (const ph of purchaseSorted) {
    if (sorted.length >= MIN_AI_MATCHES) break;
    tryAdd(
      candidateFromRow(
        itemId,
        'past_purchase',
        {
          itemNo: ph.itemNo,
          description: ph.description,
          unitCost: lastDirectCostForItem(ph.itemNo, itemMaster, ph.unitCost),
          unitPrice: ph.unitCost * 1.35,
          stock: 0,
        },
        keyword,
        'ph',
        'Purchase line description match (heuristic)',
      ),
    );
  }

  const masterSorted = [...itemMaster].sort(
    (a, b) =>
      heuristicRelevanceScore(keyword, b.description, b.itemNo) -
      heuristicRelevanceScore(keyword, a.description, a.itemNo),
  );
  for (const im of masterSorted) {
    if (sorted.length >= MIN_AI_MATCHES) break;
    tryAdd(
      candidateFromRow(
        itemId,
        'item_master',
        {
          itemNo: im.itemNo,
          description: im.description,
          unitCost: im.unitCost,
          unitPrice: im.unitPrice,
          stock: im.inventoryQty,
          category: im.category,
        },
        keyword,
        'im',
      ),
    );
  }

  const withLastDirectCost = sorted.map((candidate) => {
    const lastDirect = lastDirectCostForItem(candidate.item_no, itemMaster);
    if (lastDirect <= 0 || lastDirect === candidate.cost) return candidate;
    return { ...candidate, cost: lastDirect };
  });

  return withLastDirectCost
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, Math.max(MIN_AI_MATCHES, Math.min(sorted.length, MAX_AI_MATCHES)));
}

/** Token-based mock product filter (matches mockPurchaseLinesForKeyword behavior) */
export function mockProductsMatchKeyword(
  keyword: string,
  haystack: string,
): boolean {
  const kw = keyword.toLowerCase();
  const hay = haystack.toLowerCase();
  const tokens = extractDescriptionTokens(keyword);
  if (tokens.some((t) => hay.includes(t))) return true;
  const primary = extractSearchTerms(keyword).primary.toLowerCase();
  return primary.length > 2 && hay.includes(primary);
}
