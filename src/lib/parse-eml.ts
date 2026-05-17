import { createHash } from 'crypto';
import { simpleParser } from 'mailparser';

export interface ParsedEmlEmail {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
  preview: string;
  receivedAt: string;
  date?: string;
  status: 'unread';
  direction: 'inbound';
  folder: 'inbox';
  to: string[];
  cc: string[];
  attachmentCount: number;
  source: 'eml_upload';
  /** RFC Message-ID when present (for reply threading in .eml export) */
  messageId?: string;
}

interface AddressObject {
  value?: Array<{ address?: string; name?: string }>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function readAddress(
  field?: AddressObject | Array<{ address?: string; name?: string }>,
): { email: string; name: string } {
  const entry = Array.isArray(field) ? field[0] : field?.value?.[0];
  const email = entry?.address?.trim() || '';
  const name = entry?.name?.trim() || email || 'Unknown';
  return { email, name };
}

function readAddressList(
  field?: AddressObject | Array<{ address?: string; name?: string }>,
): string[] {
  const values = Array.isArray(field) ? field : field?.value || [];
  return values
    .map((entry) => entry.address?.trim())
    .filter((address): address is string => Boolean(address));
}

function readMessageId(parsed: Awaited<ReturnType<typeof simpleParser>>): string | undefined {
  const extended = parsed as { messageId?: string; headers?: { get?: (name: string) => unknown } };
  if (typeof extended.messageId === 'string' && extended.messageId.trim()) {
    return extended.messageId.trim();
  }
  const header = extended.headers?.get?.('message-id');
  if (typeof header === 'string' && header.trim()) return header.trim();
  return undefined;
}

function buildPreview(body: string, max = 200): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max)}…`;
}

export async function parseEmlSource(source: Buffer | string): Promise<ParsedEmlEmail> {
  const parsed = await simpleParser(source);
  const { email: fromEmail, name: fromName } = readAddress(parsed.from);
  const subject = (parsed.subject || '(No Subject)').trim();
  const textBody = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  const htmlBody = typeof parsed.html === 'string' ? stripHtml(parsed.html) : '';
  const body = textBody || htmlBody;

  if (!body) {
    throw new Error('No readable text found in .eml file');
  }

  const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
  const hash = createHash('sha1').update(`${fromEmail}|${subject}|${body.slice(0, 500)}`).digest('hex').slice(0, 12);

  return {
    id: `eml-${hash}`,
    from: fromEmail || 'unknown@example.com',
    fromName,
    subject,
    body,
    preview: buildPreview(body),
    receivedAt,
    date: receivedAt,
    status: 'unread',
    direction: 'inbound',
    folder: 'inbox',
    to: readAddressList(parsed.to),
    cc: readAddressList(parsed.cc),
    attachmentCount: parsed.attachments?.length || 0,
    source: 'eml_upload',
    messageId: readMessageId(parsed),
  };
}
