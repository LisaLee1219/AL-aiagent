'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  buildReviewReason,
  decisionToReadinessStatus,
  decisionToRecommendedAction,
  generateClarificationMessage,
  listEditedFields,
  specChips,
} from '@/lib/sales-quote-copilot/manual-review';
import { readinessBadgeClass, readinessLabel } from '@/lib/sales-quote-copilot/logic';
import type {
  ManualPriceEntry,
  ManualReviewAudit,
  ManualReviewDecision,
  RequestedItem,
  RfqExtraction,
  RfqSpecs,
} from '@/lib/sales-quote-copilot/types';
import { AlertTriangle, Copy, Check } from 'lucide-react';

const DECISIONS: Array<{ value: ManualReviewDecision; label: string; hint: string }> = [
  { value: 'ready_to_match', label: 'Ready to Match', hint: 'Proceed to Internal Match' },
  { value: 'need_clarification', label: 'Need Clarification', hint: 'Block from Quote Builder; draft customer message' },
  { value: 'need_sourcing', label: 'Need Sourcing', hint: 'Send to Supplier Sourcing' },
  { value: 'add_manual_price', label: 'Add Manual Price', hint: 'Manual price source — confirm before Quote Builder' },
  { value: 'exclude_item', label: 'Exclude Item', hint: 'Remove from current quotation' },
  { value: 'cannot_quote', label: 'Cannot Quote', hint: 'Requires reason; listed separately' },
];

const EMPTY_MANUAL_PRICE: ManualPriceEntry = {
  cost: 0,
  selling_price: 0,
  currency: 'SGD',
  lead_time: '',
  price_source_note: '',
  validity_date: '',
  override_reason: '',
  confirmed: false,
};

export interface ManualReviewSavePayload {
  item: RequestedItem;
  audit: ManualReviewAudit;
}

interface ManualReviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RequestedItem | null;
  rfq: RfqExtraction | null;
  rfqSource?: string;
  reviewedBy?: string;
  initialDecision?: ManualReviewDecision;
  onSave: (payload: ManualReviewSavePayload) => void;
}

