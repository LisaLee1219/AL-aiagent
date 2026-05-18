import { invokeChat, isAIConfigured } from '@/lib/llm';
import type { WebSearchRegion, WebSearchResultItem } from '@/lib/web-search-types';
import type { WebSearchItem } from '@/lib/web-search';

const SG_MARKERS = [
  'singapore',
  '.sg/',
  '.sg ',
  ' sgd',
  'sgd ',
  'pte ltd',
  'pte. ltd',
  'pte limited',
];

const SEA_MARKERS = [
  'malaysia',
  'indonesia',
  'thailand',
  'vietnam',
  'philippines',
  'southeast asia',
  'asean',
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s."']/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

export function detectWebSearchRegion(item: {
  title: string;
  url: string;
  snippet: string;
  source: string;
}): WebSearchRegion {
  const blob = `${item.title} ${item.url} ${item.snippet} ${item.source}`.toLowerCase();
  if (SG_MARKERS.some((m) => blob.includes(m)) || /\.sg\b/i.test(item.url)) {
    return 'singapore';
  }
  if (SEA_MARKERS.some((m) => blob.includes(m))) return 'sea';
  return 'global';
}

export function heuristicWebSearchScore(
  productName: string,
  item: WebSearchItem & { isSupplierResult: boolean },
): { score: number; reason: string; region: WebSearchRegion } {
  const region = detectWebSearchRegion(item);
  const productTokens = new Set(tokenize(productName));
  const itemTokens = tokenize(`${item.title} ${item.snippet}`);
  let overlap = 0;
  for (const t of itemTokens) {
    if (productTokens.has(t)) overlap += 1;
  }
  const overlapRatio =
    productTokens.size > 0 ? overlap / Math.min(productTokens.size, 6) : 0;

  let score = Math.round(35 + overlapRatio * 45);
  if (item.isSupplierResult) score += 8;
  if (region === 'singapore') score += 18;
  else if (region === 'sea') score += 6;

  const reasons: string[] = [];
  if (region === 'singapore') reasons.push('Singapore / .sg source');
  else if (region === 'sea') reasons.push('Southeast Asia region');
  if (item.isSupplierResult) reasons.push('Supplier-oriented result');
  if (overlap > 0) reasons.push(`${overlap} keyword overlap with RFQ`);

  return {
    score: Math.min(92, score),
    reason: reasons.length > 0 ? reasons.join(' · ') : 'General web match',
    region,
  };
}

function sortByScoreDesc(a: WebSearchResultItem, b: WebSearchResultItem): number {
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  const regionOrder = { singapore: 0, sea: 1, global: 2 };
  return regionOrder[a.region] - regionOrder[b.region];
}

export function rankWebSearchHeuristic(
  productName: string,
  items: Array<WebSearchItem & { isSupplierResult: boolean }>,
): WebSearchResultItem[] {
  return items
    .map((item) => {
      const h = heuristicWebSearchScore(productName, item);
      return {
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source,
        isSupplierResult: item.isSupplierResult,
        matchScore: h.score,
        matchReason: h.reason,
        region: h.region,
      };
    })
    .sort(sortByScoreDesc);
}

const MAX_AI_POOL = 18;

function buildWebRankPrompt(productName: string, pool: WebSearchResultItem[]): string {
  const lines = pool.map((r, i) => {
    return `[${i}] region=${r.region} supplier=${r.isSupplierResult} source=${r.source} score=${r.matchScore}\n    title="${r.title}"\n    snippet="${r.snippet.slice(0, 220)}"`;
  });

  return `You are a B2B procurement researcher for Allinton Engineering (Singapore).

Product RFQ: "${productName}"

Rank these web search results for quoting / supplier sourcing. Rules:
1. STRONGLY prefer Singapore (.sg, Singapore companies, SGD pricing).
2. Then Southeast Asia suppliers; global sources only if more relevant to the product.
3. Score product relevance 0-100 (spec match, industrial B2B fit, supplier vs generic page).
4. Return ALL indices provided, sorted best match first (highest score first).

Results:
${lines.join('\n\n')}

Respond ONLY with JSON:
{"rankings":[{"index":0,"score":88,"reason":"Singapore fastener distributor, exact M16 spec"}]}`;
}

function applyAiRankings(
  pool: WebSearchResultItem[],
  rankings: Array<{ index: number; score: number; reason: string }>,
): WebSearchResultItem[] {
  const ranked: WebSearchResultItem[] = [];
  const used = new Set<number>();

  for (const r of rankings) {
    if (r.index < 0 || r.index >= pool.length || used.has(r.index)) continue;
    used.add(r.index);
    ranked.push({
      ...pool[r.index],
      matchScore: Math.min(100, Math.max(0, Math.round(r.score))),
      matchReason: r.reason?.trim() || pool[r.index].matchReason,
    });
  }

  for (let i = 0; i < pool.length; i++) {
    if (!used.has(i)) ranked.push(pool[i]);
  }

  return ranked.sort(sortByScoreDesc);
}

export async function rankWebSearchResults(
  productName: string,
  items: Array<WebSearchItem & { isSupplierResult: boolean }>,
): Promise<WebSearchResultItem[]> {
  const heuristic = rankWebSearchHeuristic(productName, items);
  const pool = heuristic.slice(0, MAX_AI_POOL);

  if (!isAIConfigured() || pool.length === 0) return heuristic;

  try {
    const response = await invokeChat(
      [
        {
          role: 'system',
          content:
            'You rank B2B web search hits for a Singapore industrial distributor. Output valid JSON only.',
        },
        { role: 'user', content: buildWebRankPrompt(productName, pool) },
      ],
      { temperature: 0.2 },
    );

    const match = response.content.trim().match(/\{[\s\S]*\}/);
    if (!match) return heuristic;

    const parsed = JSON.parse(match[0]) as {
      rankings?: Array<{ index: number; score: number; reason: string }>;
    };
    if (!Array.isArray(parsed.rankings) || parsed.rankings.length === 0) {
      return heuristic;
    }

    const aiRanked = applyAiRankings(pool, parsed.rankings);
    const tail = heuristic.slice(MAX_AI_POOL);
    return [...aiRanked, ...tail].sort(sortByScoreDesc);
  } catch (e) {
    console.error('Web search AI rank failed:', e);
    return heuristic;
  }
}
