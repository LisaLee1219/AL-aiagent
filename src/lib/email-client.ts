/**
 * Microsoft Graph API Email Client
 * 
 * Connects to automate@allinton.com.sg via Microsoft Graph API
 * using Client Credentials flow (app-only access).
 * 
 * Prerequisites: Azure AD app registration with Mail.Read permission
 * See AGENTS.md for setup instructions.
 */

import type { EmailMessage } from './agent-config';

export type MailFolderView = 'inbox' | 'sent' | 'all';

export function isOutboundEmail(email: Pick<EmailMessage, 'direction' | 'folder'>): boolean {
  return email.direction === 'outbound' || email.folder === 'sent';
}

export function filterEmailsByFolder(emails: EmailMessage[], folder: MailFolderView): EmailMessage[] {
  if (folder === 'all') return emails;
  if (folder === 'inbox') return emails.filter((email) => !isOutboundEmail(email));
  return emails.filter((email) => isOutboundEmail(email));
}

// ─── Configuration ──────────────────────────────────────────
interface MailConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
  configured: boolean;
}

function getMailConfig(): MailConfig {
  const tenantId = process.env.MAIL_TENANT_ID || '';
  const clientId = process.env.MAIL_CLIENT_ID || '';
  const clientSecret = process.env.MAIL_CLIENT_SECRET || '';
  const mailbox = process.env.MAIL_MAILBOX || '';
  return {
    tenantId,
    clientId,
    clientSecret,
    mailbox,
    configured: !!(tenantId && clientId && clientSecret && mailbox),
  };
}

// ─── Token Cache ────────────────────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const config = getMailConfig();
  if (!config.configured) {
    throw new Error('Microsoft Graph API not configured. Set MAIL_CLIENT_ID and MAIL_CLIENT_SECRET.');
  }

  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 300000) {
    return tokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API token request failed: ${error}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return data.access_token;
}

// ─── Graph API Helpers ──────────────────────────────────────
async function graphRequest(endpoint: string): Promise<unknown> {
  const token = await getAccessToken();
  const config = getMailConfig();
  
  // For app-only access, we need to specify the user
  const url = `https://graph.microsoft.com/v1.0/users/${config.mailbox}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API request failed (${response.status}): ${error}`);
  }

  return response.json();
}

function buildMessagesEndpoint(folder: 'inbox' | 'sent', count: number, unreadOnly = false) {
  const folderId = folder === 'sent' ? 'sentitems' : 'inbox';
  const params = new URLSearchParams({
    $top: String(count),
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,from,receivedDateTime,sentDateTime,bodyPreview,body,hasAttachments,importance,isRead,toRecipients,ccRecipients',
  });

  if (folder === 'inbox' && unreadOnly) {
    params.set('$filter', 'isRead eq false');
  }

  return `/mailFolders/${folderId}/messages?${params.toString()}`;
}

// ─── Email Fetching ─────────────────────────────────────────
export interface GraphEmail {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  receivedDateTime: string;
  sentDateTime?: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  hasAttachments: boolean;
  importance: 'low' | 'normal' | 'high';
  isRead: boolean;
  toRecipients?: { emailAddress: { address: string; name: string } }[];
  ccRecipients?: { emailAddress: { address: string; name: string } }[];
}

interface GraphEmailResponse {
  value: GraphEmail[];
  '@odata.nextLink'?: string;
}

/**
 * Fetch recent emails from the inbox
 */