function SpecField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs capitalize">{label}</Label>
      <Input className="h-8 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ManualReviewDrawer({
  open,
  onOpenChange,
  item,
  rfq,
  rfqSource,
  reviewedBy = 'Sales User',
  initialDecision,
  onSave,
}: ManualReviewDrawerProps) {
  const [draft, setDraft] = useState<RequestedItem | null>(null);
  const [decision, setDecision] = useState<ManualReviewDecision>('ready_to_match');
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [cannotQuoteReason, setCannotQuoteReason] = useState('');
  const [manualPrice, setManualPrice] = useState<ManualPriceEntry>(EMPTY_MANUAL_PRICE);
  const [priceConfirmed, setPriceConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) return;
    setDraft({ ...item, specs: { ...item.specs } });
    setDecision(initialDecision || mapStatusToDecision(item));
    setClarificationMessage(item.clarification_draft || generateClarificationMessage(item, rfq?.customer.name));
    setCannotQuoteReason(item.cannot_quote_reason || '');
    setManualPrice(item.manual_price ? { ...item.manual_price } : { ...EMPTY_MANUAL_PRICE });
    setPriceConfirmed(item.manual_price?.confirmed ?? false);
    setCopied(false);
    setSaveError(null);
  }, [open, item, rfq?.customer.name, initialDecision]);

  const reviewReason = useMemo(() => (draft ? buildReviewReason(draft) : ''), [draft]);

  if (!draft || !item) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-2xl w-full" />
      </Sheet>
    );
  }

  const updateSpec = (key: keyof RfqSpecs, value: string) => {
    setDraft((d) => (d ? { ...d, specs: { ...d.specs, [key]: value || undefined } } : d));
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(clarificationMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setSaveError(null);
    if (decision === 'cannot_quote' && !cannotQuoteReason.trim()) {
      setSaveError('Cannot Quote requires a reason.');
      return;
    }
    if (decision === 'add_manual_price') {
      if (!manualPrice.override_reason.trim()) {
        setSaveError('Manual price requires an override reason.');
        return;
      }
      if (!priceConfirmed) {
        setSaveError('Confirm manual price before saving.');
        return;
      }
      if (manualPrice.cost <= 0 || manualPrice.selling_price <= 0) {
        setSaveError('Enter valid cost and selling price.');
        return;
      }
    }

    const previousStatus = item.readiness_status;
    const newStatus = decisionToReadinessStatus(decision);
    const edited_fields = listEditedFields(item, draft);

    let next: RequestedItem = {
      ...draft,
      readiness_status: newStatus,
      recommended_action: decisionToRecommendedAction(decision),
      excluded: decision === 'exclude_item',
      cannot_quote_reason: decision === 'cannot_quote' ? cannotQuoteReason.trim() : undefined,
      clarification_draft: decision === 'need_clarification' ? clarificationMessage : draft.clarification_draft,
    };

    if (decision === 'add_manual_price') {
      next = {
        ...next,
        manual_price: { ...manualPrice, confirmed: true },
        readiness_status: 'ready_to_match',
        recommended_action: 'Manual price confirmed — proceed to Quote Builder',
      };
    } else {
      next = { ...next, manual_price: undefined };
    }

    if (decision === 'ready_to_match') {
      next = { ...next, excluded: false, cannot_quote_reason: undefined };
    }

    const audit: ManualReviewAudit = {
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      previous_status: previousStatus,
      new_status: next.readiness_status,
      decision,
      edited_fields,
      override_reason:
        decision === 'add_manual_price'
          ? manualPrice.override_reason
          : decision === 'cannot_quote'
            ? cannotQuoteReason
            : undefined,
    };

    next.manual_review_audit = audit;
    onSave({ item: next, audit });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-6 py-4 shrink-0">
          <SheetTitle>Manual Review</SheetTitle>
          <SheetDescription>
            Inspect AI extraction, correct specs, and set the next workflow status for this line.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4 pr-2">
            {/* 1. Original request */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Original customer request</h3>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-2">
                <p className="font-medium">{draft.original_text}</p>
                <dl className="text-xs grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd>{rfq?.customer.company || rfq?.customer.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">RFQ source</dt>
                    <dd>{rfqSource || rfq?.customer.channel || '—'}</dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* 2. AI extracted */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">AI extracted information</h3>
              <div className="rounded-lg border p-3 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Normalized</span>
                    <p className="font-medium">{draft.normalized_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p>{draft.product_type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Qty</span>
                    <p className="font-medium tabular-nums">{draft.quantity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">UOM</span>
                    <p className="uppercase">{draft.uom}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completeness</span>
                    <p className="capitalize">{draft.completeness_status}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {specChips(draft.specs).map((c) => (
                    <Badge key={c.key} variant="secondary" className="text-[10px]">
                      {c.label}: {c.value}
                    </Badge>
                  ))}
                </div>
                {draft.missing_info.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {draft.missing_info.map((m) => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="text-[10px] text-amber-800 border-amber-300 bg-amber-50"
                      >
                        Missing: {m}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge className={readinessBadgeClass(draft.readiness_status)}>
                    {readinessLabel(draft.readiness_status)}
                  </Badge>
                  <span className="text-muted-foreground">{draft.recommended_action}</span>
                </div>
              </div>
            </section>

            {/* 3. Risk reason */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Risk / review reason
              </h3>
              <p className="text-sm text-muted-foreground rounded-md border border-amber-200 bg-amber-50/80 p-3">
                {reviewReason}
              </p>
            </section>

            {/* 4. Editable fields */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Editable fields</h3>
              <div className="grid grid-cols-2 gap-3">
                <SpecField
                  label="Normalized name"
                  value={draft.normalized_name}
                  onChange={(v) => setDraft({ ...draft, normalized_name: v })}
                />
                <SpecField
                  label="Product type"
                  value={draft.product_type}
                  onChange={(v) => setDraft({ ...draft, product_type: v })}
                />
                <SpecField
                  label="Quantity"
                  value={String(draft.quantity)}
                  onChange={(v) => setDraft({ ...draft, quantity: Number(v) || 0 })}
                />
                <SpecField label="UOM" value={draft.uom} onChange={(v) => setDraft({ ...draft, uom: v })} />
                <SpecField label="Size" value={draft.specs.size || ''} onChange={(v) => updateSpec('size', v)} />
                <SpecField
                  label="Material"
                  value={draft.specs.material || ''}
                  onChange={(v) => updateSpec('material', v)}
                />
                <SpecField label="Grade" value={draft.specs.grade || ''} onChange={(v) => updateSpec('grade', v)} />
                <SpecField label="Brand" value={draft.specs.brand || ''} onChange={(v) => updateSpec('brand', v)} />
                <SpecField
                  label="Standard"
                  value={draft.specs.standard || ''}
                  onChange={(v) => updateSpec('standard', v)}
                />
                <SpecField label="Thread" value={draft.specs.thread || ''} onChange={(v) => updateSpec('thread', v)} />
                <SpecField
                  label="Dimension"
                  value={draft.specs.dimension || ''}
                  onChange={(v) => updateSpec('dimension', v)}
                />
                <SpecField
                  label="Bore size"
                  value={draft.specs.bore_size || ''}
                  onChange={(v) => updateSpec('bore_size', v)}
                />
                <SpecField
                  label="Load rating"
                  value={draft.specs.load_rating || ''}
                  onChange={(v) => updateSpec('load_rating', v)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  className="text-xs min-h-[72px]"
                  value={draft.specs.notes || ''}
                  onChange={(e) => updateSpec('notes', e.target.value)}
                />
              </div>
            </section>

            {/* 5. Decision */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Decision</h3>
              <RadioGroup value={decision} onValueChange={(v) => setDecision(v as ManualReviewDecision)}>
                {DECISIONS.map((d) => (
                  <div
                    key={d.value}
                    className="flex items-start gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem value={d.value} id={`dec-${d.value}`} className="mt-0.5" />
                    <Label htmlFor={`dec-${d.value}`} className="cursor-pointer flex-1">
                      <span className="font-medium text-sm">{d.label}</span>
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">{d.hint}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </section>

            {/* 6. Clarification message */}
            {decision === 'need_clarification' && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Customer clarification message</h3>
                <Textarea
                  className="text-sm min-h-[140px]"
                  value={clarificationMessage}
                  onChange={(e) => setClarificationMessage(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleCopyMessage}>
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copy message
                </Button>
              </section>
            )}

            {/* Cannot quote reason */}
            {decision === 'cannot_quote' && (
              <section className="space-y-2">
                <Label className="text-sm font-semibold">Cannot quote — reason (required)</Label>
                <Textarea
                  className="text-sm"
                  value={cannotQuoteReason}
                  onChange={(e) => setCannotQuoteReason(e.target.value)}
                  placeholder="e.g. Non-standard item outside company scope"
                />
              </section>
            )}

            {/* 7. Manual price */}
            {decision === 'add_manual_price' && (
              <section className="space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-700">Manual Price</Badge>
                  <span className="text-xs text-muted-foreground">
                    Item can enter Quote Builder only after you confirm below.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cost</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={manualPrice.cost || ''}
                      onChange={(e) =>
                        setManualPrice({ ...manualPrice, cost: parseFloat(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Selling price</Label>
                    <Input
                      type="number"
                      className="h-8 text-xs"
                      value={manualPrice.selling_price || ''}
                      onChange={(e) =>
                        setManualPrice({
                          ...manualPrice,
                          selling_price: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Currency</Label>
                    <Input
                      className="h-8 text-xs"
                      value={manualPrice.currency}
                      onChange={(e) => setManualPrice({ ...manualPrice, currency: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lead time</Label>
                    <Input
                      className="h-8 text-xs"
                      value={manualPrice.lead_time}
                      onChange={(e) => setManualPrice({ ...manualPrice, lead_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Price source note</Label>
                    <Input
                      className="h-8 text-xs"
                      value={manualPrice.price_source_note}
                      onChange={(e) =>
                        setManualPrice({ ...manualPrice, price_source_note: e.target.value })
                      }
                      placeholder="e.g. Phone quote from supplier X"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Validity date</Label>
                    <Input
                      className="h-8 text-xs"
                      value={manualPrice.validity_date}
                      onChange={(e) => setManualPrice({ ...manualPrice, validity_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Override reason (required)</Label>
                    <Textarea
                      className="text-xs min-h-[60px]"
                      value={manualPrice.override_reason}
                      onChange={(e) =>
                        setManualPrice({ ...manualPrice, override_reason: e.target.value })
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={priceConfirmed}
                    onChange={(e) => setPriceConfirmed(e.target.checked)}
                    className="rounded border-input"
                  />
                  I confirm this manual price is approved for quoting
                </label>
              </section>
            )}

            {/* 8. Audit trail preview */}
            {item.manual_review_audit && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Last audit trail</h3>
                <div className="text-xs rounded-md border bg-muted/20 p-3 space-y-1 font-mono">
                  <p>By: {item.manual_review_audit.reviewed_by}</p>
                  <p>At: {new Date(item.manual_review_audit.reviewed_at).toLocaleString()}</p>
                  <p>
                    Status: {item.manual_review_audit.previous_status} →{' '}
                    {item.manual_review_audit.new_status}
                  </p>
                  {item.manual_review_audit.edited_fields.length > 0 && (
                    <p>Edited: {item.manual_review_audit.edited_fields.join(', ')}</p>
                  )}
                </div>
              </section>
            )}

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-4 shrink-0 sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save review
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function mapStatusToDecision(item: RequestedItem): ManualReviewDecision {
  if (item.excluded) return 'exclude_item';
  if (item.readiness_status === 'cannot_quote') return 'cannot_quote';
  if (item.readiness_status === 'need_clarification') return 'need_clarification';
  if (item.readiness_status === 'need_sourcing') return 'need_sourcing';
  if (item.manual_price?.confirmed) return 'add_manual_price';
  return 'ready_to_match';
}
