import type { FinalQuoteLine, RequestedItem } from './types';
import {
  buildPlainTextQuoteTable,
  emailBodyLooksLikeTable,
  quoteLinesToTableRows,
} from './build-quote-table';

export interface QuoteEmailInput {
  originalEmail: { from: string; fromName?: string; subject: string; body: string };
  customerName: string;
  company: string;
  quoteLines: FinalQuoteLine[];
  rfqItems?: RequestedItem[];
  currency?: string;
}

function detectListStyle(body: string): 'bullet' | 'numbered' | 'plain' {
  if (/^\s*[•●·▪-]\s/m.test(body) || body.includes('• ')) return 'bullet';
  if (/^\s*\d+[.)]\s/m.test(body)) return 'numbered';
  return 'plain';
}

function detectGreeting(body: string): string {
  const m = body.match(/^(dear\s+[^,\n]+,?)/im);
  if (m) return m[1].trim();
  return 'Dear Sir/Madam,';
}

function detectClosing(body: string): string {
  if (/thank you and best regards/i.test(body)) return 'Thank you and best regards,';
  if (/best regards/i.test(body)) return 'Best regards,';
  if (/kind regards/i.test(body)) return 'Kind regards,';
  return 'Thank you and best regards,';
}

function formatLineItem(
  style: 'bullet' | 'numbered' | 'plain',
  index: number,
  label: string,
  qty: number,
  uom: string,
  unitPrice: number,
  lineTotal: number,
  currency: string,
  itemNo?: string,
  leadTime?: string,
): string {
  const qtyPart = `${qty} ${uom.toUpperCase()} – ${label}`;
  const pricePart = `Unit: ${currency} ${unitPrice.toFixed(2)} | Line total: ${currency} ${lineTotal.toFixed(2)}`;
  const skuPart = itemNo ? ` (${itemNo})` : '';
  const leadPart = leadTime ? ` | Lead time: ${leadTime}` : '';
  const detail = `${qtyPart}${skuPart} — ${pricePart}${leadPart}`;

  switch (style) {
    case 'bullet':
      return `• ${detail}`;
    case 'numbered':
      return `${index + 1}. ${detail}`;
    default:
      return detail;
  }
}

/** Template quotation email mirroring the customer's RFQ layout (no LLM). */
export function buildQuoteEmailTemplate(input: QuoteEmailInput): string {
  const currency = input.currency || 'SGD';
  const greeting = detectGreeting(input.originalEmail.body);
  const closing = detectClosing(input.originalEmail.body);
  const name = input.customerName || input.originalEmail.fromName || 'Customer';
  const grandTotal = input.quoteLines.reduce((s, l) => s + l.final_price * l.quantity, 0);

  if (emailBodyLooksLikeTable(input.originalEmail.body)) {
    const table = buildPlainTextQuoteTable(
      quoteLinesToTableRows(input.quoteLines, input.rfqItems),
      currency,
    );
    const intro = 'Good day. Please find our quotation for your requested items in the table below:';
    const footer = [
      '',
      `Grand Total: ${currency} ${grandTotal.toFixed(2)}`,
      'Validity: 30 days from date of quote.',
      'Payment terms: As per account.',
      'Delivery: Ex stock, lead time as per table.',
      '',
      closing,
      'Allinton Engineering & Trading Pte Ltd',
      'Sales Team',
    ].join('\n');
    return [
      greeting.replace(/sir\/madam/i, name.split(' ')[0] || name),
      '',
      intro,
      '',
      table,
      footer,
    ].join('\n');
  }

  const style = detectListStyle(input.originalEmail.body);
  const lineBlocks = input.quoteLines.map((line, i) =>
    formatLineItem(
      style,
      i,
      line.requested_label,
      line.quantity,
      line.uom || 'pcs',
      line.final_price,
      line.final_price * line.quantity,
      currency,
      line.item_no,
      line.lead_time,
    ),
  );

  const intro =
    style === 'bullet'
      ? 'Good day. Please find our quotation for your requested items below:'
      : 'Good day. Please find our best price for the items below:';

  const footer = [
    '',
    `Quotation total: ${currency} ${grandTotal.toFixed(2)}`,
    'Validity: 30 days from date of quote.',
    'Payment terms: As per account.',
    'Delivery charges: To be confirmed upon order confirmation.',
    '',
    closing,
    'Allinton Engineering & Trading Pte Ltd',
    'Sales Team',
  ].join('\n');

  return [greeting.replace(/sir\/madam/i, name.split(' ')[0] || name), '', intro, '', ...lineBlocks, footer].join(
    '\n',
  );
}

export function quoteLinesForEmailApi(lines: FinalQuoteLine[]) {
  return lines.map((line) => ({
    name: line.requested_label,
    description: line.description,
    requestedItemId: line.requested_item_id,
    sku: line.item_no || '—',
    source: line.source_label,
    supplier: line.supplier,
    costPrice: line.cost,
    listPrice: line.selling_price,
    quantity: line.quantity,
    discount: line.discount,
    finalPrice: line.final_price,
    margin: line.selling_price - line.cost,
    marginPercent: line.margin_percent,
    totalCost: line.cost * line.quantity,
    totalList: line.final_price * line.quantity,
    leadTime: line.lead_time,
  }));
}
