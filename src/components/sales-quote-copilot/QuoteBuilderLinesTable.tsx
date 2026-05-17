'use client';

import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EditableQuoteRow } from '@/lib/sales-quote-copilot/build-quote-table';
import type { FinalQuoteLine } from '@/lib/sales-quote-copilot/types';
import { RotateCcw, Check } from 'lucide-react';

const TABLE_CLASS = 'table-fixed w-full min-w-[980px]';
const CELL_NUM = 'text-right tabular-nums whitespace-nowrap';
const INPUT_CLASS = 'h-8 text-xs px-2';

function formatMoney(n: number, currency: string) {
  if (n <= 0) return null;
  return `${currency} ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface QuoteBuilderLinesTableProps {
  draftRows: EditableQuoteRow[];
  quoteLines: FinalQuoteLine[];
  currency?: string;
  isDirty?: boolean;
  onDraftChange: (rows: EditableQuoteRow[]) => void;
  onApply: () => void;
  onRevert: () => void;
}

export function QuoteBuilderLinesTable({
  draftRows,
  quoteLines,
  currency = 'SGD',
  isDirty = false,
  onDraftChange,
  onApply,
  onRevert,
}: QuoteBuilderLinesTableProps) {
  const grandTotal = draftRows.reduce((sum, row) => sum + row.qty * row.unitPrice, 0);

  const patchRow = (index: number, patch: Partial<EditableQuoteRow>) => {
    onDraftChange(draftRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="rounded-md border overflow-hidden bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="text-xs font-semibold text-muted-foreground">
          Quotation lines — editable · same columns as customer email
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Unsaved changes
            </span>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!isDirty} onClick={onRevert}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Revert
          </Button>
          <Button type="button" size="sm" className="h-7 text-xs" disabled={!isDirty} onClick={onApply}>
            <Check className="h-3 w-3 mr-1" />
            Apply to email
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className={TABLE_CLASS}>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              <TableHead className="w-9 text-[11px] font-semibold">S/N</TableHead>
              <TableHead className="w-[7.5rem] text-[11px] font-semibold">Model / Part No.</TableHead>
              <TableHead className="text-[11px] font-semibold min-w-[12rem]">Item description</TableHead>
              <TableHead className="w-14 text-[11px] font-semibold text-right">Qty</TableHead>
              <TableHead className="w-14 text-[11px] font-semibold text-center">UOM</TableHead>
              <TableHead className="w-[5.5rem] text-[11px] font-semibold text-right">Unit price</TableHead>
              <TableHead className="w-[5.5rem] text-[11px] font-semibold text-right">Line total</TableHead>
              <TableHead className="w-[5.5rem] text-[11px] font-semibold">Lead time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftRows.map((row, index) => {
              const line = quoteLines[index];
              const lineTotal = row.qty * row.unitPrice;
              return (
                <Fragment key={row.lineId}>
                  <TableRow className="text-xs align-top hover:bg-muted/20">
                    <TableCell className="font-medium tabular-nums py-2">{row.sn}</TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        className={`${INPUT_CLASS} font-mono`}
                        value={row.modelPartNo}
                        onChange={(e) => patchRow(index, { modelPartNo: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="py-1.5 min-w-0">
                      <Input
                        className={`${INPUT_CLASS} w-full`}
                        value={row.description}
                        onChange={(e) => patchRow(index, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        min={0}
                        className={`${INPUT_CLASS} ${CELL_NUM} w-14 ml-auto`}
                        value={row.qty || ''}
                        onChange={(e) => patchRow(index, { qty: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        className={`${INPUT_CLASS} w-14 text-center uppercase`}
                        value={row.uom}
                        onChange={(e) => patchRow(index, { uom: e.target.value.toUpperCase() })}
                      />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className={`${INPUT_CLASS} ${CELL_NUM} w-[5.5rem] ml-auto`}
                        value={row.unitPrice || ''}
                        onChange={(e) => patchRow(index, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell className={`py-2.5 ${CELL_NUM} font-medium`}>
                      {lineTotal > 0 ? formatMoney(lineTotal, currency) : <span className="text-amber-700">TBC</span>}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Input
                        className={`${INPUT_CLASS} w-[5.5rem]`}
                        value={row.leadTime}
                        onChange={(e) => patchRow(index, { leadTime: e.target.value })}
                      />
                    </TableCell>
                  </TableRow>
                  {line && (
                    <TableRow key={`${row.lineId}-meta`} className="border-t-0 hover:bg-transparent bg-muted/10">
                      <TableCell colSpan={8} className="py-1.5 px-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>
                            BC: <span className="font-mono text-foreground">{line.item_no || '—'}</span>
                            {line.description && line.description !== row.description ? (
                              <span className="ml-1 truncate max-w-[200px] inline-block align-bottom" title={line.description}>
                                · {line.description}
                              </span>
                            ) : null}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal">
                            {line.source_label}
                          </Badge>
                          {line.risk_flags.length > 0 ? (
                            <span className="text-amber-700">{line.risk_flags.join(' · ')}</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableCell colSpan={6} className="text-right text-xs font-semibold py-2.5">
                Grand total
              </TableCell>
              <TableCell className={`${CELL_NUM} text-xs font-semibold py-2.5`}>
                {grandTotal > 0 ? formatMoney(grandTotal, currency) : <span className="text-amber-700">TBC</span>}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
