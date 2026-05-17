import { invokeChat } from '@/lib/llm';
import type { QuoteEvidence, RankedQuoteEvidence } from '@/lib/sales-quote-copilot/quote-evidence-types';

import type { ExtractedSearchTerms } from '@/lib/sales-quote-copilot/quote-evidence-types';

export type { ExtractedSearchTerms } from '@/lib/sales-quote-copilot/quote-evidence-types';

const SEARCH_STOP_WORDS = new Set([
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
  'ea',
]);

export interface ProductResult {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  listPrice: number;
  stock: number;
  leadTime: string;
  minOrderQty: number;
  source: 'business_central' | 'mock';
}

export interface ScoredProduct extends ProductResult {
  relevanceScore: number;
  relevanceReason: string;
}

/** Multi-token RFQ search terms for BC OData and evidence pooling */
export function extractSearchTerms(text: string): ExtractedSearchTerms {
  const raw = text.trim();
  const quantities: number[] = [];
  for (const m of raw.matchAll(/\b(\d+\.?\d*)\b/g)) {
    const n = parseFloat(m[1]);
    if (Number.isFinite(n) && n > 0) quantities.push(n);
  }

  const specs: string[] = [];
  for (const m of raw.matchAll(/\b(m\d+(?:x\d+)?)\b/gi)) {
    specs.push(m[1].toLowerCase());
  }
  for (const m of raw.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:"|''|inch|in)\b/gi)) {
    specs.push(`${m[1]}inch`);
  }
  for (const m of raw.matchAll(/\bgrade\s*(\d+(?:\.\d+)?)\b/gi)) {
    specs.push(`grade${m[1]}`);
  }

  const normalized = raw
    .replace(/\b(PC|PCS|MM|INCH|IN|GRADE|TYPE|CM|X|NO|EA|EACH)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s."']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);
  const tokens = words.filter((w) => {
    const lower = w.toLowerCase();
    if (SEARCH_STOP_WORDS.has(lower)) return false;
    if (/^\d+\.?\d*$/.test(w)) return false;
    return w.length > 2 || /^m\d+/i.test(w);
  });

  const tokenSet = new Set<string>();
  for (const t of [...tokens, ...specs]) {
    const lower = t.toLowerCase();
    if (lower.length >= 2) tokenSet.add(lower);
  }

  const allTerms = [...tokenSet].slice(0, 10);
  const primary = tokens[0] || specs[0] || words[0] || raw.split(/\s+/)[0] || raw;

  return {
    raw,
    tokens,
    specs,
    quantities: [...new Set(quantities)],
    primary,
    allTerms: allTerms.length > 0 ? allTerms : [primary.toLowerCase()].filter((t) => t.length >= 2),
  };
}

/** @deprecated Use extractSearchTerms().primary */
export function extractSearchKey(name: string): string {
  return extractSearchTerms(name).primary;
}

const MAX_EVIDENCE_FOR_AI = 28;
const MAX_RANKED_OUT = 8;

function fallbackRankEvidence(
  pool: QuoteEvidence[],
  limit = MAX_RANKED_OUT,
): RankedQuoteEvidence[] {
  return pool
    .slice()
    .sort((a, b) => b.ruleConfidence - a.ruleConfidence)
    .slice(0, limit)
    .map((ev) => ({
      ...ev,
      confidence: ev.ruleConfidence,
      reason: ev.ruleConfidenceReason,
    }));
}

/**
 * AI picks quote basis from a single evidence row (Item / Sales / Purchase).
 * Cost and sell price must come from the chosen row only — never mix sources.
 */
export async function aiRankQuoteEvidence(
  searchKeyword: string,
  evidencePool: QuoteEvidence[],
): Promise<RankedQuoteEvidence[]> {
  if (evidencePool.length === 0) return [];

  const pool = evidencePool.slice(0, MAX_EVIDENCE_FOR_AI);
  const lines = pool.map((ev, i) => {
    const doc = ev.document.documentNo
      ? `${ev.document.documentType || 'Doc'} ${ev.document.documentNo}`
      : '—';
    return `[${i}] id=${ev.id} source=${ev.source} item=${ev.itemNo} desc="${ev.description}" cost=${ev.unitCost} price=${ev.unitPrice} costSrc=${ev.costSource} priceSrc=${ev.priceSource} doc=${doc} rule=${ev.ruleConfidence} warnings=${ev.warnings.join('; ') || 'none'}`;
  });

  const prompt = `You are a B2B industrial quoting assistant for Allinton Engineering (fasteners, castors, valves, hardware).

Customer RFQ line: "${searchKeyword}"

Each candidate is ONE complete quote evidence row from BC (Item Master, Sales Line, or Purchase Line).
You MUST recommend using exactly ONE row's cost AND price together. NEVER combine purchase cost with sales price.

Rules:
- If source=item_master: use that item's cost and list price only.
- If source=past_sales: use that sales line's unit price; cost is already on the row (or item fallback — see warnings).
- If source=past_purchase: use purchase unit cost; price may be margin estimate — prefer item/sales when better product fit.
- Score relevance 0-100 (product type, size/spec, description match to RFQ).
- Return up to ${MAX_RANKED_OUT} rows, best first.

Candidates:
${lines.join('\n')}

Respond ONLY with JSON array (no markdown):
[{"index":0,"score":88,"reason":"Exact flat wheel 4in match on item master"}]`;

  try {
    const response = await invokeChat(
      [
        {
          role: 'system' as const,
          content:
            'Return only a valid JSON array. Pick single evidence rows; never merge cost/price across sources.',
        },
        { role: 'user' as const, content: prompt },
      ],
      { temperature: 0.1 },
    );

    const text = response.content.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackRankEvidence(pool);

    const rankings: Array<{ index: number; score: number; reason: string }> = JSON.parse(jsonMatch[0]);
    const ranked: RankedQuoteEvidence[] = [];
    const used = new Set<number>();

    for (const r of rankings) {
      if (r.index < 0 || r.index >= pool.length || r.score <= 0 || used.has(r.index)) continue;
      used.add(r.index);
      ranked.push({
        ...pool[r.index],
        confidence: r.score,
        reason: r.reason,
      });
      if (ranked.length >= MAX_RANKED_OUT) break;
    }

    if (ranked.length > 0) return ranked;
    return fallbackRankEvidence(pool);
  } catch (error) {
    console.error('AI quote evidence ranking error:', error);
    return fallbackRankEvidence(pool);
  }
}

export async function aiRankProducts(
  searchKeyword: string,
  candidates: ProductResult[],
): Promise<ScoredProduct[]> {
  if (candidates.length === 0) return [];

  const candidateList = candidates.map((p, i) => ({
    index: i,
    sku: p.sku,
    name: p.name,
    category: p.category,
    costPrice: p.costPrice,
    listPrice: p.listPrice,
  }));

  const prompt = `You are an expert B2B INDUSTRIAL product matcher for Allinton Engineering, a Singapore industrial trading company selling fasteners, valves, castors, tools, and industrial hardware.

Customer is searching for: "${searchKeyword}"

Below are candidate products from the ERP system. Score each one on relevance (0-100) and pick the TOP 5 most relevant matches.

Scoring criteria (be GENEROUS for same product type, but STRICT about industrial vs consumer):
- 90-100: Exact or near-exact match (same product type AND compatible size/spec)
- 70-89: Strong match (same product type even if different size, same industrial category)
- 50-69: Partial match (related industrial product type, could work as substitute)
- 30-49: Weak match (same broad industrial category, different product type)
- 0-29: Unrelated or WRONG DOMAIN

Candidates:
${candidateList.map((c) => `[${c.index}] SKU:${c.sku} | ${c.name} | Cat:${c.category} | Cost:${c.costPrice} | List:${c.listPrice}`).join('\n')}

Respond ONLY with valid JSON array (no markdown):
[{"index":0,"score":85,"reason":"..."}]

Maximum 5 items, sorted by score descending.`;

  try {
    const response = await invokeChat(
      [
        {
          role: 'system' as const,
          content: 'You are a precise product matching AI. Return only valid JSON arrays.',
        },
        { role: 'user' as const, content: prompt },
      ],
      { temperature: 0.1 },
    );

    const text = response.content.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return candidates.slice(0, 5).map((p) => ({
        ...p,
        relevanceScore: 50,
        relevanceReason: 'Default ranking',
      }));
    }

    const rankings: Array<{ index: number; score: number; reason: string }> = JSON.parse(jsonMatch[0]);

    const ranked = rankings
      .filter((r) => r.index >= 0 && r.index < candidates.length && r.score > 0)
      .slice(0, 5)
      .map((r) => ({
        ...candidates[r.index],
        relevanceScore: r.score,
        relevanceReason: r.reason,
      }));

    if (ranked.length > 0) return ranked;

    return candidates.slice(0, 5).map((p, i) => ({
      ...p,
      relevanceScore: Math.max(55 - i * 8, 12),
      relevanceReason: 'Closest ERP match (AI scored all candidates below threshold)',
    }));
  } catch (error) {
    console.error('AI ranking error:', error);
    return candidates.slice(0, 5).map((p, i) => ({
      ...p,
      relevanceScore: 80 - i * 10,
      relevanceReason: 'Keyword match from ERP',
    }));
  }
}

export function determineMatchStatus(products: ScoredProduct[]): {
  status: 'matched' | 'partial_match' | 'not_found';
  statusMessage: string;
} {
  if (products.length === 0) {
    return {
      status: 'not_found',
      statusMessage: 'No matching products found in ERP.',
    };
  }
  const bestScore = products[0].relevanceScore;
  if (bestScore >= 70) {
    return {
      status: 'matched',
      statusMessage: `Best ERP match: ${bestScore}/100`,
    };
  }
  if (bestScore >= 40) {
    return {
      status: 'partial_match',
      statusMessage: `Partial match: ${bestScore}/100`,
    };
  }
  return {
    status: 'not_found',
    statusMessage: `Weak match: ${bestScore}/100`,
  };
}
