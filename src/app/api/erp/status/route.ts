import { NextResponse } from 'next/server';
import { isBCConfigured, getBCODataConfig, getCompanies } from '@/lib/business-central';
import { ensureEnvLoaded } from '@/lib/env-loader';

/**
 * GET /api/erp/status
 * Business Central connection status check
 */
export async function GET() {
  await ensureEnvLoaded();
  const config = (await getBCODataConfig());

  if (!config) {
    return NextResponse.json({
      success: true,
      data: {
        businessCentral: {
          configured: false,
          odataUrl: null,
          environment: null,
          hasCompany: false,
        },
      },
    });
  }

  try {
    const companies = await getCompanies();
    const company = companies[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        businessCentral: {
          configured: true,
          odataUrl: config.odataUrl,
          environment: config.odataUrl,
          hasCompany: !!company,
          companyName: company?.Display_Name || company?.Name || null,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({
      success: true,
      data: {
        businessCentral: {
          configured: true,
          odataUrl: config.odataUrl,
          environment: config.odataUrl,
          hasCompany: false,
          error: message,
        },
      },
    });
  }
}
