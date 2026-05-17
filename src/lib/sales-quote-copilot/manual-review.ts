import type {
  ManualReviewDecision,
  ReadinessStatus,
  RequestedItem,
  RfqSpecs,
} from './types';

const SPEC_LABELS: Record<keyof RfqSpecs, string> = {
  size: 'size',
  material: 'material',
  grade: 'grade',
  brand: 'brand',
  standard: 'standard',
  thread: 'thread',
  dimension: 'dimension',
  bore_size: 'bore size',
  load_rating: 'load rating',
  notes: 'notes',
};

export function buildReviewReason(item: RequestedItem): string {
  if (item.cannot_quote_reason) {
    return `Manual override required before quoting: ${item.cannot_quote_reason}`;
  }
  if (item.missing_info.length > 0) {
    return `Missing required specifications: ${item.missing_info.join(', ')}.`;
  }
  if (item.completeness_status === 'ambiguous') {
    return 'Item type is ambiguous — customer description may refer to multiple product types.';
  }
  if (item.completeness_status === 'incomplete') {
    return 'AI extraction confidence is low — several fields could not be confirmed from the RFQ.';
  }
  if (item.readiness_status === 'need_human_review') {
    return 'Manual override required before quoting.';
  }
  if (item.readiness_status === 'need_clarification') {
    return 'Customer must confirm missing details before this line can be quoted.';
  }
  if (item.readiness_status === 'need_sourcing') {
    return 'No reliable BC match expected — supplier sourcing or manual price may be required.';
  }
  return 'Sales review recommended before proceeding to match or quote.';
}

export function generateClarificationMessage(
  item: RequestedItem,
  customerName?: string,
): string {
  const greeting = customerName ? `Hi ${customerName.split(' ')[0] || customerName},` : 'Hi,';
  const missing =
    item.missing_info.length > 0
      ? item.missing_info.join(', ')
      : 'material, bore size, load rating, and reference photo';
  const product = item.normalized_name || item.original_text;
  return `${greeting}\n\nMay we confirm the ${missing} for the following item?\n\n"${product}"\n\nPlease also let us know if you have a photo or supplier reference.\n\nThank you.`;
}

export function decisionToReadinessStatus(decision: ManualReviewDecision): ReadinessStatus {
  switch (decision) {
    case 'ready_to_match':
      return 'ready_to_match';
    case 'need_clarification':
      return 'need_clarification';
    case 'need_sourcing':
      return 'need_sourcing';
    case 'add_manual_price':
      return 'ready_to_match';
    case 'exclude_item':
      return 'ready_to_match';
    case 'cannot_quote':
      return 'cannot_quote';
    default:
      return 'need_human_review';
  }
}

export function decisionToRecommendedAction(decision: ManualReviewDecision): string {
  switch (decision) {
    case 'ready_to_match':
      return 'Search BC inventory and past quotes';
    case 'need_clarification':
      return 'Send clarification to customer — blocked from Quote Builder';
    case 'need_sourcing':
      return 'Search suppliers or create supplier RFQ';
    case 'add_manual_price':
      return 'Manual price entered — confirm before Quote Builder';
    case 'exclude_item':
      return 'Excluded from current quotation';
    case 'cannot_quote':
      return 'Cannot quote — reason recorded';
    default:
      return 'Sales review';
  }
}

export function listEditedFields(before: RequestedItem, after: Partial<RequestedItem>): string[] {
  const edited: string[] = [];
  const check = (key: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) edited.push(key);
  };

  check('normalized_name', before.normalized_name, after.normalized_name);
  check('product_type', before.product_type, after.product_type);
  check('quantity', before.quantity, after.quantity);
  check('uom', before.uom, after.uom);
  check('specs', before.specs, after.specs);

  return edited;
}

export function specChips(specs: RfqSpecs): Array<{ key: keyof RfqSpecs; label: string; value: string }> {
  return (Object.keys(SPEC_LABELS) as Array<keyof RfqSpecs>)
    .filter((k) => specs[k])
    .map((k) => ({ key: k, label: SPEC_LABELS[k], value: specs[k]! }));
}
