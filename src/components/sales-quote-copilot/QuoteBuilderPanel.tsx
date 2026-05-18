'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { CustomerEmail } from '@/lib/mock-data';
import { QuoteBuilderLinesTable } from '@/components/sales-quote-copilot/QuoteBuilderLinesTable';
import { quoteLinesForEmailApi } from '@/lib/sales-quote-copilot/build-quote-email';
import {
  applyEditableRowsToQuoteLines,
  buildHtmlQuoteTable,
  editableRowsFromQuoteLines,
  ensureQuotedEmailBody,
  quoteLinesMissingPrices,
  tableRowsFromEditableDraft,
  type EditableQuoteRow,
} from '@/lib/sales-quote-copilot/build-quote-table';
import type { FinalQuoteLine, RfqExtraction } from '@/lib/sales-quote-copilot/types';
import { readApiErrorMessage } from '@/lib/api-error';
import { buildEmlFile, defaultQuotationFrom, downloadEmlInBrowser, emlFilename } from '@/lib/build-eml';
import { Copy, Check, Loader2, Mail, Sparkles, Download } from 'lucide-react';

type QuotationEmail = CustomerEmail & { messageId?: string };

interface QuoteBuilderPanelProps {
  quoteLines: FinalQuoteLine[];
  rfq: RfqExtraction | null;
  selectedEmail: QuotationEmail | null;
  selectedMatchCount: number;
  onQuoteLinesChange?: (lines: FinalQuoteLine[]) => void;
}

function rowsSignature(rows: EditableQuoteRow[]): string {
  return JSON.stringify(rows);
}

