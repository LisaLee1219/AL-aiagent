import {
  getItems,
  getSalesLines,
  getSalesDocumentLines,
  getPurchaseDocumentLines,
  type BCItem,
  type BCSalesLine,
  type BCPurchaseLine,
} from '@/lib/business-central';
import { termsMatchHaystack } from './quote-evidence-build';
import type { ExtractedSearchTerms } from './quote-evidence-types';

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function buildLineOrFilter(terms: string[]): string {
  const clauses = new Set<string>();
  for (const term of terms) {
    const safe = escapeOData(term);
    clauses.add(`contains(No, '${safe}')`);
    clauses.add(`contains(Description, '${safe}')`);
  }
  return `(${[...clauses].join(' or ')})`;
}

function buildItemOrFilter(terms: string[]): string {
  const clauses = new Set<string>();
  for (const term of terms) {
    const safe = escapeOData(term);
    clauses.add(`contains(description, '${safe}')`);
    clauses.add(`contains(number, '${safe}')`);
  }
  return `(${[...clauses].join(' or ')})`;
}

function searchTermsList(terms: ExtractedSearchTerms): string[] {
  return terms.allTerms.length > 0 ? terms.allTerms : [terms.primary];
}

function logBcQueryWarning(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[BC evidence query] ${scope}: ${message}`);
}

function mergeSales(
  merged: Map<string, BCSalesLine>,
  rows: BCSalesLine[],
): void {
  for (const row of rows) {
    merged.set(`${row.Document_No}-${row.Line_No}`, row);
  }
}

function mergePurchases(
  merged: Map<string, BCPurchaseLine>,
  rows: BCPurchaseLine[],
): void {
  for (const row of rows) {
    merged.set(`${row.Document_No}-${row.Line_No}`, row);
  }
}

async function querySalesWithFilter(filter: string, top: number): Promise<BCSalesLine[]> {
  const [documentLines, orderLines] = await Promise.all([
    getSalesDocumentLines({ filter, top }).catch((e) => {
      logBcQueryWarning('salesDocumentLines filtered', e);
      return [] as BCSalesLine[];
    }),
    getSalesLines({ filter, top }).catch((e) => {
      logBcQueryWarning('SalesOrderSalesLines filtered', e);
      return [] as BCSalesLine[];
    }),
  ]);
  return [...documentLines, ...orderLines];
}

async function querySalesByItemNo(itemNo: string, top: number): Promise<BCSalesLine[]> {
  const safe = escapeOData(itemNo);
  const filter = `No eq '${safe}'`;
  return querySalesWithFilter(filter, top);
}

async function querySalesRecent(top: number): Promise<BCSalesLine[]> {
  const [documentLines, orderLines] = await Promise.all([
    getSalesDocumentLines({ top }).catch((e) => {
      logBcQueryWarning('salesDocumentLines recent', e);
      return [] as BCSalesLine[];
    }),
    getSalesLines({ top }).catch((e) => {
      logBcQueryWarning('SalesOrderSalesLines recent', e);
      return [] as BCSalesLine[];
    }),
  ]);
  return [...documentLines, ...orderLines];
}

async function queryPurchasesWithFilter(filter: string, top: number): Promise<BCPurchaseLine[]> {
  return getPurchaseDocumentLines({ filter, top }).catch((e) => {
    logBcQueryWarning('purchaseDocumentLines filtered', e);
    return [];
  });
}

async function queryPurchasesByItemNo(itemNo: string, top: number): Promise<BCPurchaseLine[]> {
  const safe = escapeOData(itemNo);
  return queryPurchasesWithFilter(`No eq '${safe}'`, top);
}

async function queryPurchasesRecent(top: number): Promise<BCPurchaseLine[]> {
  return getPurchaseDocumentLines({ top }).catch((e) => {
    logBcQueryWarning('purchaseDocumentLines recent', e);
    return [];
  });
}

function clientFilterSales(lines: BCSalesLine[], terms: ExtractedSearchTerms): BCSalesLine[] {
  return lines.filter((l) =>
    termsMatchHaystack(terms, `${l.No || ''} ${l.Description || ''} ${l.Description_2 || ''}`),
  );
}

function clientFilterPurchases(
  lines: BCPurchaseLine[],
  terms: ExtractedSearchTerms,
): BCPurchaseLine[] {
  return lines.filter((l) =>
    termsMatchHaystack(terms, `${l.No || ''} ${l.Description || ''}`),
  );
}

export interface BcEvidenceFetchDiagnostics {
  items: number;
  sales: number;
  purchases: number;
  strategies: {
    sales: string[];
    purchases: string[];
  };
}

export async function queryBcItemsForTerms(terms: ExtractedSearchTerms): Promise<BCItem[]> {
  const list = searchTermsList(terms);
  const merged = new Map<string, BCItem>();

  if (list.length > 0) {
    try {
      const batch = await getItems({ filter: buildItemOrFilter(list), top: 24 });
      for (const item of batch) {
        merged.set(item.number || item.id, item);
      }
    } catch (e) {
      logBcQueryWarning('workflowItems OR filter', e);
    }
  }

  for (const term of list) {
    if (merged.size >= 24) break;
    try {
      const batch = await getItems({ search: term, top: 12 });
      for (const item of batch) {
        merged.set(item.number || item.id, item);
      }
    } catch (e) {
      logBcQueryWarning(`workflowItems search="${term}"`, e);
    }
  }

  return Array.from(merged.values()).slice(0, 24);
}

export async function queryBcSalesLinesForTerms(
  terms: ExtractedSearchTerms,
  relatedItemNos: string[] = [],
): Promise<{ lines: BCSalesLine[]; diagnostics: BcEvidenceFetchDiagnostics['strategies']['sales'] }> {
  const list = searchTermsList(terms);
  const merged = new Map<string, BCSalesLine>();
  const strategies: string[] = [];

  if (list.length > 0) {
    try {
      const batch = await querySalesWithFilter(buildLineOrFilter(list), 80);
      mergeSales(merged, batch);
      if (batch.length > 0) strategies.push(`odata_or_filter:${batch.length}`);
    } catch (e) {
      logBcQueryWarning('sales combined OR filter', e);
    }

    for (const term of list) {
      if (merged.size >= 80) break;
      const batch = await querySalesWithFilter(buildLineOrFilter([term]), 40);
      mergeSales(merged, batch);
      if (batch.length > 0) strategies.push(`odata_term:${term}:${batch.length}`);
    }
  }

  const itemNos = [...new Set(relatedItemNos.filter((n) => n && n !== '—'))].slice(0, 8);
  for (const itemNo of itemNos) {
    if (merged.size >= 80) break;
    const batch = await querySalesByItemNo(itemNo, 25);
    mergeSales(merged, batch);
    if (batch.length > 0) strategies.push(`item_no:${itemNo}:${batch.length}`);
  }

  if (merged.size === 0) {
    const recent = await querySalesRecent(120);
    const filtered = clientFilterSales(recent, terms);
    mergeSales(merged, filtered);
    strategies.push(`recent_client_filter:${filtered.length}/${recent.length}`);
  }

  return {
    lines: Array.from(merged.values()).slice(0, 80),
    diagnostics: strategies,
  };
}

export async function queryBcPurchaseLinesForTerms(
  terms: ExtractedSearchTerms,
  relatedItemNos: string[] = [],
): Promise<{ lines: BCPurchaseLine[]; diagnostics: BcEvidenceFetchDiagnostics['strategies']['purchases'] }> {
  const list = searchTermsList(terms);
  const merged = new Map<string, BCPurchaseLine>();
  const strategies: string[] = [];

  if (list.length > 0) {
    const batch = await queryPurchasesWithFilter(buildLineOrFilter(list), 24);
    mergePurchases(merged, batch);
    if (batch.length > 0) strategies.push(`odata_or_filter:${batch.length}`);

    for (const term of list) {
      if (merged.size >= 24) break;
      const termBatch = await queryPurchasesWithFilter(buildLineOrFilter([term]), 12);
      mergePurchases(merged, termBatch);
      if (termBatch.length > 0) strategies.push(`odata_term:${term}:${termBatch.length}`);
    }
  }

  const itemNos = [...new Set(relatedItemNos.filter((n) => n && n !== '—'))].slice(0, 8);
  for (const itemNo of itemNos) {
    if (merged.size >= 24) break;
    const batch = await queryPurchasesByItemNo(itemNo, 15);
    mergePurchases(merged, batch);
    if (batch.length > 0) strategies.push(`item_no:${itemNo}:${batch.length}`);
  }

  if (merged.size === 0) {
    const recent = await queryPurchasesRecent(80);
    const filtered = clientFilterPurchases(recent, terms);
    mergePurchases(merged, filtered);
    strategies.push(`recent_client_filter:${filtered.length}/${recent.length}`);
  }

  return {
    lines: Array.from(merged.values()).slice(0, 24),
    diagnostics: strategies,
  };
}
