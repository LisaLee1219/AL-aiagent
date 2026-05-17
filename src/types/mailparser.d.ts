declare module 'mailparser' {
  export interface ParsedMailAddress {
    address?: string;
    name?: string;
  }

  export interface ParsedMail {
    subject?: string;
    date?: Date;
    text?: string;
    html?: string | false;
    from?: { value?: ParsedMailAddress[] };
    to?: { value?: ParsedMailAddress[] };
    cc?: { value?: ParsedMailAddress[] };
    attachments?: unknown[];
  }

  export function simpleParser(source: Buffer | string): Promise<ParsedMail>;
}
