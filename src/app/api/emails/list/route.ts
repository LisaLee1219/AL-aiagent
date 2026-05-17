import { NextResponse } from 'next/server';
import {
  fetchMailboxTimeline,
  fetchRecentEmails,
  fetchUnreadEmails,
  filterEmailsByFolder,
  getEmailStatus,
  getMockEmails,
  type MailFolderView,
} from '@/lib/email-client';

/**
 * GET /api/emails/list
 * List emails from the inbox, optionally filtered
 * Query params: top, unreadOnly
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const top = parseInt(searchParams.get('top') || searchParams.get('limit') || '20', 10);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const folder = (searchParams.get('folder') || 'all') as MailFolderView;

  const status = await getEmailStatus();

  if (!status.configured) {
    const mockEmails = filterEmailsByFolder(getMockEmails(), folder);
    return NextResponse.json({
      success: true,
      source: 'mock' as const,
      count: mockEmails.length,
      emails: mockEmails,
      data: mockEmails,
      info: 'Microsoft Graph API not configured. Using demo data.',
    });
  }

  try {
    const result = unreadOnly && folder !== 'sent'
      ? await fetchUnreadEmails(top)
      : folder === 'inbox'
        ? await fetchRecentEmails(top)
        : await fetchMailboxTimeline(top, folder);

    const source = result.source === 'microsoft_graph' ? 'graph_api' : 'mock';

    return NextResponse.json({
      success: true,
      source,
      count: result.data.length,
      emails: result.data,
      data: result.data,
    });
  } catch (error) {
    console.error('[Email List API Error]', error instanceof Error ? error.message : error);
    const mockEmails = filterEmailsByFolder(getMockEmails(), folder);
    return NextResponse.json({
      success: true,
      source: 'mock' as const,
      count: mockEmails.length,
      emails: mockEmails,
      data: mockEmails,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
