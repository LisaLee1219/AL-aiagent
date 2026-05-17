import { NextResponse } from 'next/server';
import { getEmailStatus } from '@/lib/email-client';

/**
 * GET /api/emails/status
 * Check email connection status and return mock emails if not connected
 */
export async function GET() {
  try {
    const status = await getEmailStatus();
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[Email Status API Error]', error instanceof Error ? error.message : error);
    return NextResponse.json({
      success: false,
      data: {
        configured: false,
        source: 'mock' as const,
        email: '',
        message: error instanceof Error ? error.message : 'Unknown error',
        mockEmails: [],
      },
    });
  }
}
