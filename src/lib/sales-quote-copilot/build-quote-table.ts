import type { FinalQuoteLine, RequestedItem } from './types';

export interface QuoteTableRow {
  sn: number;
  modelPartNo: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  lineTotal: number;
  leadTime: string;
  remarks: string;
}

const TABLE_HEADER_MARKERS = [
  /\bS\/N\b/i,
  /\bMODEL\b/i,
  /\bPART\s*NO/i,
  /\bITEM\s*DESC/i,
  /\bQTY\b/i,
  /\bUOM\b/i,
];

/** True when the RFQ body likely used a tabular layout (HTML table or column headers). */
export function emailBodyLooksLikeTable(body: string): boolean {
  const text = body.trim();
  if (!text) return false;
  if (/<table[\s>]/i.test(text)) return true;

  const headerHits = TABLE_HEADER_MARKERS.filter((re) => re.test(text)).length;
  if (headerHits >= 3) return true;

  const lines = text.split(/\r?\n/);
  const tabRows = lines.filter((l) => (l.match(/\t/g) || []).length >= 3);
  if (tabRows.length >= 2) return true;

  const pipeRows = lines.filter((l) => (l.match(/\|/g) || []).length >= 4);
  if (pipeRows.length >= 2) return true;

  return false;
}

function extractPartNoFromText(text: string): string {
  const partMatch = text.match(/\b(?:part\s*no\.?|p\/n|model)\s*[:.]?\s*([A-Za-z0-9][\w./-]*)/i);
  if (partMatch) return partMatch[1];
  const codeMatch = text.match(/\b([A-Z]{2,4}[-]?\d{2,5}[A-Z0-9-]*)\b/);
  return codeMatch?.[1] || '';
}

export function quoteLinesToTableRows(
  lines: FinalQuoteLine[],
  rfqItems?: RequestedItem[],
): QuoteTableRow[] {
  return lines.map((line, index) => {
    const rfq = rfqItems?.find((item) => item.line_id === line.requested_item_id);
    const sourceText = rfq?.original_text || line.requested_label;
    const modelPart =
      extractPartNoFromText(sourceText) ||
      extractPartNoFromText(line.requested_label) ||
      line.item_no?.trim() ||
      '—';

    return {
      sn: index + 1,
      modelPartNo: modelPart,
      description: (line.requested_label || line.description).trim(),
      qty: line.quantity,
      uom: (line.uom || 'EA').toUpperCase(),
      unitPrice: line.final_price,
      lineTotal: line.final_price * line.quantity,
      leadTime: line.lead_time || '—',
      remarks: line.risk_flags.length ? line.risk_flags.join('; ') : '—',
    };
  });
}

function colWidth(values: string[], min: number): number {
  return Math.max(min, ...values.map((v) => v.length));
}

