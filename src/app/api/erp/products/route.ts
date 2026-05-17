import { NextRequest, NextResponse } from 'next/server';
import { invokeChat } from '@/lib/llm';
import {
  isBCConfigured,
  getItems,
  getItemLastDirectCost,
  getSalesDocumentLines,
  type BCSalesLine,
} from '@/lib/business-central';
import { mockERPProducts, mockHistoricalOrders } from '@/lib/mock-data';
import { ensureEnvLoaded } from '@/lib/env-loader';

/** Unified product data format (from BC or mock) */
interface ProductResult {
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

/** Product match with AI relevance score */
interface ScoredProduct extends ProductResult {
  relevanceScore: number;  // 0-100
  relevanceReason: string; // Why this match was selected
}

/** Per-search-keyword result with status feedback */
interface ProductSearchResult {
  searchKeyword: string;
  status: 'matched' | 'partial_match' | 'not_found';
  statusMessage: string;
  products: ScoredProduct[];
  historicalOrders: Array<{
    id: string;
    orderId: string;
    customer: string;
    product: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    date: string;
    status: string;
  }>;
  webSearchAvailable: boolean;
}

/**
 * GET /api/erp/products
 * Fetch from Business Central first, fallback to mock if not configured
 */
export async function GET(request: NextRequest) {
  await ensureEnvLoaded();
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get('keyword') || '';

  if ((await isBCConfigured())) {
    try {
      const bcItems = await getItems({
        search: keyword || undefined,
        top: 50,
      });

      const results: ProductResult[] = bcItems.map((item) => ({
        id: item.id,
        sku: item.number,
        name: item.description,
        category: item.inventoryPostingGroup || item.type || 'Uncategorized',
        costPrice: getItemLastDirectCost(item),
        listPrice: item.unitPrice,
        stock: 0,
        leadTime: 'TBC',
        minOrderQty: 1,
        source: 'business_central' as const,
      }));

      return NextResponse.json({
        success: true,
        data: results,
        total: results.length,
        source: 'business_central',
      });
    } catch (error) {
      console.error('Business Central API error, falling back to mock:', error);
    }
  }

  // Mock data fallback
  let results: ProductResult[] = mockERPProducts.map((p) => ({
    ...p,
    source: 'mock' as const,
  }));

  if (keyword) {
    const kw = keyword.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        p.sku.toLowerCase().includes(kw) ||
        p.category.toLowerCase().includes(kw)
    );
  }

  return NextResponse.json({
    success: true,
    data: results,
    total: results.length,
    source: 'mock',
  });
}

/**
 * Use AI to score and rank product matches
 */
