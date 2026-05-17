import { NextResponse } from 'next/server';
import {
  isBCConfigured,
  getBCODataConfig,
  getSalesLinesStats,
  getCompanies,
} from '@/lib/business-central';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/bc/stats
 * Business Central connection status and sales statistics
 */
export async function GET() {
  await ensureEnvLoaded();
  const config = (await getBCODataConfig());

  if (!config) {
    return NextResponse.json({
      success: true,
      data: {
        configured: false,
        odataUrl: null,
        company: null,
        stats: null,
      },
    });
  }

  try {
    // Test connection - fetch company info
    const companies = await getCompanies();
    const company = companies[0] || null;

    // Fetch sales statistics
    const stats = await getSalesLinesStats();

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        odataUrl: config.odataUrl,
        company: company ? {
          id: company.Id,
          name: company.Name,
          displayName: company.Display_Name,
        } : null,
        stats,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    console.error('[BC Stats API Error]', message);

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        odataUrl: config.odataUrl,
        company: null,
        stats: null,
        error: message,
      },
    });
  }
}
