import type { WorkflowStep } from './types';

export const WORKFLOW_MAP: Array<{
  key: WorkflowStep;
  label: string;
  helper: string;
}> = [
  {
    key: 'rfq',
    label: 'Intake',
    helper: 'Capture customer RFQ from email or WhatsApp.',
  },
  {
    key: 'extract',
    label: 'AI Extract',
    helper: 'Extract requested items, quantities, urgency, and required quote details.',
  },
  {
    key: 'readiness',
    label: 'Readiness Check',
    helper: 'Check whether each item has enough information to quote safely.',
  },
  {
    key: 'match',
    label: 'Internal Match',
    helper: 'Search BC items, inventory, past sales, and past quotations.',
  },
  {
    key: 'sourcing',
    label: 'Supplier Sourcing',
    helper: 'Recommend suppliers or create supplier RFQs for unmatched items.',
  },
  {
    key: 'builder',
    label: 'Quote Builder',
    helper: 'Build quote lines only from verified prices and approved sources.',
  },
  {
    key: 'bc-quote',
    label: 'Send / BC Quote',
    helper: 'Create draft quote in Business Central and prepare customer reply.',
  },
];

export const TARGET_MARGIN_PERCENT = 15;
