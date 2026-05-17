import { NextRequest, NextResponse } from 'next/server';
import { invokeChat } from '@/lib/llm';
import { ensureEnvLoaded } from '@/lib/env-loader';
import { quoteLinesMissingPrices } from '@/lib/sales-quote-copilot/build-quote-table';
import { quoteLinesForEmailApi } from '@/lib/sales-quote-copilot/build-quote-email';
import type { FinalQuoteLine } from '@/lib/sales-quote-copilot/types';

interface RfqLineRef {
  lineId: string;
  originalText: string;
  quantity: number;
  uom: string;
}

type QuoteFormatMode = 'explicit_table' | 'bullet_list' | 'pdf_or_attachment' | 'standard';

const QUOTE_CONTENT_PLACEHOLDER = '[[QUOTE_CONTENT_HERE]]';

function mapApiQuoteLinesToFinal(
  apiLines: ReturnType<typeof quoteLinesForEmailApi>,
  rfqLines?: RfqLineRef[],
): FinalQuoteLine[] {
  return apiLines.map((line, index) => ({
    id: `ql-${index}`,
    requested_item_id: line.requestedItemId || rfqLines?.[index]?.lineId || `line-${index}`,
    requested_label: line.name,
    description: line.description || line.name,
    source_type: 'item_master',
    source_label: line.source,
    supplier: line.supplier,
    quantity: line.quantity,
    cost: line.costPrice,
    selling_price: line.listPrice,
    discount: line.discount,
    final_price: line.finalPrice,
    margin_percent: line.marginPercent,
    lead_time: line.leadTime || '—',
    confidence_score: 0,
    approval_status: 'approved',
    risk_flags: [],
    item_no: line.sku !== '—' ? line.sku : undefined,
    uom: rfqLines?.[index]?.uom,
  }));
}

function detectQuoteFormatMode(originalEmail: { subject?: string; body?: string }): QuoteFormatMode {
  const subject = originalEmail.subject || '';
  const body = originalEmail.body || '';
  const text = `${subject}\n${body}`.toLowerCase();

  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const mentionsPdfOrAttachment =
    /\bpdf\b/.test(text) ||
    /\battach(ed|ment)?\b/.test(text) ||
    /\bsee attached\b/.test(text) ||
    /\battached file\b/.test(text) ||
    /\battached picture\b/.test(text) ||
    /\battached photo\b/.test(text) ||
    /\battached image\b/.test(text);

  const bulletItemLines = lines.filter((line) => /^[-•*]\s+/.test(line)).length;

  const numberedItemLines = lines.filter((line) => /^\d+[\).\s-]+/.test(line)).length;

  const abcRequirementLines = lines.filter((line) => /^[a-z]\)\s+/i.test(line)).length;

  const pipeTableLines = lines.filter((line) => {
    const pipeCount = (line.match(/\|/g) || []).length;
    return pipeCount >= 2;
  }).length;

  const tabTableLines = lines.filter((line) => {
    const tabCount = (line.match(/\t/g) || []).length;
    return tabCount >= 2;
  }).length;

  const htmlTableLike =
    /<table[\s>]/i.test(body) ||
    /<\/tr>/i.test(body) ||
    /<\/td>/i.test(body);

  const alignedColumnHeader =
    /\b(s\/n|no\.?|item\s*no\.?|description|qty|quantity|uom|unit\s*price|line\s*total)\b/i.test(body) &&
    /\s{3,}/.test(body);

  /**
   * Important:
   * Do NOT treat bullet RFQs as tables just because they contain qty, item, description, etc.
   * Many customer RFQs are bullet lists with quantity information.
   */
  const explicitTable =
    htmlTableLike ||
    pipeTableLines >= 2 ||
    tabTableLines >= 2 ||
    alignedColumnHeader;

  if (explicitTable) {
    return 'explicit_table';
  }

  /**
   * If the customer used bullet points, numbered items, or a), b), c) requirements,
   * we should reply in a bullet/list style, not an ASCII table.
   */
  if (bulletItemLines >= 1 || numberedItemLines >= 2 || abcRequirementLines >= 2) {
    return 'bullet_list';
  }

  if (mentionsPdfOrAttachment) {
    return 'pdf_or_attachment';
  }

  return 'standard';
}