function padCell(value: string, width: number): string {
  if (value.length <= width) return value.padEnd(width);
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

/** Fixed-width plain-text table (readable in Outlook plain view). */
export function buildPlainTextQuoteTable(rows: QuoteTableRow[], currency = 'SGD'): string {
  const headers = [
    'S/N',
    'MODEL / PART NO.',
    'ITEM DESCRIPTION',
    'QTY',
    'UOM',
    `UNIT PRICE (${currency})`,
    `LINE TOTAL (${currency})`,
    'LEAD TIME',
  ];

  const dataRows = rows.map((r) => [
    String(r.sn),
    r.modelPartNo,
    r.description,
    String(r.qty),
    r.uom,
    r.unitPrice > 0 ? r.unitPrice.toFixed(2) : 'TBC',
    r.lineTotal > 0 ? r.lineTotal.toFixed(2) : 'TBC',
    r.leadTime,
  ]);

  const widths = headers.map((h, i) => {
    const colValues = [h, ...dataRows.map((row) => row[i])];
    const mins = [4, 12, 20, 4, 5, 14, 14, 10];
    return colWidth(colValues, mins[i]);
  });

  const sep = widths.map((w) => '-'.repeat(w)).join('-+-');
  const formatRow = (cells: string[]) => cells.map((c, i) => padCell(c, widths[i])).join(' | ');

  return [formatRow(headers), sep, ...dataRows.map(formatRow)].join('\n');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML table for multipart .eml (Outlook renders as real table). */
export function buildHtmlQuoteTable(rows: QuoteTableRow[], currency = 'SGD'): string {
  const th = (label: string) =>
    `<th style="border:1px solid #333;padding:6px 8px;background:#f0f0f0;font-size:11pt;text-align:left;white-space:nowrap;">${escapeHtml(label)}</th>`;
  const td = (value: string, align: 'left' | 'right' = 'left') =>
    `<td style="border:1px solid #333;padding:6px 8px;font-size:11pt;text-align:${align};vertical-align:top;">${escapeHtml(value)}</td>`;

  const headerRow = [
    th('S/N'),
    th('MODEL / PART NO.'),
    th('ITEM DESCRIPTION'),
    th('QTY'),
    th('UOM'),
    th(`UNIT PRICE (${currency})`),
    th(`LINE TOTAL (${currency})`),
    th('LEAD TIME'),
  ].join('');

  const bodyRows = rows
    .map((r) => {
      const unit = r.unitPrice > 0 ? r.unitPrice.toFixed(2) : 'TBC';
      const total = r.lineTotal > 0 ? r.lineTotal.toFixed(2) : 'TBC';
      return `<tr>
${td(String(r.sn))}
${td(r.modelPartNo)}
${td(r.description)}
${td(String(r.qty), 'right')}
${td(r.uom)}
${td(unit, 'right')}
${td(total, 'right')}
${td(r.leadTime)}
</tr>`;
    })
    .join('');

  return `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:960px;font-family:Calibri,Arial,sans-serif;">
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>`;
}

const TABLE_PLACEHOLDER = '[QUOTE_TABLE]';

/** Editable row in Quote Builder (maps to email table columns). */
export interface EditableQuoteRow {
  lineId: string;
  sn: number;
  modelPartNo: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  leadTime: string;
}

export function editableRowsFromQuoteLines(
  lines: FinalQuoteLine[],
  rfqItems?: RequestedItem[],
): EditableQuoteRow[] {
  return quoteLinesToTableRows(lines, rfqItems).map((row, i) => ({
    lineId: lines[i]?.id ?? `line-${i}`,
    sn: row.sn,
    modelPartNo: row.modelPartNo,
    description: row.description,
    qty: row.qty,
    uom: row.uom,
    unitPrice: row.unitPrice,
    leadTime: row.leadTime,
  }));
}

export function applyEditableRowsToQuoteLines(
  draft: EditableQuoteRow[],
  lines: FinalQuoteLine[],
): FinalQuoteLine[] {
  return lines.map((line, i) => {
    const row = draft[i];
    if (!row) return line;
    const unitPrice = Math.max(0, Number(row.unitPrice) || 0);
    const qty = Math.max(0, Number(row.qty) || 0);
    return {
      ...line,
      item_no: row.modelPartNo && row.modelPartNo !== '—' ? row.modelPartNo.trim() : line.item_no,
      requested_label: row.description.trim() || line.requested_label,
      quantity: qty,
      uom: (row.uom || line.uom || 'EA').trim().toUpperCase(),
      final_price: unitPrice,
      selling_price: unitPrice,
      lead_time: row.leadTime.trim() || line.lead_time,
    };
  });
}

export function tableRowsFromEditableDraft(draft: EditableQuoteRow[]): QuoteTableRow[] {
  return draft.map((row) => ({
    sn: row.sn,
    modelPartNo: row.modelPartNo,
    description: row.description,
    qty: row.qty,
    uom: row.uom.toUpperCase(),
    unitPrice: row.unitPrice,
    lineTotal: row.qty * row.unitPrice,
    leadTime: row.leadTime,
    remarks: '—',
  }));
}

function updateGrandTotalInBody(body: string, total: number, currency: string): string {
  const formatted = `${currency} ${total.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const replaced = body.replace(
    /(grand\s*total|quotation\s*total|total\s*amount)\s*[:：]?\s*((?:SGD|USD)\s*)?[\d,]+\.?\d*/gi,
    `$1: ${formatted}`,
  );
  if (replaced !== body) return replaced;
  if (/\bgrand\s*total\b/i.test(body)) return body;
  return `${body.trim()}\n\nGrand Total: ${formatted}`;
}

/** Replace quotation table in existing email body and refresh grand total. */
export function refreshEmailWithQuoteTable(
  existingBody: string,
  lines: FinalQuoteLine[],
  rfqItems?: RequestedItem[],
  currency = 'SGD',
): string {
  return ensureQuotedEmailBody({ aiReply: existingBody, lines, rfqItems, currency }).plain;
}

/** True when any line has no sell price to put in the customer email. */
export function quoteLinesMissingPrices(lines: FinalQuoteLine[]): boolean {
  return lines.length === 0 || lines.some((l) => !l.final_price || l.final_price <= 0);
}

function emailContainsQuoteTable(body: string, tablePlain: string): boolean {
  const header = tablePlain.split('\n')[0]?.trim();
  if (!header) return false;
  return body.includes(header) || /\bUNIT PRICE\b/i.test(body);
}

function defaultQuoteFooter(currency: string, grandTotal: number): string {
  return [
    `Grand Total: ${currency} ${grandTotal.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    'Validity: 30 days from date of quote.',
    'Payment terms: As per account.',
    'Delivery: Ex stock, lead time as per table.',
    '',
    'Thank you and best regards,',
    'Allinton Engineering & Trading Pte Ltd',
    'Sales Team',
  ].join('\n');
}

/**
 * Build customer email: AI/customer-style prose + mandatory quotation table with prices from lines.
 * Prices always come from quotation lines — never from AI invention.
 */
export function ensureQuotedEmailBody(options: {
  aiReply?: string;
  lines: FinalQuoteLine[];
  rfqItems?: RequestedItem[];
  currency?: string;
}): { plain: string; htmlBody?: string; missingPrices: boolean; grandTotal: number } {
  const currency = options.currency || 'SGD';
  const tableRows = quoteLinesToTableRows(options.lines, options.rfqItems);
  const tablePlain = buildPlainTextQuoteTable(tableRows, currency);
  const tableHtml = buildHtmlQuoteTable(tableRows, currency);
  const grandTotal = options.lines.reduce((s, l) => s + l.final_price * l.quantity, 0);
  const missingPrices = quoteLinesMissingPrices(options.lines);

  const ai = options.aiReply?.trim();
  let plain: string;

  if (ai) {
    plain = mergeReplyWithQuoteTable(ai, tablePlain);
    plain = updateGrandTotalInBody(plain, grandTotal, currency);
    if (!emailContainsQuoteTable(plain, tablePlain)) {
      const intro =
        ai.split('\n\n').find((p) => p.trim() && !/^(validity|payment|grand total)/i.test(p)) ||
        ai.split('\n')[0] ||
        'Dear Customer,';
      plain = [intro.trim(), '', tablePlain, '', defaultQuoteFooter(currency, grandTotal)].join('\n');
    }
  } else {
    plain = ['Dear Customer,', '', 'Please find our quotation below:', '', tablePlain, '', defaultQuoteFooter(currency, grandTotal)].join(
      '\n',
    );
  }

  const tableStart = plain.indexOf(tablePlain.split('\n')[0]);
  const introPlain = tableStart > 0 ? plain.slice(0, tableStart).trim() : 'Dear Customer,';
  const footerPlain = tableStart > 0 ? plain.slice(tableStart + tablePlain.length).trim() : defaultQuoteFooter(currency, grandTotal);

  const htmlBody = wrapHtmlEmailBody({
    greetingHtml: `<p>${plainToSimpleHtml(introPlain)}</p>`,
    introHtml: '',
    tableHtml,
    footerHtml: `<p style="margin-top:16px;">${plainToSimpleHtml(footerPlain)}</p>`,
  });

  return { plain, htmlBody, missingPrices, grandTotal };
}

export function mergeReplyWithQuoteTable(aiBody: string, tablePlain: string): string {
  const trimmed = aiBody.trim();
  if (trimmed.includes(TABLE_PLACEHOLDER)) {
    return trimmed.replace(TABLE_PLACEHOLDER, tablePlain);
  }

  // Strip pipe-style pseudo tables the model may have invented
  const withoutPipeTable = trimmed
    .split('\n')
    .filter((line) => {
      const pipes = (line.match(/\|/g) || []).length;
      if (pipes >= 4 && /\bS\/N\b|\bUNIT PRICE\b|\bLINE TOTAL\b/i.test(line)) return false;
      if (pipes >= 5 && /^\s*\d+\s*\|/.test(line)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const introEnd = withoutPipeTable.search(
    /\n\s*(?:\d+\.|•|[-*])\s|(?:grand\s*total|quotation\s*total|total\s*amount|validity|payment)/i,
  );
  const termsStart = withoutPipeTable.search(/\n\s*(?:grand\s*total|validity|payment\s*terms)/i);

  if (termsStart > 0) {
    const intro = withoutPipeTable.slice(0, termsStart).trim();
    const footer = withoutPipeTable.slice(termsStart).trim();
    return [intro, '', tablePlain, '', footer].join('\n');
  }

  if (introEnd > 80) {
    const intro = withoutPipeTable.slice(0, introEnd).trim();
    const footer = withoutPipeTable.slice(introEnd).trim();
    return [intro, '', tablePlain, footer ? `\n${footer}` : ''].filter(Boolean).join('\n');
  }

  return [withoutPipeTable, '', tablePlain].join('\n');
}

export function wrapHtmlEmailBody(parts: {
  greetingHtml: string;
  introHtml: string;
  tableHtml: string;
  footerHtml: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000;">
${parts.greetingHtml}
${parts.introHtml}
${parts.tableHtml}
${parts.footerHtml}
</body></html>`;
}

export function plainToSimpleHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>\n');
}

export { TABLE_PLACEHOLDER };
