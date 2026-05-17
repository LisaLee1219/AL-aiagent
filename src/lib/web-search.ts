/**
 * Web search via Tavily API (optional; set TAVILY_API_KEY in .env.local)
 * https://tavily.com
 */

export interface WebSearchItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export function isWebSearchConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY?.trim();
}

export async function webSearch(
  query: string,
  maxResults = 8,
): Promise<WebSearchItem[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Web search failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      snippet?: string;
    }>;
  };

  return (json.results || [])
    .filter((r) => r.url)
    .map((r) => {
      let source = '';
      try {
        source = new URL(r.url!).hostname.replace(/^www\./, '');
      } catch {
        source = '';
      }
      return {
        title: r.title || '',
        url: r.url!,
        snippet: r.content || r.snippet || '',
        source,
      };
    });
}
