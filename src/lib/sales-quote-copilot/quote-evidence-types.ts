import type { MatchSourceType } from './types';

export type QuoteEvidenceSource = Extract<
  MatchSourceType,
  'item_master' | 'past_sales' | 'past_purchase'
>;

export type CostSource =
  | 'item_last_direct_cost'
  | 'sales_line_unit_cost'
  | 'sales_line_cost_from_item_fallback'
  | 'purchase_line_unit_cost'
  | 'mock';

export type PriceSource =
  | 'item_list_price'
  | 'sales_line_unit_price'
  | 'purchase_margin_estimate'
  | 'missing'
  | 'mock';

export interface QuoteDocumentContext {
  documentNo?: string;
  documentType?: string;
  date?: string;
  partyName?: string;
  lineNo?: number;
}

/** Unified quote basis row before AI ranking */
export interface QuoteEvidence {
  id: string;
  source: QuoteEvidenceSource;
  itemNo: string;
  description: string;
  category?: string;
  quantity?: number;
  uom?: string;
  unitCost: number;
  unitPrice: number;
  document: QuoteDocumentContext;
  ruleConfidence: number;
  ruleConfidenceReason: string;
  costSource: CostSource;
  priceSource: PriceSource;
  warnings: string[];
  availableStock?: number;
}

export interface RankedQuoteEvidence extends QuoteEvidence {
  confidence: number;
  reason: string;
  selected?: boolean;
}

export interface ExtractedSearchTerms {
  raw: string;
  /** Product / type keywords (flat, wheel, bolt) */
  tokens: string[];
  /** Size / grade tokens (m16, 4inch) */
  specs: string[];
  /** Numeric quantities from RFQ line */
  quantities: number[];
  /** First high-signal token (legacy primary) */
  primary: string;
  /** Deduped terms used for BC OData search */
  allTerms: string[];
}
