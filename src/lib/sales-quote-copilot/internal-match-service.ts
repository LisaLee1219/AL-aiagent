import {
  isBCConfigured,
  getItemLastDirectCost,
  type BCItem,
  type BCSalesLine,
  type BCPurchaseLine,
} from '@/lib/business-central';
import { mockERPProducts, mockHistoricalOrders } from '@/lib/mock-data';
import { mockPurchaseLinesForKeyword } from '@/lib/mock-purchase-lines';
import { aiRankQuoteEvidence, extractSearchTerms } from '@/lib/erp-ai-rank';
import {
  queryBcItemsForTerms,
  queryBcPurchaseLinesForTerms,
  queryBcSalesLinesForTerms,
} from './bc-evidence-query';
import { limitEvidenceBySource } from './internal-match-limits';
import {
  limitBcItemsByRelevance,
  limitPurchaseLinesByRelevance,
  limitSalesLinesByRelevance,
} from './match-ranking';
import {
  buildEvidencePool,
  rankedEvidenceToMatchCandidate,
  termsMatchHaystack,
} from './quote-evidence-build';
import type { QuoteEvidence, RankedQuoteEvidence } from './quote-evidence-types';
import type { MatchCandidate } from './types';
import type {
  BcItemMasterRow,
  BcPurchaseHistoryRow,
  BcSalesHistoryRow,
  InternalMatchBundle,
} from './internal-match-types';
import type { InternalMatchProgressEvent } from './internal-match-progress';

function stockForSku(sku: string): number {
  return mockERPProducts.find((p) => p.sku === sku)?.stock ?? 0;
}

function mapBcItem(item: BCItem): BcItemMasterRow {
  const stock = stockForSku(item.number);
  return {
    itemNo: item.number,
    description: item.description,
    category: item.inventoryPostingGroup || item.type || '—',
    uom: item.baseUnitOfMeasure || 'PCS',
    unitCost: getItemLastDirectCost(item),
    unitPrice: item.unitPrice ?? 0,
    inventoryQty: stock,
    inStock: stock > 0,
  };
}

function mapSalesLine(line: BCSalesLine, customerFallback?: string): BcSalesHistoryRow {
  return {
    documentNo: line.Document_No || '—',
    documentType: line.Document_Type || 'Order',
    date: line.Shipment_Date || line.Requested_Delivery_Date || '—',
    customer: customerFallback || line.Shortcut_Dimension_2_Code || '—',
    itemNo: line.No || '—',
    description: line.Description || '—',
    quantity: line.Quantity ?? 0,
    unitPrice: line.Unit_Price ?? 0,
    lineAmount: line.Line_Amount ?? 0,
  };
}

function mapPurchaseLine(
  line: Pick<
    BCPurchaseLine,
    | 'Document_No'
    | 'Document_Type'
    | 'Expected_Receipt_Date'
    | 'Buy_from_Vendor_Name'
    | 'Buy_from_Vendor_No'
    | 'No'
    | 'Description'
    | 'Quantity'
    | 'Unit_Cost_LCY'
    | 'Line_Amount'
  >,
): BcPurchaseHistoryRow {
  return {
    documentNo: line.Document_No || '—',
    documentType: line.Document_Type || 'Order',
    date: line.Expected_Receipt_Date || '—',
    vendor: line.Buy_from_Vendor_Name || line.Buy_from_Vendor_No || '—',
    itemNo: line.No || '—',
    description: line.Description || '—',
    quantity: line.Quantity ?? 0,
    unitCost: line.Unit_Cost_LCY ?? 0,
    lineAmount: line.Line_Amount ?? 0,
  };
}

function mockBcItems(terms: ReturnType<typeof extractSearchTerms>): BCItem[] {
  return mockERPProducts
    .filter((p) => termsMatchHaystack(terms, `${p.sku} ${p.name} ${p.category}`))
    .map((p) => ({
      id: p.id,
      number: p.sku,
      number2: '',
      description: p.name,
      description2: '',
      type: p.category,
      baseUnitOfMeasure: 'PCS',
      unitPrice: p.listPrice,
      unitCost: p.costPrice,
      lastDirectCost: p.costPrice,
      profitPercent: 0,
      costingMethod: '',
      vendorNumber: '',
      vendorItemNumber: '',
      inventoryPostingGroup: p.category,
      itemDiscGroup: '',
      blocked: false,
    }));
}

