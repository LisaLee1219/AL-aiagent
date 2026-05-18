import {
  getCompanies,
  getSalesLinesStats,
  isBCConfigured,
} from '@/lib/business-central';
import { isAIConfigured } from '@/lib/llm';

/**
 * Live platform snapshot injected into every agent chat system prompt.
 */
export async function buildAgentSystemContext(): Promise<string> {
  const lines: string[] = [
    '## Live System Snapshot',
    `Generated: ${new Date().toISOString()}`,
    '',
    `AI LLM: ${isAIConfigured() ? `configured (${process.env.OPENAI_MODEL || 'gpt-4o-mini'})` : 'NOT configured — chat will fail'}`,
  ];

  const bcReady = await isBCConfigured();
  if (!bcReady) {
    lines.push(
      'Business Central: **not configured** (BC_ODATA_URL / BC_USERNAME / BC_PASSWORD missing).',
      'Product and order tools will return **demo mock data** until BC is connected.',
    );
    return lines.join('\n');
  }

  try {
    const companies = await getCompanies();
    const company = companies[0];
    lines.push(
      `Business Central: **connected**`,
      company
        ? `Company: ${company.Display_Name || company.Name}`
        : 'Company: (could not load company record)',
    );

    try {
      const stats = await getSalesLinesStats();
      lines.push(
        '',
        '### Recent BC sales summary (sample of latest lines)',
        `- Lines analysed: ${stats.totalLines}`,
        `- Revenue (sample): S$${stats.totalRevenue.toLocaleString('en-SG', { maximumFractionDigits: 0 })}`,
        `- Gross margin: ${stats.grossMargin.toFixed(1)}%`,
        stats.topCategories.length
          ? `- Top categories: ${stats.topCategories
              .slice(0, 5)
              .map((c) => `${c.category} (S$${c.revenue.toFixed(0)})`)
              .join('; ')}`
          : '',
        stats.recentOrders.length
          ? `- Recent orders: ${stats.recentOrders
              .slice(0, 5)
              .map((o) => `${o.orderNo} ${o.customer} S$${o.amount.toFixed(0)}`)
              .join('; ')}`
          : '',
      );
    } catch (statsErr) {
      lines.push(
        '',
        `BC stats unavailable: ${statsErr instanceof Error ? statsErr.message : String(statsErr)}`,
      );
    }
  } catch (err) {
    lines.push(
      `Business Central: configured but **connection error** — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return lines.filter(Boolean).join('\n');
}
