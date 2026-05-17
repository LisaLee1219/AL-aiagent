import { NextRequest, NextResponse } from 'next/server';
import { invokeChat } from '@/lib/llm';
import { webSearch, isWebSearchConfigured } from '@/lib/web-search';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * POST /api/erp/web-search
 * Web search fallback: find suppliers, prices, and market research for products not found in ERP
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
    const allResults: Array<{
      title: string;
      url: string;
      snippet: string;
      source: string;
      isSupplierResult: boolean;
    }> = [];

    if (isWebSearchConfigured()) {
      const supplierQuery = `${productName} supplier wholesale price Singapore Southeast Asia`;
      const specQuery = `${productName} specification datasheet industrial`;

      const [supplierItems, specItems] = await Promise.all([
        webSearch(supplierQuery, 8),
        webSearch(specQuery, 5),
      ]);

      const seenUrls = new Set<string>();

      for (const item of supplierItems) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push({
            ...item,
            isSupplierResult: true,
          });
        }
      }

      for (const item of specItems) {
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push({
            ...item,
            isSupplierResult: false,
          });
        }
      }
    }

    let aiAnalysis = '';
    try {
      if (allResults.length === 0 && !isWebSearchConfigured()) {
        aiAnalysis =
          'Web search is not configured. Add TAVILY_API_KEY to .env.local to enable supplier research (see .env.example).';
      } else if (allResults.length === 0) {
        aiAnalysis = 'No web results found for this product. Try refining the product name.';
      } else {
        const analysisPrompt = `You are a B2B procurement research analyst for Allinton Engineering (Singapore).

Product searched: "${productName}"
${context ? `Customer context: ${context}` : ''}

Web search results:
${allResults.map((r, i) => `[${i + 1}] ${r.title}\n    Source: ${r.source} | URL: ${r.url}\n    ${r.snippet}`).join('\n\n')}

Provide a concise research summary in this format:

## Market Overview
[1-2 sentences about product availability and market]

## Potential Suppliers
[List 2-4 suppliers found with estimated price range if available]
- **Supplier Name** — Price range (if found) — Notes

## Price Indication
[Estimated price range based on search results, or "Price not publicly available"]

## Recommendations
[1-2 actionable next steps for the sales team]

Keep it factual. Only include information found in search results. If no pricing found, say so.`;

        const response = await invokeChat(
          [
            {
              role: 'system' as const,
              content:
                'You are a professional B2B procurement researcher. Provide concise, factual analysis based on search results only. Do not fabricate data.',
            },
            { role: 'user' as const, content: analysisPrompt },
          ],
          { temperature: 0.3 },
        );

        aiAnalysis = response.content;
      }
    } catch (error) {
      console.error('AI analysis error for web search:', error);
      aiAnalysis = 'AI analysis unavailable. Please review the search results below manually.';
    }

    return NextResponse.json({
      success: true,
      data: {
        productName,
        searchResults: allResults.slice(0, 10),
        supplierSummary: '',
        specSummary: '',
        aiAnalysis,
        totalResults: allResults.length,
        webSearchConfigured: isWebSearchConfigured(),
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
        },
      },
      { status: 500 },
    );
  }
}