function mockSalesLines(keyword: string, customerName?: string): BCSalesLine[] {
  const terms = extractSearchTerms(keyword);
  return mockHistoricalOrders
    .filter((o) => {
      const hay = o.product;
      const customerOk =
        !customerName || o.customer.toLowerCase().includes(customerName.toLowerCase());
      return customerOk && termsMatchHaystack(terms, hay);
    })
    .map((o, i) => ({
      Document_Type: 'Order',
      Document_No: o.orderId,
      Line_No: 10000 + i,
      Type: 'Item',
      No: '—',
      Description: o.product,
      Description_2: '',
      Quantity: o.quantity,
      Unit_of_Measure_Code: 'PCS',
      Unit_Cost_LCY: o.unitPrice * 0.7,
      Unit_Price: o.unitPrice,
      Minimum_Price: 0,
      Line_Discount_Percent: 0,
      Line_Amount: o.totalPrice,
      Line_Discount_Amount: 0,
      Location_Code: '',
      Qty_to_Ship: 0,
      Quantity_Shipped: 0,
      Qty_to_Invoice: 0,
      Quantity_Invoiced: 0,
      Shipment_Date: o.date,
      Item_Category_Code: '',
      Shortcut_Dimension_1_Code: '',
      Shortcut_Dimension_2_Code: o.customer,
      ShortcutDimCode3: '',
      ShortcutDimCode4: '',
      Purchasing_Code: '',
      Special_Order: false,
      Variant_Code: '',
      VAT_Prod_Posting_Group: '',
      Requested_Delivery_Date: o.date,
      Promised_Delivery_Date: '',
      Planned_Delivery_Date: '',
      Planned_Shipment_Date: '',
      Remarks: '',
    }));
}

function mockPurchaseLines(keyword: string): BCPurchaseLine[] {
  return mockPurchaseLinesForKeyword(keyword) as BCPurchaseLine[];
}

function toRankedMatch(
  lineId: string,
  ranked: RankedQuoteEvidence[],
): {
  rankedEvidence: RankedQuoteEvidence[];
  rankedCandidates: MatchCandidate[];
  bestMatch: MatchCandidate | null;
} {
  const withSelection = ranked.map((ev, i) => ({
    ...ev,
    selected: i === 0,
  }));
  const rankedCandidates = withSelection.map((ev) => rankedEvidenceToMatchCandidate(ev, lineId));
  return {
    rankedEvidence: withSelection,
    rankedCandidates,
    bestMatch: rankedCandidates[0] ?? null,
  };
}

function capPanelsAndBuildPool(
  keyword: string,
  items: BCItem[],
  salesLines: BCSalesLine[],
  purchaseLines: BCPurchaseLine[],
  customerName: string | undefined,
  dataOrigin: 'business_central' | 'mock',
): { panels: { itemMaster: BcItemMasterRow[]; salesHistory: BcSalesHistoryRow[]; purchaseHistory: BcPurchaseHistoryRow[] }; pool: QuoteEvidence[] } {
  const limitedItems = limitBcItemsByRelevance(keyword, items);
  const limitedSales = limitSalesLinesByRelevance(keyword, salesLines);
  const limitedPurchases = limitPurchaseLinesByRelevance(keyword, purchaseLines);

  const panels = {
    itemMaster: limitedItems.map(mapBcItem),
    salesHistory: limitedSales.map((l) => mapSalesLine(l, customerName)),
    purchaseHistory: limitedPurchases.map(mapPurchaseLine),
  };

  const pool = limitEvidenceBySource(
    buildEvidencePool(
      keyword,
      limitedItems,
      limitedSales,
      limitedPurchases,
      panels.itemMaster,
      customerName,
      dataOrigin,
    ),
  );

  return { panels, pool };
}

