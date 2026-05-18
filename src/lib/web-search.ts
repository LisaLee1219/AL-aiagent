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

export interface WebSearchOptions {
  maxResults?: number;
  /** Tavily country boost — use `singapore` for local priority */
  country?: string;
  includeDomains?: string[];
}

export function isWebSearchConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY?.trim();
}

export async function webSearch(
  query: string,
  maxResultsOrOptions: number | WebSearchOptions = 8,
): Promise<WebSearchItem[]> {
  const options: WebSearchOptions =
    typeof maxResultsOrOptions === 'number'
      ? { maxResults: maxResultsOrOptions }
      : maxResultsOrOptions;
  const maxResults = options.maxResults ?? 8;

  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: 'basic',
    topic: 'general',
  };
  if (options.country) body.country = options.country;
  if (options.includeDomains?.length) {
    body.include_domains = options.includeDomains;
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      throw new Error(
        'Tavily API key is missing or invalid. Set TAVILY_API_KEY in .env.local (get a key at https://app.tavily.com) and restart the dev server if the error persists.',
      );
    }
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
