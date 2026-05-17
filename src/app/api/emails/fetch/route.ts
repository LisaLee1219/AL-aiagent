import { NextResponse } from 'next/server';
import { fetchEmailById, getEmailStatus } from '@/lib/email-client';

/**
 * GET /api/emails/fetch?emailId=xxx
 * Fetch a single email by ID with full body content
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const emailId = searchParams.get('emailId');

  if (!emailId) {
    return NextResponse.json(
      { success: false, error: 'emailId query parameter is required' },
      { status: 400 }
    );
  }

  const status = await getEmailStatus();

  if (!status.configured) {
    return NextResponse.json({
      success: false,
      source: 'mock',
      error: 'Microsoft Graph API not configured',
      data: null,
    });
  }

  try {
    const result = await fetchEmailById(emailId);

    return NextResponse.json({
      success: true,
      source: result.source,
      data: result.data,
    });
  } catch (error) {
    console.error('[Email Fetch API Error]', error instanceof Error ? error.message : error);
    return NextResponse.json({
      success: false,
      source: 'mock',
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null,
    });
  }
}
