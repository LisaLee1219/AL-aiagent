/** Ranked web search hit returned by POST /api/erp/web-search */

export type WebSearchRegion = 'singapore' | 'sea' | 'global';

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: string;
  isSupplierResult: boolean;
  matchScore: number;
  matchReason: string;
  region: WebSearchRegion;
}

export interface WebSearchResponseData {
  productName: string;
  searchResults: WebSearchResultItem[];
  supplierSummary: string;
  specSummary: string;
  aiAnalysis: string;
  totalResults: number;
  webSearchConfigured: boolean;
  regionFocus: 'singapore';
}