function money(value: number | undefined | null, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return `${currency} ${value.toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildPlainQuoteContent(params: {
  mode: QuoteFormatMode;
  quoteLines: ReturnType<typeof quoteLinesForEmailApi>;
  rfqLines?: RfqLineRef[];
  currency: string;
  grandTotal: number;
}): string {
  const { mode, quoteLines, rfqLines, currency, grandTotal } = params;

  if (mode === 'explicit_table') {
    const header = [
      'S/N',
      'Customer RFQ Item',
      'Qty',
      'UOM',
      'Quoted Description',
      'Unit Price',
      'Line Total',
      'Lead Time',
    ];

    const rows = quoteLines.map((line, index) => {
      const rfqLine = rfqLines?.[index];

      return [
        String(index + 1),
        rfqLine?.originalText || line.name,
        String(line.quantity),
        rfqLine?.uom || 'PC',
        line.description || line.name,
        money(line.finalPrice, currency),
        money(line.totalList, currency),
        line.leadTime || '—',
      ].join(' | ');
    });

    return [
      'Quotation Details:',
      [header.join(' | '), ...rows].join('\n'),
      '',
      `Grand Total: ${money(grandTotal, currency)}`,
    ].join('\n');
  }

  const heading =
    mode === 'pdf_or_attachment'
      ? 'Quotation added below for your reference:'
      : 'Please find our best price below:';

  const lines = quoteLines.map((line, index) => {
    const rfqLine = rfqLines?.[index];
    const requestedItem = rfqLine?.originalText || line.name;
    const uom = rfqLine?.uom || 'PC';

    return [
      `• ${requestedItem}`,
      `  - Quoted Description: ${line.description || line.name}`,
      line.sku && line.sku !== '—' ? `  - Model / Part No.: ${line.sku}` : '',
      `  - Quantity: ${line.quantity} ${uom}`,
      `  - Unit Price: ${money(line.finalPrice, currency)} / ${uom}`,
      `  - Line Total: ${money(line.totalList, currency)}`,
      `  - Lead Time: ${line.leadTime || '—'}`,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [
    heading,
    '',
    ...lines,
    '',
    `Grand Total: ${money(grandTotal, currency)}`,
  ].join('\n');
}

function buildHtmlQuoteContent(params: {
  mode: QuoteFormatMode;
  quoteLines: ReturnType<typeof quoteLinesForEmailApi>;
  rfqLines?: RfqLineRef[];
  currency: string;
  grandTotal: number;
}): string {
  const { mode, quoteLines, rfqLines, currency, grandTotal } = params;

  if (mode === 'explicit_table') {
    const rows = quoteLines
      .map((line, index) => {
        const rfqLine = rfqLines?.[index];

        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(rfqLine?.originalText || line.name)}</td>
            <td>${escapeHtml(String(line.quantity))}</td>
            <td>${escapeHtml(rfqLine?.uom || 'PC')}</td>
            <td>${escapeHtml(line.description || line.name)}</td>
            <td>${escapeHtml(money(line.finalPrice, currency))}</td>
            <td>${escapeHtml(money(line.totalList, currency))}</td>
            <td>${escapeHtml(line.leadTime || '—')}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <p><strong>Quotation Details:</strong></p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>S/N</th>
            <th>Customer RFQ Item</th>
            <th>Qty</th>
            <th>UOM</th>
            <th>Quoted Description</th>
            <th>Unit Price</th>
            <th>Line Total</th>
            <th>Lead Time</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <p><strong>Grand Total: ${escapeHtml(money(grandTotal, currency))}</strong></p>
    `;
  }

  const heading =
    mode === 'pdf_or_attachment'
      ? 'Quotation added below for your reference:'
      : 'Please find our best price below:';

  const items = quoteLines
    .map((line, index) => {
      const rfqLine = rfqLines?.[index];
      const requestedItem = rfqLine?.originalText || line.name;
      const uom = rfqLine?.uom || 'PC';

      return `
        <li style="margin-bottom: 12px;">
          <strong>${escapeHtml(requestedItem)}</strong><br />
          Quoted Description: ${escapeHtml(line.description || line.name)}<br />
          ${
            line.sku && line.sku !== '—'
              ? `Model / Part No.: ${escapeHtml(line.sku)}<br />`
              : ''
          }
          Quantity: ${escapeHtml(String(line.quantity))} ${escapeHtml(uom)}<br />
          Unit Price: ${escapeHtml(money(line.finalPrice, currency))} / ${escapeHtml(uom)}<br />
          Line Total: ${escapeHtml(money(line.totalList, currency))}<br />
          Lead Time: ${escapeHtml(line.leadTime || '—')}
        </li>
      `;
    })
    .join('');

  return `
    <p><strong>${escapeHtml(heading)}</strong></p>
    <ul style="padding-left: 20px;">
      ${items}
    </ul>
    <p><strong>Grand Total: ${escapeHtml(money(grandTotal, currency))}</strong></p>
  `;
}

function ensureQuotePlaceholder(reply: string): string {
  const trimmed = reply.trim();

  if (trimmed.includes(QUOTE_CONTENT_PLACEHOLDER)) {
    return trimmed;
  }

  return [trimmed, '', QUOTE_CONTENT_PLACEHOLDER].join('\n');
}

