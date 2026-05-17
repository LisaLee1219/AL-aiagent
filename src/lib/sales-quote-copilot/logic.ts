import type {
  ApprovalStatus,
  FinalQuoteLine,
  MatchCandidate,
  ReadinessStatus,
  RequestedItem,
} from './types';
import { TARGET_MARGIN_PERCENT } from './constants';

export function confidenceTier(score: number): string {
  if (score >= 90) return 'Exact Match';
  if (score >= 70) return 'Possible Match';
  if (score >= 40) return 'Weak Match';
  return 'No Reliable Match';
}

export function canAutoSelectMatch(score: number): boolean {
  return score >= 70;
}

export function canEnterQuoteBuilder(
  item: RequestedItem,
  hasVerifiedMatch: boolean,
  hasSupplierQuote: boolean,
): boolean {
  if (item.excluded) return false;
  if (item.readiness_status === 'cannot_quote') return false;
  if (item.readiness_status === 'need_clarification') return false;
  if (item.manual_price?.confirmed && item.manual_price.selling_price > 0) return true;
  if (hasSupplierQuote) return true;
  if (item.readiness_status === 'ready_to_match' && hasVerifiedMatch) return true;
  return false;
}

export function computeLineApproval(line: FinalQuoteLine): ApprovalStatus {
  if (!line.source_type || line.cost === 0) return 'blocked';
  if (line.risk_flags.some((f) => f.includes('no price source'))) return 'blocked';
  if (line.cost === 0) return 'needs_review';
  if (line.confidence_score < 70) return 'needs_review';
  if (line.margin_percent < TARGET_MARGIN_PERCENT) return 'needs_review';
  if (line.manual_override) return 'needs_review';
  if (line.margin_percent >= 99.9 && line.cost === 0) return 'blocked';
  return line.approved ? 'approved' : 'pending';
}

export function readinessBadgeClass(status: ReadinessStatus): string {
  switch (status) {
    case 'ready_to_match':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'need_clarification':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'need_human_review':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'need_sourcing':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-red-100 text-red-800 border-red-200';
  }
}

export function readinessLabel(status: ReadinessStatus): string {
  switch (status) {
    case 'ready_to_match':
      return 'Ready to Match';
    case 'need_clarification':
      return 'Need Clarification';
    case 'need_human_review':
      return 'Need Human Review';
    case 'need_sourcing':
      return 'Need Sourcing';
    default:
      return 'Cannot Quote';
  }
}

export function sourceBadgeLabel(source: MatchCandidate['source_type']): string {
  switch (source) {
    case 'item_master':
      return 'BC Item';
    case 'inventory':
      return 'In Stock';
    case 'past_sales':
      return 'Past Sale';
    case 'past_purchase':
      return 'Past Purchase';
    case 'past_quote':
      return 'Past Quote';
    case 'supplier_quote':
      return 'Supplier Quote';
    default:
      return 'Manual Price';
  }
}

export function hasBlockedLines(lines: FinalQuoteLine[]): boolean {
  return lines.some((l) => computeLineApproval(l) === 'blocked');
}
