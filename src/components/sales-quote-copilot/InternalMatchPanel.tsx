'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { InternalMatchBundle } from '@/lib/sales-quote-copilot/internal-match-types';
import type { MatchCandidate } from '@/lib/sales-quote-copilot/types';
import { confidenceTier, sourceBadgeLabel } from '@/lib/sales-quote-copilot/logic';
import { MAX_PANEL_MATCHES, MIN_AI_MATCHES } from '@/lib/sales-quote-copilot/match-ranking';
import {
  ChevronDown,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

const COLLAPSED_ROW_LIMIT = MIN_AI_MATCHES;

/** Fixed-layout data table: long text truncates; notes column wraps */
const DATA_TABLE_CLASS = 'table-fixed w-full min-w-[880px]';
const CELL_TRUNCATE = 'max-w-0 truncate overflow-hidden';
const CELL_NOTES =
  'align-top !whitespace-normal break-words text-[10px] leading-snug max-w-[11rem]';
const CELL_NUM = 'text-right tabular-nums shrink-0';

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground text-center py-4 text-xs">
        {label}
      </TableCell>
    </TableRow>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b text-xs font-semibold">
        {icon}
        {title}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function AiRankTable({
  matches,
  bestId,
  lineId,
  expanded,
  onSelectCandidate,
}: {
  matches: MatchCandidate[];
  bestId?: string;
  lineId: string;
  expanded: boolean;
  onSelectCandidate: (lineId: string, candidateId: string, selected: boolean) => void;
}) {
  const visibleMatches = expanded ? matches : matches.slice(0, COLLAPSED_ROW_LIMIT);
  const hiddenCount = expanded ? 0 : Math.max(0, matches.length - COLLAPSED_ROW_LIMIT);

  return (
    <Section
      title={`AI recommendations (confidence high → low · min ${MIN_AI_MATCHES})`}
      icon={<Sparkles className="h-3.5 w-3.5 text-amber-600" />}
    >
      <Table className={DATA_TABLE_CLASS}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] h-8 w-8 text-center">#</TableHead>
            <TableHead className="text-[10px] h-8 w-9 text-center">Select</TableHead>
            <TableHead className="text-[10px] h-8 w-[4.5rem]">Confidence</TableHead>
            <TableHead className="text-[10px] h-8 w-[5.5rem]">Source</TableHead>
            <TableHead className="text-[10px] h-8 w-[5.5rem]">Item No.</TableHead>
            <TableHead className="text-[10px] h-8 w-[26%]">Description</TableHead>
            <TableHead className="text-[10px] h-8 w-11 text-right">Stock</TableHead>
            <TableHead
              className="text-[10px] h-8 w-[4.5rem] text-right"
              title="BC Item Last Direct Cost"
            >
              Cost
            </TableHead>
            <TableHead className="text-[10px] h-8 w-[4.5rem] text-right">Sell</TableHead>
            <TableHead className="text-[10px] h-8 w-[14%]">Notes / risks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleMatches.length === 0 ? (
            <EmptyRow
              colSpan={10}
              label="No AI matches found. Expand BC details or refine the RFQ line."
            />
          ) : (
            visibleMatches.map((m, index) => {
              const isBest = bestId === m.id || index === 0;
              return (
                <TableRow
                  key={m.id}
                  className={`text-xs ${isBest ? 'bg-amber-50/90 dark:bg-amber-950/25' : ''} ${m.selected ? 'ring-1 ring-inset ring-primary/30' : ''}`}
                >
                  <TableCell className="py-2 font-mono text-muted-foreground text-center w-8">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-2 text-center w-9">
                    <Checkbox
                      checked={m.selected}
                      onCheckedChange={(checked) =>
                        onSelectCandidate(lineId, m.id, checked === true)
                      }
                      aria-label={`Select ${m.item_no}`}
                    />
                  </TableCell>
                  <TableCell className="py-2 align-top w-[4.5rem]">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span
                        className={`text-base font-bold tabular-nums leading-none ${
                          m.confidence_score >= 70
                            ? 'text-green-700'
                            : m.confidence_score >= 40
                              ? 'text-amber-700'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {m.confidence_score}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {confidenceTier(m.confidence_score)}
                        {isBest && (
                          <span className="ml-1 text-amber-700 font-medium">· Best</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 align-top w-[5.5rem]">
                    <Badge variant="outline" className="text-[10px] whitespace-normal">
                      {sourceBadgeLabel(m.source_type)}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="font-mono py-2 align-top w-[5.5rem] truncate"
                    title={m.item_no}
                  >
                    {m.item_no}
                  </TableCell>
                  <TableCell
                    className={`py-2 align-top ${CELL_TRUNCATE}`}
                    title={m.description}
                  >
                    {m.description}
                  </TableCell>
                  <TableCell className={`py-2 ${CELL_NUM} w-11`}>
                    {m.available_stock ?? '—'}
                  </TableCell>
                  <TableCell className={`py-2 ${CELL_NUM} w-[4.5rem]`}>
                    ${m.cost.toFixed(2)}
                  </TableCell>
                  <TableCell className={`py-2 ${CELL_NUM} w-[4.5rem]`}>
                    ${m.suggested_selling_price.toFixed(2)}
                  </TableCell>
                  <TableCell className={CELL_NOTES}>
                    <p className="text-muted-foreground">{m.confidence_reason}</p>
                    {(m.cost_source || m.price_source) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cost: {m.cost_source || '—'} · Price: {m.price_source || '—'}
                      </p>
                    )}
                    {(m.warnings ?? []).map((f) => (
                      <p key={f} className="text-amber-700 text-[10px] mt-0.5">
                        {f}
                      </p>
                    ))}
                    {m.risk_flags.map((f) => (
                      <p key={f} className="text-red-600 text-[10px] mt-0.5">
                        {f}
                      </p>
                    ))}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {!expanded && hiddenCount > 0 && (
        <p className="text-[10px] text-muted-foreground px-3 py-2 border-t">
          +{hiddenCount} more match{hiddenCount > 1 ? 'es' : ''} — expand BC details to view all
        </p>
      )}
    </Section>
  );
}

function MatchBundleCard({
  bundle,
  onSelectCandidate,
}: {
  bundle: InternalMatchBundle;
  onSelectCandidate: (lineId: string, candidateId: string, selected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const aiMatches = [...bundle.rankedCandidates].sort(
    (a, b) => b.confidence_score - a.confidence_score,
  );

  const dataSourceLabel =
    bundle.dataSource === 'business_central'
      ? 'BC live'
      : bundle.dataSource === 'mock'
        ? 'Demo data'
        : 'BC + demo fallback';

  return (
    <article className="grid grid-cols-1 lg:grid-cols-[minmax(140px,16%)_minmax(0,1fr)] gap-0 border rounded-xl overflow-hidden shadow-sm">
      <aside className="bg-slate-50 dark:bg-slate-900/50 border-b lg:border-b-0 lg:border-r p-3 flex flex-col gap-2.5 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Customer request
          </p>
          <p className="text-sm font-semibold leading-snug">{bundle.originalText}</p>
        </div>
        <dl className="text-xs space-y-1.5">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Qty</dt>
            <dd className="font-medium">
              {bundle.quantity} {bundle.uom}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{bundle.productType || '—'}</dd>
          </div>
          {bundle.specsSummary && (
            <div>
              <dt className="text-muted-foreground mb-0.5">Specs</dt>
              <dd className="text-foreground/90">{bundle.specsSummary}</dd>
            </div>
          )}
        </dl>
        <Badge variant="outline" className="w-fit text-[10px]">
          Source: {dataSourceLabel}
        </Badge>
      </aside>

      <div className="p-4 space-y-3 bg-card min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {expanded
              ? 'BC inventory, sales, and purchase details are shown below.'
              : `Showing top ${COLLAPSED_ROW_LIMIT} AI matches. Expand to review BC records.`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide BC details' : 'Expand BC details'}
            <ChevronDown
              className={`ml-1 h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        <AiRankTable
          matches={aiMatches}
          bestId={bundle.bestMatch?.id}
          lineId={bundle.lineId}
          expanded={expanded}
          onSelectCandidate={onSelectCandidate}
        />

        {expanded && (
          <div className="space-y-4 pt-1 border-t">
            <Section
              title={`BC Item Master (inventory · top ${MAX_PANEL_MATCHES} by relevance)`}
              icon={<Package className="h-3.5 w-3.5 text-blue-600" />}
            >
              <Table className={DATA_TABLE_CLASS}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] h-8 w-[5.5rem]">Item No.</TableHead>
                    <TableHead className="text-[10px] h-8 w-[32%]">Description</TableHead>
                    <TableHead className="text-[10px] h-8">Category</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Stock</TableHead>
                    <TableHead className="text-[10px] h-8 text-right" title="BC Item Last Direct Cost">
                      Last Direct Cost
                    </TableHead>
                    <TableHead className="text-[10px] h-8 text-right">List</TableHead>
                    <TableHead className="text-[10px] h-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.itemMaster.length === 0 ? (
                    <EmptyRow colSpan={7} label="No related items in Item List" />
                  ) : (
                    bundle.itemMaster.map((row) => (
                      <TableRow key={row.itemNo} className="text-xs">
                        <TableCell className="font-mono py-2">{row.itemNo}</TableCell>
                        <TableCell className={`py-2 ${CELL_TRUNCATE}`} title={row.description}>
                          {row.description}
                        </TableCell>
                        <TableCell className="py-2 truncate max-w-[6rem]">{row.category}</TableCell>
                        <TableCell className="text-right py-2">
                          {row.inventoryQty} {row.uom}
                        </TableCell>
                        <TableCell className="text-right py-2">${row.unitCost.toFixed(2)}</TableCell>
                        <TableCell className="text-right py-2">${row.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant="outline"
                            className={
                              row.inStock
                                ? 'text-green-700 border-green-300 bg-green-50'
                                : 'text-amber-700 border-amber-300 bg-amber-50'
                            }
                          >
                            {row.inStock ? 'In stock' : 'No stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Section>

            <Section
              title={`Past sales (Sales Lines · top ${MAX_PANEL_MATCHES} by relevance)`}
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
            >
              <Table className={DATA_TABLE_CLASS}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] h-8">Document</TableHead>
                    <TableHead className="text-[10px] h-8">Date</TableHead>
                    <TableHead className="text-[10px] h-8">Customer</TableHead>
                    <TableHead className="text-[10px] h-8">Item</TableHead>
                    <TableHead className="text-[10px] h-8 w-[24%]">Description</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Qty</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Unit price</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.salesHistory.length === 0 ? (
                    <EmptyRow colSpan={8} label="No related sales lines" />
                  ) : (
                    bundle.salesHistory.map((row, i) => (
                      <TableRow key={`${row.documentNo}-${i}`} className="text-xs">
                        <TableCell className="font-mono py-2">{row.documentNo}</TableCell>
                        <TableCell className="py-2">{row.date}</TableCell>
                        <TableCell className="py-2 max-w-[100px] truncate" title={row.customer}>
                          {row.customer}
                        </TableCell>
                        <TableCell className="font-mono py-2">{row.itemNo}</TableCell>
                        <TableCell className={`py-2 ${CELL_TRUNCATE}`} title={row.description}>
                          {row.description}
                        </TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>{row.quantity}</TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>
                          ${row.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>
                          ${row.lineAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Section>

            <Section
              title={`Past purchases (Purchase Lines · top ${MAX_PANEL_MATCHES} by relevance)`}
              icon={<ShoppingCart className="h-3.5 w-3.5 text-violet-600" />}
            >
              <Table className={DATA_TABLE_CLASS}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[10px] h-8">PO</TableHead>
                    <TableHead className="text-[10px] h-8">Date</TableHead>
                    <TableHead className="text-[10px] h-8">Vendor</TableHead>
                    <TableHead className="text-[10px] h-8">Item</TableHead>
                    <TableHead className="text-[10px] h-8 w-[24%]">Description</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Qty</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Cost</TableHead>
                    <TableHead className="text-[10px] h-8 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.purchaseHistory.length === 0 ? (
                    <EmptyRow colSpan={8} label="No related purchase lines" />
                  ) : (
                    bundle.purchaseHistory.map((row, i) => (
                      <TableRow key={`${row.documentNo}-${i}`} className="text-xs">
                        <TableCell className="font-mono py-2">{row.documentNo}</TableCell>
                        <TableCell className="py-2">{row.date}</TableCell>
                        <TableCell className="py-2 max-w-[120px] truncate" title={row.vendor}>
                          {row.vendor}
                        </TableCell>
                        <TableCell className="font-mono py-2">{row.itemNo}</TableCell>
                        <TableCell className={`py-2 ${CELL_TRUNCATE}`} title={row.description}>
                          {row.description}
                        </TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>{row.quantity}</TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>${row.unitCost.toFixed(2)}</TableCell>
                        <TableCell className={`py-2 ${CELL_NUM}`}>${row.lineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Section>
          </div>
        )}
      </div>
    </article>
  );
}

interface InternalMatchPanelProps {
  bundles: InternalMatchBundle[];
  loading?: boolean;
  onSelectCandidate: (lineId: string, candidateId: string, selected: boolean) => void;
}

export function InternalMatchPanel({
  bundles,
  loading,
  onSelectCandidate,
}: InternalMatchPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Querying BC and ranking AI matches…
      </div>
    );
  }

  if (!bundles.length) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No match data yet. Continue from Readiness Check.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {bundles.map((bundle) => (
        <MatchBundleCard key={bundle.lineId} bundle={bundle} onSelectCandidate={onSelectCandidate} />
      ))}
    </div>
  );
}