function keepOnlyFirstQuotePlaceholder(reply: string): string {
  const firstIndex = reply.indexOf(QUOTE_CONTENT_PLACEHOLDER);

  if (firstIndex === -1) {
    return reply;
  }

  const before = reply.slice(0, firstIndex + QUOTE_CONTENT_PLACEHOLDER.length);
  const after = reply
    .slice(firstIndex + QUOTE_CONTENT_PLACEHOLDER.length)
    .replaceAll(QUOTE_CONTENT_PLACEHOLDER, '');

  return before + after;
}

function buildHtmlEmailFromPlainWithQuote(params: {
  plainReplyWithPlaceholder: string;
  quoteContentHtml: string;
}): string {
  const { plainReplyWithPlaceholder, quoteContentHtml } = params;

  const parts = plainReplyWithPlaceholder.split(QUOTE_CONTENT_PLACEHOLDER);

  const beforeHtml = escapeHtml(parts[0] || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');

  const afterHtml = escapeHtml(parts.slice(1).join(QUOTE_CONTENT_PLACEHOLDER) || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');

  return `${beforeHtml}${quoteContentHtml}${afterHtml}`;
}

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();

  try {
    const body = await request.json();

    const { originalEmail, customerInfo, quoteLines, totals, rfqLines, currency } = body as {
      originalEmail: { from: string; subject: string; body: string };
      customerInfo: { name: string; company: string };
      quoteLines: ReturnType<typeof quoteLinesForEmailApi>;
      totals: { totalCost: number; totalList: number; totalMargin: number };
      rfqLines?: RfqLineRef[];
      currency?: string;
    };

    if (!originalEmail?.body || !quoteLines?.length) {
      return NextResponse.json({ error: 'Missing original email or quote lines' }, { status: 400 });
    }

    const cur = currency || 'SGD';
    const finalLines = mapApiQuoteLinesToFinal(quoteLines, rfqLines);

    if (quoteLinesMissingPrices(finalLines)) {
      return NextResponse.json(
        {
          error: 'All quotation lines must have a unit price before generating the customer email.',
          missingPrices: true,
        },
        { status: 400 },
      );
    }

    const quoteFormatMode = detectQuoteFormatMode(originalEmail);

    const rfqBlock =
      rfqLines && rfqLines.length > 0
        ? rfqLines
            .map(
              (line, i) =>
                `RFQ ${i + 1}: "${line.originalText}" | Qty: ${line.quantity} ${line.uom}`,
            )
            .join('\n')
        : '';

    const pricedLinesSummary = quoteLines
      .map(
        (line, i) =>
          `Line ${i + 1}: ${line.name} | Qty ${line.quantity} | Unit ${cur} ${line.finalPrice.toFixed(
            2,
          )} | Total ${cur} ${line.totalList.toFixed(2)} | Lead ${line.leadTime || '—'}`,
      )
      .join('\n');

    const quoteContentPlain = buildPlainQuoteContent({
      mode: quoteFormatMode,
      quoteLines,
      rfqLines,
      currency: cur,
      grandTotal: totals.totalList,
    });

    const quoteContentHtml = buildHtmlQuoteContent({
      mode: quoteFormatMode,
      quoteLines,
      rfqLines,
      currency: cur,
      grandTotal: totals.totalList,
    });

    const formatInstruction =
      quoteFormatMode === 'explicit_table'
        ? `The customer's RFQ appears to use an explicit table. Keep a table-style quotation. The system will insert the quotation content at ${QUOTE_CONTENT_PLACEHOLDER}.`
        : quoteFormatMode === 'bullet_list'
          ? `The customer's RFQ uses bullet points, numbered items, or a), b), c) requirements. Do NOT create an ASCII table. Reply in the same bullet/list style. The system will insert the quotation content as bullet quotation lines at ${QUOTE_CONTENT_PLACEHOLDER}.`
          : quoteFormatMode === 'pdf_or_attachment'
            ? `The customer's RFQ refers to PDF, attachment, photo, or supporting documents. Acknowledge the attachment/reference and place the quotation content after the acknowledgement at ${QUOTE_CONTENT_PLACEHOLDER}. Do NOT claim that a PDF is attached unless the system actually attaches one.`
            : `The customer's RFQ appears to be a normal text enquiry. Use a concise quotation reply format and place the quotation content at ${QUOTE_CONTENT_PLACEHOLDER}.`;

    const systemPrompt = `You are a professional sales representative at Allinton Engineering & Trading Pte Ltd (Singapore).

Your task is to generate a customer quotation reply email.

CRITICAL OBJECTIVE:
You must strictly follow the customer's original RFQ style and format as much as possible.
Do not create a completely new email format.
Do not freely rewrite the layout.
The quote must be included in the reply.

FORMAT DECISION:
${formatInstruction}

SELECTED RFQ RULE:
Only reply to the RFQ items provided in the selected RFQ and approved quotation lines.
Do not add extra products.
Do not quote alternative items unless they already exist in the approved quotation lines.
Do not infer missing products from the customer's email if they are not included in the selected RFQ lines.

QUOTE CONTENT RULES:
- You must include exactly this placeholder once:
${QUOTE_CONTENT_PLACEHOLDER}
- The actual quotation content will be inserted by the system at that placeholder.
- Do not manually write product prices outside this placeholder.
- Do not manually write line totals outside this placeholder.
- Do not duplicate the quotation lines in prose.
- Do not say "prices to follow".
- Do not leave the quotation empty.
- Do not mention placeholder, system, automation, or AI.

FORMAT MATCHING RULES:
- If the customer's RFQ is a bullet list, your reply must be a bullet/list quotation, not a table.
- If the customer's RFQ uses a), b), c), d), e) requirements, answer those requested points in the same a), b), c), d), e) style after the quotation.
- Only use a table when the customer's RFQ clearly contains an actual table.
- Never create ASCII tables using ----, +----+, or fixed-width columns unless the customer's original email already used that exact style.
- For this reply mode, the quotation content will be inserted at ${QUOTE_CONTENT_PLACEHOLDER}, so do not create another table yourself.

STYLE RULES:
- Mirror the customer's greeting, tone, language, and formality.
- If the customer is short and direct, reply short and direct.
- If the customer uses a formal RFQ style, reply formally.
- If the customer asks for delivery, lead time, validity, tax, freight, or product image, answer these in the terms section after the quote content.
- Do not add unnecessary marketing language.
- Do not use markdown.
- Do not use code fences.

COMMERCIAL TERMS:
After the quote content, include concise commercial terms.
If the customer requested specific terms such as:
a) Mode of delivery
b) Lead time
c) Delivery / freight charges
d) Tax information
e) Product image
then answer them using the same lettering style.

Default values:
- Mode of delivery: Ex stock / subject to availability
- Lead time: As stated in the quotation
- Delivery / freight charges: To be advised if applicable
- Tax information: GST excluded unless otherwise stated
- Product image: To be provided where available
- Validity: approximately 30 days unless otherwise stated
- Payment: as per account arrangement

SIGNATURE:
End with:
Allinton Engineering & Trading Pte Ltd
Sales Team

Output only the final email body.`;

    const userPrompt = `Use the customer's original RFQ below as the format reference.

=== CUSTOMER ORIGINAL RFQ EMAIL ===
From: ${originalEmail.from}
Subject: ${originalEmail.subject}

${originalEmail.body}

=== CUSTOMER INFORMATION ===
Customer name: ${customerInfo.name}
Customer company: ${customerInfo.company}

${rfqBlock ? `=== SELECTED RFQ ITEMS ===\n${rfqBlock}\n` : ''}

=== APPROVED QUOTATION LINES ===
The following lines are approved and priced.
Use this only to understand that a valid quotation exists.
Do not manually list these prices outside ${QUOTE_CONTENT_PLACEHOLDER}.

${pricedLinesSummary}

=== GRAND TOTAL ===
${cur} ${totals.totalList.toFixed(2)}

=== REQUIRED BEHAVIOUR ===
- Follow the customer's RFQ format as closely as possible.
- Include ${QUOTE_CONTENT_PLACEHOLDER} exactly once where the quote should appear.
- The quote must appear in the reply.
- If the customer used bullet points, keep bullet/list style.
- If the customer requested a), b), c), d), e) details, answer them in the same lettering style.
- Do not create an ASCII table unless the original customer email clearly used an ASCII table.
- Do not manually type the product prices outside the quote placeholder.

Now generate the final customer quotation reply email body.`;

    const response = await invokeChat(
      [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ],
      { temperature: 0.1 },
    );

    let aiReply = (response.content || '').trim();

    aiReply = ensureQuotePlaceholder(aiReply);
    aiReply = keepOnlyFirstQuotePlaceholder(aiReply);

    const plain = aiReply.replace(QUOTE_CONTENT_PLACEHOLDER, quoteContentPlain);

    const htmlBody = buildHtmlEmailFromPlainWithQuote({
      plainReplyWithPlaceholder: aiReply,
      quoteContentHtml,
    });

    return NextResponse.json({
      reply: plain,
      htmlBody,
      hasQuote: true,
      quoteFormatMode,
      missingPrices: false,
      grandTotal: totals.totalList,
    });
  } catch (error) {
    console.error('[generate-email-reply] Error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate email reply' },
      { status: 500 },
    );
  }
}