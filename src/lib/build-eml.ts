/** Options for building a RFC 5322–style .eml (plain text, optional HTML). */
export interface BuildEmlOptions {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  inReplyTo?: string;
  references?: string;
}

const DEFAULT_FROM_NAME = 'Allinton Engineering & Trading Pte Ltd';
const DEFAULT_FROM_EMAIL = 'sales@allinton.com.sg';

export function defaultQuotationFrom(): { name: string; email: string } {
  return {
    name:
      process.env.NEXT_PUBLIC_QUOTATION_FROM_NAME ||
      process.env.QUOTATION_FROM_NAME ||
      DEFAULT_FROM_NAME,
    email:
      process.env.NEXT_PUBLIC_QUOTATION_FROM_EMAIL ||
      process.env.QUOTATION_FROM_EMAIL ||
      DEFAULT_FROM_EMAIL,
  };
}

function formatAddress(name: string, email: string): string {
  const safeName = name.replace(/"/g, '\\"').trim();
  const safeEmail = email.trim();
  if (!safeEmail) return safeName || 'sales@example.com';
  if (safeName && safeName.toLowerCase() !== safeEmail.toLowerCase()) {
    return `"${safeName}" <${safeEmail}>`;
  }
  return safeEmail;
}

function replySubject(subject: string): string {
  const trimmed = (subject || 'Quotation').trim();
  if (/^re:\s/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}

function normalizeCrlf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

/** Build a downloadable .eml file (CRLF line endings). Uses multipart/alternative when htmlBody is set. */
export function buildEmlFile(options: BuildEmlOptions): string {
  const from = formatAddress(options.fromName, options.fromEmail);
  const to = formatAddress(options.toName || options.toEmail, options.toEmail);
  const subject = replySubject(options.subject);
  const date = new Date().toUTCString();
  const plain = normalizeCrlf(options.body);
  const html = options.htmlBody?.trim() ? normalizeCrlf(options.htmlBody) : '';

  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    'MIME-Version: 1.0',
  ];

  if (options.inReplyTo?.trim()) {
    const mid = options.inReplyTo.includes('<') ? options.inReplyTo : `<${options.inReplyTo}>`;
    headers.push(`In-Reply-To: ${mid}`);
    headers.push(`References: ${options.references?.trim() || mid}`);
  }

  if (html) {
    const boundary = `----=_Quote_${Date.now().toString(36)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      plain,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      html,
      `--${boundary}--`,
      '',
    ];
    return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
  }

  headers.push('Content-Type: text/plain; charset=UTF-8');
  headers.push('Content-Transfer-Encoding: 8bit');
  return `${headers.join('\r\n')}\r\n\r\n${plain}`;
}

export function emlFilename(subject: string): string {
  const base = subject
    .replace(/^re:\s*/i, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 40)
    .replace(/\s+/g, '_');
  return `quotation_${base || 'reply'}_${new Date().toISOString().slice(0, 10)}.eml`;
}

export function downloadEmlInBrowser(emlContent: string, filename: string): void {
  const blob = new Blob([emlContent], { type: 'message/rfc822;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