export interface InternalMatchInputLine {
  lineId: string;
  originalText: string;
  quantity: number;
  uom: string;
  productType: string;
  specsSummary: string;
}

export type InternalMatchProgressEmitter = (event: InternalMatchProgressEvent) => void;

function emitLog(
  onProgress: InternalMatchProgressEmitter | undefined,
  lineId: string,
  message: string,
) {
  onProgress?.({ type: 'log', lineId, message });
}

export async function buildInternalMatchBundle(
  line: InternalMatchInputLine,
  customerName?: string,
  onProgress?: InternalMatchProgressEmitter,
): Promise<InternalMatchBundle> {
  const keyword = line.originalText;
  const terms = extractSearchTerms(keyword);
  let aiAnalysis = '';

  emitLog(
    onProgress,
    line.lineId,
    `Search terms: ${terms.allTerms.join(', ') || keyword}`,
  );

  let dataSource: InternalMatchBundle['dataSource'] = 'mock';
  let itemMaster: BcItemMasterRow[] = [];
  let salesHistory: BcSalesHistoryRow[] = [];
  let purchaseHistory: BcPurchaseHistoryRow[] = [];
  let evidenceCandidates: QuoteEvidence[] = [];
  let rankedEvidence: RankedQuoteEvidence[] = [];
  let rankedCandidates: MatchCandidate[] = [];
  let bestMatch: MatchCandidate | null = null;

  const bcReady = await isBCConfigured();
  let bcFetch: InternalMatchBundle['bcFetch'];

  if (bcReady) {
    try {
      dataSource = 'business_central';
      emitLog(onProgress, line.lineId, 'Querying Business Central (items, sales, purchase)…');
      const bcItemsRaw = await queryBcItemsForTerms(terms).catch((e) => {
        console.warn('[internal-match] BC items query failed:', e);
        return [] as BCItem[];
      });
      const itemNos = bcItemsRaw.map((i) => i.number).filter(Boolean);

      const salesResult = await queryBcSalesLinesForTerms(terms, itemNos).catch((e) => {
        console.warn('[internal-match] BC sales query failed:', e);
        return { lines: [] as BCSalesLine[], diagnostics: [] as string[] };
      });
      const purchaseResult = await queryBcPurchaseLinesForTerms(terms, itemNos).catch((e) => {
        console.warn('[internal-match] BC purchase query failed:', e);
        return { lines: [] as BCPurchaseLine[], diagnostics: [] as string[] };
      });

      const bcSalesRaw = salesResult.lines;
      let bcPurchasesRaw = purchaseResult.lines;

      if (bcSalesRaw.length === 0 && bcItemsRaw.length > 0) {
        console.warn(
          `[internal-match] No sales lines for "${keyword}" (terms: ${terms.allTerms.join(', ')}). ` +
            `Tried: ${salesResult.diagnostics.join(' | ') || 'none'}`,
        );
      }
      if (bcPurchasesRaw.length === 0) {
        console.warn(
          `[internal-match] No purchase lines for "${keyword}". ` +
            `Tried: ${purchaseResult.diagnostics.join(' | ') || 'none'}`,
        );
      }

      let items = bcItemsRaw;
      if (items.length === 0) {
        items = mockBcItems(terms);
        dataSource = 'mock_fallback';
      }

      if (bcPurchasesRaw.length === 0) {
        bcPurchasesRaw = mockPurchaseLines(keyword);
      }

      const { panels, pool } = capPanelsAndBuildPool(
        keyword,
        items,
        bcSalesRaw,
        bcPurchasesRaw,
        customerName,
        dataSource === 'mock_fallback' ? 'mock' : 'business_central',
      );

      itemMaster = panels.itemMaster;
      salesHistory = panels.salesHistory;
      purchaseHistory = panels.purchaseHistory;

      bcFetch = {
        items: bcItemsRaw.length,
        sales: salesResult.lines.length,
        purchases: purchaseResult.lines.length,
        returned: {
          items: itemMaster.length,
          sales: salesHistory.length,
          purchases: purchaseHistory.length,
        },
        strategies: {
          sales: salesResult.diagnostics,
          purchases: purchaseResult.diagnostics,
        },
      };

      evidenceCandidates = pool;
      onProgress?.({
        type: 'bc_result',
        lineId: line.lineId,
        items: bcFetch?.items ?? 0,
        sales: bcFetch?.sales ?? 0,
        purchases: bcFetch?.purchases ?? 0,
        evidenceCount: pool.length,
      });
      emitLog(
        onProgress,
        line.lineId,
        `Evidence pool: ${pool.length} rows — AI ranking in progress…`,
      );
      const aiResult = await aiRankQuoteEvidence(keyword, pool, {
        onAiDelta: (text) => onProgress?.({ type: 'ai_delta', lineId: line.lineId, text }),
      });
      aiAnalysis = aiResult.thinking;
      onProgress?.({ type: 'ai_done', lineId: line.lineId, thinking: aiAnalysis });
      rankedEvidence = aiResult.ranked;
      ({ rankedEvidence, rankedCandidates, bestMatch } = toRankedMatch(line.lineId, rankedEvidence));
    } catch {
      dataSource = 'mock_fallback';
    }
  }

  if (!bcReady || dataSource === 'mock_fallback') {
    if (dataSource !== 'mock_fallback') dataSource = 'mock';
    emitLog(
      onProgress,
      line.lineId,
      bcReady ? 'BC error — using mock fallback data' : 'BC not configured — using demo data',
    );
    const mockItems = mockBcItems(terms);
    const mockSales = mockSalesLines(keyword, customerName);
    const mockPurchases = mockPurchaseLines(keyword);

    const { panels, pool } = capPanelsAndBuildPool(
      keyword,
      mockItems,
      mockSales,
      mockPurchases,
      customerName,
      'mock',
    );

    itemMaster = panels.itemMaster;
    salesHistory = panels.salesHistory;
    purchaseHistory = panels.purchaseHistory;
    evidenceCandidates = pool;
    onProgress?.({
      type: 'bc_result',
      lineId: line.lineId,
      items: itemMaster.length,
      sales: salesHistory.length,
      purchases: purchaseHistory.length,
      evidenceCount: pool.length,
    });
    emitLog(
      onProgress,
      line.lineId,
      `Evidence pool: ${pool.length} rows — AI ranking in progress…`,
    );
    const aiResult = await aiRankQuoteEvidence(keyword, pool, {
      onAiDelta: (text) => onProgress?.({ type: 'ai_delta', lineId: line.lineId, text }),
    });
    aiAnalysis = aiResult.thinking;
    onProgress?.({ type: 'ai_done', lineId: line.lineId, thinking: aiAnalysis });
    rankedEvidence = aiResult.ranked;
    ({ rankedEvidence, rankedCandidates, bestMatch } = toRankedMatch(line.lineId, rankedEvidence));
  }

  return {
    lineId: line.lineId,
    originalText: line.originalText,
    quantity: line.quantity,
    uom: line.uom,
    productType: line.productType,
    specsSummary: line.specsSummary,
    itemMaster,
    salesHistory,
    purchaseHistory,
    evidenceCandidates,
    rankedEvidence,
    rankedCandidates,
    bestMatch,
    dataSource,
    searchTerms: terms.allTerms,
    bcFetch,
    aiAnalysis,
  };
}

export async function buildInternalMatchBundles(
  lines: InternalMatchInputLine[],
  customerName?: string,
  onProgress?: InternalMatchProgressEmitter,
): Promise<InternalMatchBundle[]> {
  if (!onProgress) {
    return Promise.all(lines.map((line) => buildInternalMatchBundle(line, customerName)));
  }

  onProgress({ type: 'start', total: lines.length, customerName });
  const bundles: InternalMatchBundle[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    onProgress({
      type: 'line_start',
      lineIndex: i,
      lineId: line.lineId,
      label: line.originalText,
    });
    const bundle = await buildInternalMatchBundle(line, customerName, onProgress);
    bundles.push(bundle);
    onProgress({ type: 'line_done', lineIndex: i, bundle });
  }

  onProgress({ type: 'complete', bundles });
  return bundles;
}
