'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildSupplierRfqDraft,
  DEMO_SUPPLIERS,
  recommendSuppliers,
} from '@/lib/sales-quote-copilot/demo-data';
import { describeSourcingReason, getSelectedMatch } from '@/lib/sales-quote-copilot/line-quote-status';
import type { MatchCandidate, RequestedItem, SupplierQuote } from '@/lib/sales-quote-copilot/types';
import { WebSearchResultsPanel } from '@/components/sales-quote-copilot/WebSearchResultsPanel';
import type { WebSearchResponseData } from '@/lib/web-search-types';
import { Globe, Loader2, Mail, Package, Search, Users } from 'lucide-react';

interface WebSearchState {
  loading: boolean;
  data?: WebSearchResponseData;
  error?: string;
}

interface SupplierSourcingPanelProps {
  items: RequestedItem[];
  matchMap: Record<string, MatchCandidate[]>;
  supplierQuotes: SupplierQuote[];
  sourcingLineIds: string[];
  internalReadyLineIds: string[];
  onAddSupplierQuote: (quote: SupplierQuote) => void;
  onUpdateSupplierQuote: (id: string, patch: Partial<SupplierQuote>) => void;
  onRemoveSupplierQuote: (id: string) => void;
  onRfqDraft: (draft: string) => void;
}

export function SupplierSourcingPanel({
  items,
  matchMap,
  supplierQuotes,
  sourcingLineIds,
  internalReadyLineIds,
  onAddSupplierQuote,
  onUpdateSupplierQuote,
  onRemoveSupplierQuote,
  onRfqDraft,
}: SupplierSourcingPanelProps) {
  const [webByLine, setWebByLine] = useState<Record<string, WebSearchState>>({});

  const itemById = (id: string) => items.find((i) => i.line_id === id);

  const runWebSearch = async (item: RequestedItem) => {
    setWebByLine((prev) => ({ ...prev, [item.line_id]: { loading: true } }));
    try {
      const res = await fetch('/api/erp/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: item.original_text,
          context: `Qty ${item.quantity} ${item.uom}, type: ${item.product_type}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Web search failed');
      const payload = json.data as WebSearchResponseData | undefined;
      if (!payload) throw new Error('No search results returned');
      setWebByLine((prev) => ({
        ...prev,
        [item.line_id]: { loading: false, data: payload },
      }));
    } catch (e) {
      setWebByLine((prev) => ({
        ...prev,
        [item.line_id]: {
          loading: false,
          error: e instanceof Error ? e.message : 'Web search failed',
        },
      }));
    }
  };

  return (
    <div className="space-y-6">
      {internalReadyLineIds.length > 0 && (
        <section className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Ready from Internal Match</h3>
            <Badge variant="secondary" className="text-xs font-normal">
              {internalReadyLineIds.length} line{internalReadyLineIds.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            BC match selected — included in Quote Builder. Change selection in Internal Match if needed.
          </p>
          <ul className="space-y-2">
            {internalReadyLineIds.map((lineId) => {
              const item = itemById(lineId);
              const sel = getSelectedMatch(lineId, matchMap);
              if (!item) return null;
              return (
                <li
                  key={lineId}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.original_text}</p>
                    {sel && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sel.item_no} · {sel.description} · S${sel.suggested_selling_price.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    BC selected
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Needs supplier / web sourcing</h3>
          {sourcingLineIds.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              {sourcingLineIds.length} remaining
            </Badge>
          )}
        </div>

        {sourcingLineIds.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            All active lines are covered. Open Quote Builder to combine BC and supplier lines.
          </p>
        ) : (
          <div className="space-y-4">
            {sourcingLineIds.map((lineId) => {
              const item = itemById(lineId);
              if (!item) return null;
              const suppliers = recommendSuppliers(item.product_type);
              const existing = supplierQuotes.filter((q) => q.requested_item_id === lineId);
              const web = webByLine[lineId];

              return (
                <article
                  key={lineId}
                  className="rounded-xl border bg-card shadow-sm p-4 space-y-4"
                >
                  <div>
                    <p className="font-medium text-sm">{item.original_text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.quantity} {item.uom} · {describeSourcingReason(item, matchMap)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={web?.data ? 'secondary' : 'default'}
                      size="sm"
                      className="h-8 text-xs"
                      disabled={web?.loading}
                      onClick={() => runWebSearch(item)}
                    >
                      {web?.loading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : web?.data ? (
                        <Search className="h-3 w-3 mr-1" />
                      ) : (
                        <Globe className="h-3 w-3 mr-1" />
                      )}
                      {web?.loading
                        ? 'Searching (SG first)…'
                        : web?.data
                          ? 'Refresh web search'
                          : 'Web search (Singapore)'}
                    </Button>
                    {suppliers[0] && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          const specs = Object.values(item.specs).filter(Boolean).join(', ');
                          onRfqDraft(
                            buildSupplierRfqDraft(suppliers[0].name, [
                              {
                                name: item.normalized_name || item.original_text,
                                qty: item.quantity,
                                specs,
                              },
                            ]),
                          );
                        }}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Draft RFQ to {suppliers[0].name}
                      </Button>
                    )}
                  </div>

                  {web?.data && <WebSearchResultsPanel data={web.data} />}
                  {web?.error && (
                    <p className="text-xs text-destructive rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                      {web.error}
                    </p>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recommended suppliers</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {suppliers.map((sup) => (
                        <div key={sup.id} className="rounded-md border p-3 text-xs">
                          <p className="font-medium">{sup.name}</p>
                          <p className="text-muted-foreground mt-1">{sup.email}</p>
                          <p className="text-muted-foreground">Lead: {sup.typical_lead_time}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="mt-2 h-7 text-xs w-full"
                            onClick={() =>
                              onAddSupplierQuote({
                                id: `sq-${lineId}-${sup.id}-${Date.now()}`,
                                requested_item_id: lineId,
                                supplier_id: sup.id,
                                supplier_name: sup.name,
                                supplier_price: 0,
                                currency: 'SGD',
                                lead_time: sup.typical_lead_time,
                                moq: sup.moq,
                                validity_date: '',
                                notes: '',
                              })
                            }
                          >
                            Add quote row
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {existing.length > 0 && (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-xs font-medium">Supplier quotes (saved for Quote Builder)</p>
                      {existing.map((q) => (
                        <div key={q.id} className="grid gap-2 sm:grid-cols-4 items-end">
                          <div className="sm:col-span-2">
                            <Label className="text-[10px]">Supplier</Label>
                            <Input
                              className="h-8 text-xs"
                              value={q.supplier_name}
                              onChange={(e) =>
                                onUpdateSupplierQuote(q.id, { supplier_name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Unit cost (SGD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 text-xs"
                              value={q.supplier_price || ''}
                              onChange={(e) =>
                                onUpdateSupplierQuote(q.id, {
                                  supplier_price: parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive"
                            onClick={() => onRemoveSupplierQuote(q.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