export function QuoteBuilderPanel({
  quoteLines,
  rfq,
  selectedEmail,
  selectedMatchCount,
  onQuoteLinesChange,
}: QuoteBuilderPanelProps) {
  const [customerReply, setCustomerReply] = useState('');
  const [replyHtmlBody, setReplyHtmlBody] = useState<string | undefined>();
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoReplyKeyRef = useRef<string | null>(null);

  const [workingLines, setWorkingLines] = useState<FinalQuoteLine[]>(quoteLines);
  const [draftRows, setDraftRows] = useState<EditableQuoteRow[]>(() =>
    editableRowsFromQuoteLines(quoteLines, rfq?.items),
  );
  const [appliedSnapshot, setAppliedSnapshot] = useState(() =>
    rowsSignature(editableRowsFromQuoteLines(quoteLines, rfq?.items)),
  );

  const quoteLinesKey = quoteLines.map((l) => l.id).join(',');

  useEffect(() => {
    setWorkingLines(quoteLines);
    const rows = editableRowsFromQuoteLines(quoteLines, rfq?.items);
    setDraftRows(rows);
    setAppliedSnapshot(rowsSignature(rows));
  }, [quoteLinesKey, rfq?.items]);

  const isDirty = rowsSignature(draftRows) !== appliedSnapshot;

  const formatMoney = (n: number) =>
    `SGD ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const grandTotal = draftRows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const hasOriginalEmail = Boolean(selectedEmail?.body?.trim());
  const hasMissingPrices = quoteLinesMissingPrices(
    applyEditableRowsToQuoteLines(draftRows, workingLines),
  );

  const linesForEmail = useCallback(
    () => applyEditableRowsToQuoteLines(draftRows, workingLines),
    [draftRows, workingLines],
  );

  const syncEmailFromLines = useCallback(
    (lines: FinalQuoteLine[], existingBody?: string) => {
      const { plain, htmlBody, missingPrices } = ensureQuotedEmailBody({
        aiReply: existingBody?.trim() || undefined,
        lines,
        rfqItems: rfq?.items,
        currency: 'SGD',
      });
      setCustomerReply(plain);
      setReplyHtmlBody(htmlBody);
      if (missingPrices) {
        setReplyNotice('部分行缺少单价：请在上方 Quotation lines 填写 Unit price，然后点击 Apply to email。');
      }
      return plain;
    },
    [rfq?.items],
  );

  const rfqLinesForApi = useCallback(() => {
    if (!rfq?.items?.length) return undefined;
    return rfq.items.map((item) => ({
      lineId: item.line_id,
      originalText: item.original_text || item.normalized_name || item.line_id,
      quantity: item.quantity,
      uom: item.uom,
    }));
  }, [rfq]);

  const generateAiReply = useCallback(async () => {
    const lines = linesForEmail();
    if (!lines.length) return;

    if (quoteLinesMissingPrices(lines)) {
      syncEmailFromLines(lines, customerReply || undefined);
      setReplyNotice('请先在上方表格为每一行填写 Unit price，再生成客户邮件。');
      return;
    }

    if (!hasOriginalEmail) {
      syncEmailFromLines(lines);
      setReplyNotice(null);
      return;
    }

    setReplyLoading(true);
    setReplyNotice(null);
    try {
      const emailBody = selectedEmail?.body?.trim() || '';
      const res = await fetch('/api/ai/generate-email-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalEmail: {
            from: selectedEmail?.from || selectedEmail?.fromName || rfq?.customer.email || 'Customer',
            subject: selectedEmail?.subject || 'Quotation',
            body: emailBody,
          },
          customerInfo: {
            name: rfq?.customer.name || selectedEmail?.fromName || 'Customer',
            company: rfq?.customer.company || '',
          },
          quoteLines: quoteLinesForEmailApi(lines),
          rfqLines: rfqLinesForApi(),
          currency: 'SGD',
          totals: {
            totalCost: lines.reduce((s, l) => s + l.cost * l.quantity, 0),
            totalList: lines.reduce((s, l) => s + l.final_price * l.quantity, 0),
            totalMargin: lines.reduce((s, l) => s + (l.final_price - l.cost) * l.quantity, 0),
          },
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { missingPrices?: boolean };
        if (errBody.missingPrices) {
          syncEmailFromLines(lines, customerReply || undefined);
          setReplyNotice('请先在上方表格为每一行填写 Unit price。');
          return;
        }
        throw new Error(await readApiErrorMessage(res, 'Failed to generate reply'));
      }
      const data = await res.json();
      const { plain, htmlBody, missingPrices } = ensureQuotedEmailBody({
        aiReply: data.reply,
        lines,
        rfqItems: rfq?.items,
        currency: 'SGD',
      });
      setCustomerReply(plain);
      setReplyHtmlBody(htmlBody || data.htmlBody);
      setReplyNotice(
        missingPrices
          ? '邮件已生成，但部分行仍缺单价 — 请在表格中补全后点击 Apply to email。'
          : '已按客户邮件风格生成回复，报价表价格来自上方 Quotation lines。',
      );
    } catch (err) {
      setReplyNotice(
        err instanceof Error ? err.message : 'AI 不可用 — 已插入上方表格中的报价。',
      );
      syncEmailFromLines(lines, customerReply || undefined);
    } finally {
      setReplyLoading(false);
    }
  }, [selectedEmail, rfq, rfqLinesForApi, syncEmailFromLines, linesForEmail, hasOriginalEmail, customerReply]);

  useEffect(() => {
    if (!workingLines.length) {
      setCustomerReply('');
      setReplyHtmlBody(undefined);
      autoReplyKeyRef.current = null;
      return;
    }

    const key = `${selectedEmail?.id ?? 'none'}|${workingLines.map((l) => l.id).join(',')}`;
    if (autoReplyKeyRef.current === key) return;
    autoReplyKeyRef.current = key;

    if (hasOriginalEmail) {
      void generateAiReply();
    } else {
      syncEmailFromLines(linesForEmail());
      if (!quoteLinesMissingPrices(linesForEmail())) {
        setReplyNotice(null);
      }
    }
  }, [workingLines, selectedEmail?.id, hasOriginalEmail, generateAiReply, syncEmailFromLines, linesForEmail]);

  const handleApplyToEmail = useCallback(() => {
    const updated = applyEditableRowsToQuoteLines(draftRows, workingLines);
    setWorkingLines(updated);
    onQuoteLinesChange?.(updated);
    setAppliedSnapshot(rowsSignature(draftRows));

    if (quoteLinesMissingPrices(updated)) {
      syncEmailFromLines(updated, customerReply);
      setReplyNotice('部分行缺少单价，请填写 Unit price 后再 Apply to email。');
      return;
    }

    syncEmailFromLines(updated, customerReply);
    setReplyNotice('');
    autoReplyKeyRef.current = `${selectedEmail?.id ?? 'none'}|${updated.map((l) => l.id).join(',')}`;
  }, [
    draftRows,
    workingLines,
    customerReply,
    onQuoteLinesChange,
    syncEmailFromLines,
    selectedEmail?.id,
  ]);

  const handleRevertDraft = useCallback(() => {
    const rows = editableRowsFromQuoteLines(workingLines, rfq?.items);
    setDraftRows(rows);
    setAppliedSnapshot(rowsSignature(rows));
  }, [workingLines, rfq?.items]);

  const previewTableHtml = useMemo(
    () => buildHtmlQuoteTable(tableRowsFromEditableDraft(draftRows), 'SGD'),
    [draftRows],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(customerReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadEml = () => {
    if (!customerReply.trim() || hasMissingPrices) return;
    const from = defaultQuotationFrom();
    const toEmail = selectedEmail?.from || rfq?.customer.email || '';
    const toName = rfq?.customer.name || selectedEmail?.fromName;
    const subject = selectedEmail?.subject || 'Quotation';

    const eml = buildEmlFile({
      fromName: from.name,
      fromEmail: from.email,
      toEmail,
      toName,
      subject,
      body: customerReply,
      htmlBody: replyHtmlBody,
      inReplyTo: selectedEmail?.messageId,
    });

    downloadEmlInBrowser(eml, emlFilename(subject));
  };

  if (quoteLines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
        <p className="text-sm font-medium">No quote lines yet</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Select lines in <strong>Internal Match</strong> (BC) and/or add supplier unit costs in{' '}
          <strong>Supplier Sourcing</strong>. {selectedMatchCount} line
          {selectedMatchCount === 1 ? ' is' : 's are'} ready when priced.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Showing {quoteLines.length} of {selectedMatchCount} quote-ready line
          {selectedMatchCount === 1 ? '' : 's'} · Total{' '}
          {grandTotal > 0 ? formatMoney(grandTotal) : '— (fill Unit price in every row)'}
          {isDirty ? ' · edit table then click Apply to email' : ''}
        </p>
        {hasMissingPrices && (
          <p className="text-xs text-amber-700 w-full">
            客户邮件必须包含报价：请为每一行填写 Unit price，然后点击 Apply to email（或 Regenerate）。
          </p>
        )}
        {quoteLines.length < selectedMatchCount && (
          <p className="text-xs text-amber-700">
            {selectedMatchCount - quoteLines.length} line(s) still need a BC selection or supplier cost.
          </p>
        )}
      </div>

      <QuoteBuilderLinesTable
        draftRows={draftRows}
        quoteLines={workingLines}
        isDirty={isDirty}
        onDraftChange={setDraftRows}
        onApply={handleApplyToEmail}
        onRevert={handleRevertDraft}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold">Customer quotation email</h3>
            {replyLoading && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Matching customer email style…
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                syncEmailFromLines(linesForEmail(), customerReply);
                setAppliedSnapshot(rowsSignature(draftRows));
              }}
            >
              Reset template
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={replyLoading}
              onClick={() => void generateAiReply()}
            >
              {replyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {hasOriginalEmail ? 'Regenerate in customer style' : 'Generate with AI'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={!customerReply || replyLoading}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Copy
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleDownloadEml}
              disabled={!customerReply.trim() || replyLoading || hasMissingPrices}
            >
              <Download className="h-4 w-4 mr-1" />
              Download .eml
            </Button>
          </div>
        </div>
        {replyNotice && (
          <p className={`text-xs ${hasMissingPrices ? 'text-amber-700' : 'text-emerald-700'}`}>{replyNotice}</p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {hasOriginalEmail
            ? 'AI mirrors the customer RFQ style; unit prices and line totals always come from the Quotation lines table above (never empty).'
            : 'Fill all Unit prices above, then Apply to email. Upload an .eml RFQ for customer-style greetings via AI.'}
        </p>
        {customerReply && !hasMissingPrices && (
          <div className="rounded-md border overflow-hidden">
            <div className="px-3 py-1.5 border-b bg-muted/30 text-[10px] text-muted-foreground">
              Email table preview {isDirty ? '(pending — click Apply to email)' : '(synced)'}
            </div>
            <div className="overflow-x-auto p-3 bg-muted/5">
              <div
                className="text-xs [&_table]:w-full"
                dangerouslySetInnerHTML={{ __html: previewTableHtml }}
              />
            </div>
          </div>
        )}
        <Textarea
          className="min-h-[220px] text-sm font-mono"
          value={customerReply}
          onChange={(e) => setCustomerReply(e.target.value)}
          placeholder={replyLoading ? 'Generating reply…' : undefined}
          disabled={replyLoading && !customerReply}
        />
      </section>
    </div>
  );
}
