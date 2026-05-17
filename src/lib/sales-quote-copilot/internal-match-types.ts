import type { MatchCandidate } from './types';
import type { QuoteEvidence, RankedQuoteEvidence } from './quote-evidence-types';

export interface BcItemMasterRow {
  itemNo: string;
  description: string;
  category: string;
  uom: string;
  unitCost: number;
  unitPrice: number;
  inventoryQty: number;
  inStock: boolean;
}

export interface BcSalesHistoryRow {
  documentNo: string;
  documentType: string;
  date: string;
  customer: string;
  itemNo: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface BcPurchaseHistoryRow {
  documentNo: string;
  documentType: string;
  date: string;
  vendor: string;
  itemNo: string;
  description: string;
  quantity: number;
  unitCost: number;
  lineAmount: number;
}

export interface BcFetchCounts {
  items: number;
  sales: number;
  purchases: number;
  returned?: {
    items: number;
    sales: number;
    purchases: number;
  };
  strategies: {
    sales: string[];
    purchases: string[];
  };
}

export interface InternalMatchBundle {
  lineId: string;
  originalText: string;
  quantity: number;
  uom: string;
  productType: string;
  specsSummary: string;
  /** BC / mock panels (display only) */
  itemMaster: BcItemMasterRow[];
  salesHistory: BcSalesHistoryRow[];
  purchaseHistory: BcPurchaseHistoryRow[];
  /** All quote evidence rows before AI (Item + Sales + Purchase) */
  evidenceCandidates: QuoteEvidence[];
  /** AI-ranked evidence with confidence / reason / pricing metadata */
  rankedEvidence: RankedQuoteEvidence[];
  /** UI-compatible match rows mapped from rankedEvidence */
  rankedCandidates: MatchCandidate[];
  bestMatch: MatchCandidate | null;
  dataSource: 'business_central' | 'mock' | 'mock_fallback';
  searchTerms?: string[];
  /** How many rows BC returned and which fetch strategies succeeded */
  bcFetch?: BcFetchCounts;
}