export async function fetchRecentEmails(count: number = 20): Promise<{
  success: boolean;
  source: 'microsoft_graph' | 'demo_fallback';
  data: EmailMessage[];
  error?: string;
}> {
  const config = getMailConfig();

  if (!config.configured) {
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails(),
    };
  }

  try {
    const endpoint = buildMessagesEndpoint('inbox', count);
    
    const result = await graphRequest(endpoint) as GraphEmailResponse;
    
    const emails: EmailMessage[] = (result.value || []).map(mapGraphEmail);
    
    return {
      success: true,
      source: 'microsoft_graph',
      data: emails,
    };
  } catch (error) {
    console.error('[Email Fetch Error]', error instanceof Error ? error.message : error);
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch a single email by ID with full body content
 */
export async function fetchEmailById(emailId: string): Promise<{
  success: boolean;
  source: 'microsoft_graph' | 'demo_fallback';
  data: EmailMessage | null;
  error?: string;
}> {
  const config = getMailConfig();

  if (!config.configured) {
    const demoEmail = getMockEmails().find(e => e.id === emailId);
    return {
      success: true,
      source: 'demo_fallback',
      data: demoEmail || null,
    };
  }

  try {
    const endpoint = `/messages/${emailId}?$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments,importance,isRead,toRecipients,ccRecipients`;
    const result = await graphRequest(endpoint) as GraphEmail;
    
    return {
      success: true,
      source: 'microsoft_graph',
      data: mapGraphEmail(result),
    };
  } catch (error) {
    return {
      success: false,
      source: 'demo_fallback',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch unread emails only
 */
export async function fetchUnreadEmails(count: number = 20): Promise<{
  success: boolean;
  source: 'microsoft_graph' | 'demo_fallback';
  data: EmailMessage[];
  error?: string;
}> {
  const config = getMailConfig();

  if (!config.configured) {
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails().filter(e => !e.isRead),
    };
  }

  try {
    const endpoint = buildMessagesEndpoint('inbox', count, true);
    const result = await graphRequest(endpoint) as GraphEmailResponse;
    
    return {
      success: true,
      source: 'microsoft_graph',
      data: (result.value || []).map(mapGraphEmail),
    };
  } catch (error) {
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails().filter(e => !e.isRead),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function fetchMailboxTimeline(
  count: number = 20,
  folder: MailFolderView = 'all',
): Promise<{
  success: boolean;
  source: 'microsoft_graph' | 'demo_fallback';
  data: EmailMessage[];
  error?: string;
}> {
  const config = getMailConfig();

  if (!config.configured) {
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails(),
    };
  }

  try {
    if (folder === 'inbox') {
      return await fetchRecentEmails(count);
    }

    if (folder === 'sent') {
      const result = await graphRequest(buildMessagesEndpoint('sent', count)) as GraphEmailResponse;
      return {
        success: true,
        source: 'microsoft_graph',
        data: (result.value || []).map((msg) => mapGraphEmail(msg, 'sent')),
      };
    }

    const [inboxResult, sentResult] = await Promise.all([
      graphRequest(buildMessagesEndpoint('inbox', count)) as Promise<GraphEmailResponse>,
      graphRequest(buildMessagesEndpoint('sent', count)) as Promise<GraphEmailResponse>,
    ]);

    const merged = [
      ...(inboxResult.value || []).map((msg) => mapGraphEmail(msg, 'inbox')),
      ...(sentResult.value || []).map((msg) => mapGraphEmail(msg, 'sent')),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      success: true,
      source: 'microsoft_graph',
      data: merged.slice(0, count),
    };
  } catch (error) {
    console.error('[Mailbox Timeline Error]', error instanceof Error ? error.message : error);
    return {
      success: true,
      source: 'demo_fallback',
      data: getMockEmails(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Mark an email as read
 */
export async function markEmailAsRead(emailId: string): Promise<boolean> {
  const config = getMailConfig();
  if (!config.configured) return true;

  try {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${config.mailbox}/messages/${emailId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead: true }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get email connection status
 */
export async function getEmailStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  mailbox?: string;
  tenantId?: string;
  error?: string;
}> {
  const config = getMailConfig();

  if (!config.configured) {
    return {
      configured: false,
      connected: false,
      mailbox: config.mailbox || undefined,
      tenantId: config.tenantId || undefined,
    };
  }

  try {
    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/users/${config.mailbox}/mailFolders/inbox`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json() as { totalCount?: number; unreadItemCount?: number };
      return {
        configured: true,
        connected: true,
        mailbox: config.mailbox,
        tenantId: config.tenantId,
      };
    } else {
      return {
        configured: true,
        connected: false,
        mailbox: config.mailbox,
        tenantId: config.tenantId,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      mailbox: config.mailbox,
      tenantId: config.tenantId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ─── Mapping ────────────────────────────────────────────────
function mapGraphEmail(msg: GraphEmail, folder: 'inbox' | 'sent' = 'inbox'): EmailMessage {
  const to = (msg.toRecipients || [])
    .map((recipient) => recipient.emailAddress?.address)
    .filter(Boolean) as string[];
  const cc = (msg.ccRecipients || [])
    .map((recipient) => recipient.emailAddress?.address)
    .filter(Boolean) as string[];

  return {
    id: msg.id,
    from: msg.from?.emailAddress?.address || 'unknown',
    fromName: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown',
    subject: msg.subject || '(No Subject)',
    date: folder === 'sent' ? (msg.sentDateTime || msg.receivedDateTime) : msg.receivedDateTime,
    preview: msg.bodyPreview || '',
    body: msg.body?.content || msg.bodyPreview || '',
    isRead: msg.isRead,
    importance: msg.importance,
    hasAttachments: msg.hasAttachments,
    folder,
    direction: folder === 'sent' ? 'outbound' : 'inbound',
    to,
    cc,
  };
}

// ─── Demo Fallback Emails ───────────────────────────────────
export function getMockEmails(): EmailMessage[] {
  const now = new Date();
  return [
    {
      id: 'demo-1',
      from: 'clienta@construction.sg',
      fromName: 'Client A',
      subject: 'URGENT: Quotation Request - Fasteners & Wheels',
      date: new Date(now.getTime() - 15 * 60000).toISOString(),
      preview: 'Could you please provide us with your best price for the items below: 100 PCS FLAT WHEEL (4"), 35 PCS MACHINE SCREW, Bolts, Nuts, Washers...',
      body: `Dear Sir/Madam,

Good day. Could you please provide us with your best price for the items below:

• 100 PCS – FLAT WHEEL (4")
• 35 PCS – MACHINE SCREW ALLEN TYPE M14 X 30MM
• 80 PCS – BOLT M16 X 100MM GRADE 8.8
• 80 PCS – NUT M16 GRADE 8.8
• 80 PCS – FLAT WASHER M16 GRADE 8.8
• 80 PCS – SPRING WASHER M16 GRADE 8.8
• 300 PCS – BOLT M22 X 80MM GRADE 8.8
• 300 PCS – NUT M22 GRADE 8.8
• 300 PCS – FLAT WASHER M22 GRADE 8.8
• 300 PCS – SPRING WASHER M22 GRADE 8.8

Kindly include in your quotation:
- Lead time availability
- Delivery charges (if any)

This is an urgent request, and your prompt response would be greatly appreciated.

Thank you and best regards,
Client A`,
      isRead: false,
      importance: 'high',
      hasAttachments: false,
      folder: 'inbox',
      direction: 'inbound',
      to: ['yiwen.li@allinton.com.sg'],
      cc: [],
    },
    {
      id: 'demo-2',
      from: 'clienta@construction.sg',
      fromName: 'Client A',
      subject: 'URGENT: Quotation Request - Butterfly Valve & Pressure Switch',
      date: new Date(now.getTime() - 45 * 60000).toISOString(),
      preview: 'Please provide your best price for: BUTTERFLY VALVE 2" CAST IRON WAFER TYPE, PRESSURE SWITCH (0-5 BARS)...',
      body: `Good day,

Please provide your best price for the following items at your earliest convenience:

• BUTTERFLY VALVE 2", CAST IRON, WAFER TYPE = 1 PC
• PRESSURE SWITCH (RANGE 0–5 BARS) = 1 PC

Note:
- For Item #1, please refer to the attached image for reference.
- For Item #2, please quote for any suitable brand that meets the stated requirement, and include an image of the proposed item.

Kindly include the following in your quotation:
a) Mode of delivery
b) Lead time
c) Delivery / freight charges
d) Tax information (VAT inclusive or exclusive)
e) Product image

Thank you and best regards,
Client A`,
      isRead: false,
      importance: 'high',
      hasAttachments: true,
      folder: 'inbox',
      direction: 'inbound',
      to: ['yiwen.li@allinton.com.sg'],
      cc: [],
    },
    {
      id: 'demo-3',
      from: 'yiwen.li@allinton.com.sg',
      fromName: 'Yiwen Li',
      subject: 'RE: URGENT: Quotation Request - Fasteners & Wheels',
      date: new Date(now.getTime() - 5 * 60000).toISOString(),
      preview: 'Dear Client A, please find our preliminary pricing below. We can confirm stock for the M16 and M22 fasteners...',
      body: `Dear Client A,

Please find our preliminary quotation details below for the requested fasteners and flat wheels.

- M16 and M22 fasteners are available for prompt delivery
- Flat wheel stock can be confirmed by this afternoon
- Delivery can be arranged within Singapore once the order is confirmed

Please let us know if you would like us to proceed with a formal quotation.

Best regards,
Yiwen Li`,
      isRead: true,
      importance: 'normal',
      hasAttachments: false,
      folder: 'sent',
      direction: 'outbound',
      to: ['clienta@construction.sg'],
      cc: [],
    },
  ];
}
