import { NextResponse } from 'next/server';
import { ensureEnvLoaded, isAIConfiguredCheck, isWebSearchConfiguredCheck } from '@/lib/env-loader';

/**
 * GET /api/ai/status — check whether AI and web search are configured
 */
export async function GET() {
  await ensureEnvLoaded();

  return NextResponse.json({
    success: true,
    data: {
      ai: {
        configured: isAIConfiguredCheck(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      },
      webSearch: {
        configured: isWebSearchConfiguredCheck(),
        provider: 'tavily',
      },
    },
  });
}
