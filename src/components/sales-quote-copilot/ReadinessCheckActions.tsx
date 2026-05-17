'use client';

import { Button } from '@/components/ui/button';
import type { RequestedItem } from '@/lib/sales-quote-copilot/types';

interface ReadinessCheckActionsProps {
  item: RequestedItem;
  onSearchBc: (lineId: string) => void;
  onManualReview: (lineId: string, mode?: 'default' | 'clarification') => void;
  onAskCustomer: (lineId: string) => void;
  onSearchSupplier: (lineId: string) => void;
  onCreateRfq: (lineId: string) => void;
}

export function ReadinessCheckActions({
  item,
  onSearchBc,
  onManualReview,
  onAskCustomer,
  onSearchSupplier,
  onCreateRfq,
}: ReadinessCheckActionsProps) {
  if (item.excluded) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        onClick={() => onManualReview(item.line_id)}
      >
        Manual Review
      </Button>
    );
  }

  if (item.readiness_status === 'cannot_quote') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px]"
        onClick={() => onManualReview(item.line_id)}
      >
        Manual Review
      </Button>
    );
  }

  if (item.readiness_status === 'ready_to_match') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-[10px]"
          onClick={() => onSearchBc(item.line_id)}
        >
          Search BC
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => onManualReview(item.line_id)}
        >
          Manual Review
        </Button>
      </div>
    );
  }

  if (item.readiness_status === 'need_clarification') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-[10px]"
          onClick={() => onAskCustomer(item.line_id)}
        >
          Ask Customer
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => onManualReview(item.line_id)}
        >
          Manual Review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px]"
          onClick={() => onSearchSupplier(item.line_id)}
        >
          Search Supplier
        </Button>
      </div>
    );
  }

  if (item.readiness_status === 'need_sourcing' || item.readiness_status === 'need_human_review') {
    return (
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="default"
          className="h-7 text-[10px]"
          onClick={() => onSearchSupplier(item.line_id)}
        >
          Search Supplier
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => onCreateRfq(item.line_id)}
        >
          Create RFQ
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px]"
          onClick={() => onManualReview(item.line_id)}
        >
          Manual Review
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-[10px]"
      onClick={() => onManualReview(item.line_id)}
    >
      Manual Review
    </Button>
  );
}
