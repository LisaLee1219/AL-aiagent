import type { QuoteEvidence } from './quote-evidence-types';
import { MAX_PANEL_MATCHES } from './match-ranking';

export { MAX_PANEL_MATCHES };

/** Cap evidence pool to top N per source (item / sales / purchase) */
export function limitEvidenceBySource(
  pool: QuoteEvidence[],
  perSource = MAX_PANEL_MATCHES,
): QuoteEvidence[] {
  const bySource: Record<string, QuoteEvidence[]> = {
    item_master: [],
    past_sales: [],
    past_purchase: [],
  };
  for (const ev of pool) {
    bySource[ev.source]?.push(ev);
  }
  const limited: QuoteEvidence[] = [];
  for (const key of ['item_master', 'past_sales', 'past_purchase'] as const) {
    limited.push(
      ...bySource[key]
        .sort((a, b) => b.ruleConfidence - a.ruleConfidence)
        .slice(0, perSource),
    );
  }
  return limited.sort((a, b) => b.ruleConfidence - a.ruleConfidence);
}
