import { NextRequest, NextResponse } from 'next/server';
import { invokeChat } from '@/lib/llm';
import { webSearch, isWebSearchConfigured, type WebSearchItem } from '@/lib/web-search';
import { rankWebSearchResults } from '@/lib/web-search-rank';
import type { WebSearchResultItem } from '@/lib/web-search-types';
import { ensureEnvLoaded } from '@/lib/env-loader';

const SG_COUNTRY = 'singapore';

/**
 * POST /api/erp/web-search
 * Singapore-first supplier research with relevance ranking (high → low)
 */
export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  const { productName, context } = (await request.json()) as {
    productName: string;
    context?: string;
  };

  if (!productName) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
  }

  try {
    const rawResults: Array<WebSearchItem & { isSupplierResult: boolean }> = [];

    if (isWebSearchConfigured()) {
      const sgSupplierQuery = `${productName} supplier distributor wholesale Singapore SGD`;
      const sgSpecQuery = `${productName} specification datasheet industrial Singapore`;
      const fallbackQuery = `${productName} supplier price Southeast Asia B2B`;

      const [sgSupplierItems, sgSpecItems] = await Promise.all([
        webSearch(sgSupplierQuery, { maxResults: 10, country: SG_COUNTRY }),
        webSearch(sgSpecQuery, { maxResults: 5, country: SG_COUNTRY }),
      ]);

      const seenUrls = new Set<string>();

      const pushItems = (
        items: Awaited<ReturnType<typeof webSearch>>,
        isSupplierResult: boolean,
      ) => {
        for (const item of items) {
          if (!item.url || seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          rawResults.push({ ...item, isSupplierResult });
        }
      };

      pushItems(sgSupplierItems, true);
      pushItems(sgSpecItems, false);

      if (rawResults.length < 6) {
        const fallbackItems = await webSearch(fallbackQuery, { maxResults: 6 });
        pushItems(fallbackItems, true);
      }
    }

    let rankedResults: WebSearchResultItem[] = [];
    if (rawResults.length > 0) {
      rankedResults = await rankWebSearchResults(productName, rawResults);
    }

    let aiAnalysis = '';
    try {
      if (allResultsEmpty(rawResults)) {
        aiAnalysis = !isWebSearchConfigured()
          ? 'Web search is not configured. Add TAVILY_API_KEY to .env.local (see .env.example).'
          : 'No web results found for this product. Try refining the product name.';
      } else {
        const topForPrompt = rankedResults.slice(0, 8);
        const analysisPrompt = `You are a B2B procurement research analyst for Allinton Engineering (Singapore).

Product searched: "${productName}"
${context ? `Customer context: ${context}` : ''}
Region priority: Singapore suppliers first, then Southeast Asia, then global.

Ranked web results (best match first):
${topForPrompt
  .map(
    (r, i) =>
      `[${i + 1}] score=${r.matchScore} region=${r.region} ${r.isSupplierResult ? 'supplier' : 'spec'}\n    ${r.title}\n    ${r.source} | ${r.url}\n    ${r.matchReason}\n    ${r.snippet.slice(0, 280)}`,
  )
  .join('\n\n')}

Provide a concise research summary in this format:

## Market Overview (Singapore focus)
[1-2 sentences — availability in Singapore / SEA]

## Recommended Suppliers (highest relevance first)
[List suppliers from results above, Singapore first]
- **Name** — Match score / region — Price note — URL hint

## Price Indication (SGD if available)
[Estimated range or "not publicly listed"]

## Next Steps
[1-2 actions for sales team]

Use only facts from the results. Prefer Singapore sources when listing suppliers.`;

        const response = await invokeChat(
          [
            {
              role: 'system' as const,
              content:
                'You are a Singapore-based B2B procurement researcher. Prioritize Singapore and .sg sources. Be factual.',
            },
            { role: 'user' as const, content: analysisPrompt },
          ],
          { temperature: 0.3 },
        );

        aiAnalysis = response.content;
      }
    } catch (error) {
      console.error('AI analysis error for web search:', error);
      aiAnalysis = 'AI analysis unavailable. Please review the ranked results below.';
    }

    const sgCount = rankedResults.filter((r) => r.region === 'singapore').length;

    return NextResponse.json({
      success: true,
      data: {
        productName,
        searchResults: rankedResults.slice(0, 12),
        supplierSummary:
          sgCount > 0
            ? `${sgCount} Singapore-prioritized result${sgCount > 1 ? 's' : ''}`
            : '',
        specSummary: '',
        aiAnalysis,
        totalResults: rankedResults.length,
        webSearchConfigured: isWebSearchConfigured(),
        regionFocus: 'singapore' as const,
      },
    });
  } catch (error) {
    console.error('Web search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Web search failed',
        data: {
          productName,
          searchResults: [],
          supplierSummary: '',
          specSummary: '',
          aiAnalysis: 'Search unavailable. Please try again.',
          totalResults: 0,
          regionFocus: 'singapore' as const,
        },
      },
      { status: 500 },
    );
  }
}

function allResultsEmpty(raw: unknown[]): boolean {
  return raw.length === 0;
}