async function aiRankProducts(
  searchKeyword: string,
  candidates: ProductResult[],
): Promise<ScoredProduct[]> {
  if (candidates.length === 0) return [];

  // If <= 5 candidates, just score them all
  // If > 5, we still send all to AI and let it pick top 5
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
- 0-29: Unrelated or WRONG DOMAIN (e.g. consumer electronics matched to industrial parts)

IMPORTANT SCORING RULES:
- If a candidate shares the SAME INDUSTRIAL PRODUCT TYPE (e.g. both are bolts, both are valves, both are nuts), score it AT LEAST 60 regardless of size difference
- Size/spec differences should reduce score by only 10-20 points, NOT disqualify the match
- ALWAYS return at least 1 result if ANY candidate is even loosely related
- NEVER return empty array unless ALL candidates are completely unrelated
- PENALIZE matches from wrong domain: if customer wants an industrial pressure switch and a candidate is a consumer flashlight accessory, score it MAX 20
- Consider the INDUSTRIAL context: Allinton sells to construction, engineering, and manufacturing clients

Candidates:
${candidateList.map((c) => `[${c.index}] SKU:${c.sku} | ${c.name} | Cat:${c.category} | Cost:${c.costPrice} | List:${c.listPrice}`).join('\n')}

Respond ONLY with valid JSON array (no markdown, no explanation):
[
  {"index":0,"score":85,"reason":"Same bolt type M16, grade 8.8 matches exactly"},
  {"index":3,"score":72,"reason":"Similar bolt but different grade, could substitute"},
  ...
]

Rules:
- Maximum 5 items in the response
- Sorted by score descending
- Each item must have index, score (0-100 integer), and reason (one short sentence)
- ALWAYS return at least 1 item if any candidate shares the same industrial product category or type`;

  try {
    const response = await invokeChat(
      [
        {
          role: 'system' as const,
          content: 'You are a precise product matching AI. Return only valid JSON arrays. No markdown fences.',
        },
        { role: 'user' as const, content: prompt },
      ],
      { temperature: 0.1 },
    );

    // Parse AI response - extract JSON from potential markdown fences
    let text = response.content.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return candidates.slice(0, 5).map((p) => ({ ...p, relevanceScore: 50, relevanceReason: 'Default ranking' }));

    const rankings: Array<{ index: number; score: number; reason: string }> = JSON.parse(jsonMatch[0]);

    return rankings
      .filter((r) => r.index >= 0 && r.index < candidates.length && r.score > 0)
      .slice(0, 5)
      .map((r) => ({
        ...candidates[r.index],
        relevanceScore: r.score,
        relevanceReason: r.reason,
      }));
  } catch (error) {
    console.error('AI ranking error, using default sorting:', error);
    // Fallback: return first 5 with generic scores
    return candidates.slice(0, 5).map((p, i) => ({
      ...p,
      relevanceScore: 80 - i * 10,
      relevanceReason: 'Keyword match from ERP',
    }));
  }
}

/**
 * Determine search status based on AI-scored results
 */
function determineStatus(products: ScoredProduct[]): {
  status: 'matched' | 'partial_match' | 'not_found';
  statusMessage: string;
} {
  if (products.length === 0) {
    return {
      status: 'not_found',
      statusMessage: 'No matching products found in ERP. Use Web Search to find suppliers.',
    };
  }

  const bestScore = products[0].relevanceScore;
  if (bestScore >= 70) {
    return {
      status: 'matched',
      statusMessage: `Found ${products.length} match${products.length > 1 ? 'es' : ''} in ERP (best: ${bestScore}/100)`,
    };
  }
  if (bestScore >= 40) {
    return {
      status: 'partial_match',
      statusMessage: `Best match scores ${bestScore}/100 — may need adjustment. Web Search can find alternatives.`,
    };
  }
  return {
    status: 'not_found',
    statusMessage: `Closest match only scores ${bestScore}/100. Recommend Web Search for better options.`,
  };
}

/**
 * POST /api/erp/products
 * Batch search with AI ranking: return 1-5 most relevant items per keyword + status feedback
 */
export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  const { productNames, customerName } = await request.json() as { productNames: string[]; customerName?: string };

  if (!productNames || !Array.isArray(productNames)) {
    return NextResponse.json({ error: 'Please provide a list of product names' }, { status: 400 });
  }

  if ((await isBCConfigured())) {
    try {
      const results = await Promise.all(
        productNames.map(async (name: string): Promise<ProductSearchResult> => {
          // Extract keywords for BC search
          const keywords = name
            .replace(/\b(PC|PCS|MM|INCH|GRADE|TYPE|CM|X|NO)\b/gi, '')
            .replace(/\b\d+\.?\d*\b/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter((w: string) => w.length > 2);

          const searchKey = keywords[0] || name.split(' ')[0];

          // Fetch more candidates from BC (up to 30), then AI will pick top 5
          const bcItemsResult = await getItems({ search: searchKey, top: 30 }).catch(() => []);

          const candidates: ProductResult[] = bcItemsResult.map((item) => ({
            id: item.id,
            sku: item.number,
            name: item.description,
            category: item.inventoryPostingGroup || item.type || 'Uncategorized',
            costPrice: getItemLastDirectCost(item),
            listPrice: item.unitPrice,
            stock: 0,
            leadTime: 'TBC',
            minOrderQty: 1,
            source: 'business_central' as const,
          }));

          // AI ranking: pick top 1-5
          const scoredProducts = await aiRankProducts(name, candidates);

          // Fetch historical orders for top matches
          const historicalOrders: ProductSearchResult['historicalOrders'] = [];
          try {
            const bcSalesLines = await getSalesDocumentLines({
              filter: `contains(Description,'${searchKey.replace(/'/g, "''")}')`,
              top: 5,
            }).catch(() => [] as BCSalesLine[]);
            for (const line of bcSalesLines) {
              historicalOrders.push({
                id: line.Document_No || '',
                orderId: line.Document_No || '',
                customer: line.Document_No || '',
                product: line.Description || '',
                quantity: line.Quantity || 0,
                unitPrice: line.Unit_Price || 0,
                totalPrice: line.Line_Amount || 0,
                date: line.Shipment_Date || '',
                status: line.Document_Type || '',
              });
            }
          } catch {
            // Historical order query failed, does not affect main flow
          }

          const { status, statusMessage } = determineStatus(scoredProducts);

          return {
            searchKeyword: name,
            status,
            statusMessage,
            products: scoredProducts,
            historicalOrders,
            webSearchAvailable: true,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: results,
        source: 'business_central',
      });
    } catch (error) {
      console.error('Business Central batch search error, falling back to mock:', error);
    }
  }

  // Mock fallback with simple scoring
  const results: ProductSearchResult[] = productNames.map((name: string) => {
    const kw = name.toLowerCase();
    const matchedProducts = mockERPProducts.filter(
      (p) => p.name.toLowerCase().includes(kw) || p.category.toLowerCase().includes(kw)
    );
    const matchedOrders = mockHistoricalOrders.filter(
      (o) => o.product.toLowerCase().includes(kw) || (customerName && o.customer.toLowerCase().includes(customerName.toLowerCase()))
    );

    // Simple mock scoring based on keyword overlap
    const scoredProducts: ScoredProduct[] = matchedProducts.slice(0, 5).map((p, i) => ({
      ...p,
      source: 'mock' as const,
      relevanceScore: Math.max(90 - i * 15, 40),
      relevanceReason: `Keyword match: "${kw}" found in product name/category`,
    }));

    const { status, statusMessage } = determineStatus(scoredProducts);

    return {
      searchKeyword: name,
      status,
      statusMessage,
      products: scoredProducts,
      historicalOrders: matchedOrders,
      webSearchAvailable: status !== 'matched',
    };
  });

  return NextResponse.json({
    success: true,
    data: results,
    source: 'mock',
  });
}
