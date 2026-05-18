'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Sparkles,
  Search,
  Calculator,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Package,
  Users,
  Database,
  Copy,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Upload,
} from 'lucide-react';
import type { CustomerEmail, ExtractedInfo, HistoricalOrder } from '@/lib/mock-data';
import { mockEmails } from '@/lib/mock-data';
import { readApiErrorMessage } from '@/lib/api-error';
import { WORKFLOW_MAP, TARGET_MARGIN_PERCENT } from '@/lib/sales-quote-copilot/constants';
import { buildRfqExtraction, buildRequestedItem } from '@/lib/sales-quote-copilot/build-rfq';
import {
  buildSupplierRfqDraft,
  DEMO_SUPPLIERS,
  recommendSuppliers,
} from '@/lib/sales-quote-copilot/demo-data';
import type { InternalMatchBundle } from '@/lib/sales-quote-copilot/internal-match-types';
import {
  applyInternalMatchProgressEvent,
  consumeInternalMatchStream,
  createInternalMatchLiveState,
  type InternalMatchLiveState,
} from '@/lib/sales-quote-copilot/internal-match-progress';
import { InternalMatchPanel } from '@/components/sales-quote-copilot/InternalMatchPanel';
import {
  ManualReviewDrawer,
  type ManualReviewSavePayload,
} from '@/components/sales-quote-copilot/ManualReviewDrawer';
import { ReadinessCheckActions } from '@/components/sales-quote-copilot/ReadinessCheckActions';
import { QuoteBuilderPanel } from '@/components/sales-quote-copilot/QuoteBuilderPanel';
import { SupplierSourcingPanel } from '@/components/sales-quote-copilot/SupplierSourcingPanel';
import {
  buildQuoteLinesFromMatchSelections,
  countInternalMatchSelections,
  countQuoteReadyLines,
} from '@/lib/sales-quote-copilot/build-quote-lines';
import {
  getLineQuoteSource,
  needsSupplierSourcing,
} from '@/lib/sales-quote-copilot/line-quote-status';
import { readinessBadgeClass, readinessLabel } from '@/lib/sales-quote-copilot/logic';
import type {
  BcSyncState,
  FinalQuoteLine,
  ManualReviewDecision,
  MatchCandidate,
  RequestedItem,
  RfqExtraction,
  SupplierQuote,
  WorkflowStep,
} from '@/lib/sales-quote-copilot/types';

interface ScoredProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  listPrice: number;
  stock: number;
  leadTime: string;
  minOrderQty: number;
  relevanceScore: number;
  relevanceReason: string;
  source?: string;
}

interface ProductSearchResult {
  searchKeyword: string;
  status: string;
  statusMessage: string;
  products: ScoredProduct[];
  historicalOrders: HistoricalOrder[];
}

interface MailboxEmail extends CustomerEmail {
  date?: string;
  preview?: string;
  direction?: 'inbound' | 'outbound';
  folder?: 'inbox' | 'sent';
  to?: string[];
  cc?: string[];
  source?: 'eml_upload' | string;
  attachmentCount?: number;
  messageId?: string;
}

function isOutboundMailboxEmail(email: MailboxEmail): boolean {
  return email.direction === 'outbound' || email.folder === 'sent';
}

function filterMailboxEmails(emails: MailboxEmail[], view: 'all' | 'inbox' | 'sent'): MailboxEmail[] {
  if (view === 'all') return emails;
  if (view === 'inbox') return emails.filter((email) => !isOutboundMailboxEmail(email));
  return emails.filter((email) => isOutboundMailboxEmail(email));
}

function formatMailboxDate(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  'rfq',
  'extract',
  'readiness',
  'match',
  'sourcing',
  'builder',
  'bc-quote',
];

const STEP_LABELS: Record<WorkflowStep, string> = {
  rfq: 'Select RFQ',
  extract: 'AI Extract',
  readiness: 'Readiness Check',
  match: 'Internal Match',
  sourcing: 'Supplier Sourcing',
  builder: 'Quote Builder',
  'bc-quote': 'BC Quote',
};

export function SalesQuoteWorkflow() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('rfq');
  const [emails, setEmails] = useState<MailboxEmail[]>(mockEmails as MailboxEmail[]);
  const [selectedEmail, setSelectedEmail] = useState<MailboxEmail | null>(null);
  const [rfq, setRfq] = useState<RfqExtraction | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [items, setItems] = useState<RequestedItem[]>([]);
  const [matchMap, setMatchMap] = useState<Record<string, MatchCandidate[]>>({});
  const [internalMatchBundles, setInternalMatchBundles] = useState<InternalMatchBundle[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchProgress, setMatchProgress] = useState<InternalMatchLiveState | null>(null);
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuote[]>([]);
  const [quoteLines, setQuoteLines] = useState<FinalQuoteLine[]>([]);
  const [reviewLineId, setReviewLineId] = useState<string | null>(null);
  const [reviewInitialDecision, setReviewInitialDecision] = useState<ManualReviewDecision | undefined>();
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiParseNotice, setAiParseNotice] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [rfqDraft, setRfqDraft] = useState('');
  const [bcSync, setBcSync] = useState<BcSyncState>({ status: 'idle' });
  const [mailboxView, setMailboxView] = useState<'all' | 'inbox' | 'sent'>('all');
  const [emlUploading, setEmlUploading] = useState(false);
  const [emlNotice, setEmlNotice] = useState<string | null>(null);
  const emlInputRef = useRef<HTMLInputElement>(null);
  const stepIndex = WORKFLOW_STEPS.indexOf(currentStep);

  const filteredEmails = useMemo(
    () => filterMailboxEmails(emails, mailboxView),
    [emails, mailboxView],
  );

  useEffect(() => {
    fetch('/api/emails/list?top=30&folder=all')
      .then((r) => r.json())
      .then((d) => {
        const incoming = d.emails || d.data;
        if (d.success && incoming?.length) {
          setEmails(incoming);
          return;
        }
        setEmails(mockEmails as MailboxEmail[]);
      })
      .catch(() => setEmails(mockEmails as MailboxEmail[]));
  }, []);

  useEffect(() => {
    if (expandedEmail && !filteredEmails.some((email) => email.id === expandedEmail)) {
      setExpandedEmail(null);
    }
    if (selectedEmail && !filteredEmails.some((email) => email.id === selectedEmail.id)) {
      setSelectedEmail(null);
    }
  }, [filteredEmails, expandedEmail, selectedEmail]);

  const applyInternalMatchBundles = useCallback((bundles: InternalMatchBundle[]) => {
    setMatchMap((prev) => {
      const next: Record<string, MatchCandidate[]> = { ...prev };
      const syncedBundles: InternalMatchBundle[] = [];

      bundles.forEach((b) => {
        const prevLine = prev[b.lineId] || [];
        const prevSelected = prevLine.find((c) => c.selected);
        let ranked = b.rankedCandidates.map((c) => {
          const wasSelected = prevLine.find((p) => p.id === c.id)?.selected;
          if (wasSelected) return { ...c, selected: true };
          if (prevSelected && c.item_no === prevSelected.item_no) {
            return { ...c, selected: true };
          }
          return c;
        });
        if (prevSelected && !ranked.some((c) => c.selected)) {
          const fallback = ranked.find((c) => c.item_no === prevSelected.item_no) ?? ranked[0];
          if (fallback) {
            ranked = ranked.map((c) => ({ ...c, selected: c.id === fallback.id }));
          }
        } else if (!prevSelected && !ranked.some((c) => c.selected) && ranked.length > 0) {
          ranked = ranked.map((c, i) => ({ ...c, selected: i === 0 }));
        }
        next[b.lineId] = ranked;
        syncedBundles.push({ ...b, rankedCandidates: ranked });
      });

      setInternalMatchBundles(syncedBundles);
      return next;
    });

    setProductSearchResults(
      bundles.map((b) => ({
        searchKeyword: b.originalText,
        status: b.bestMatch && b.bestMatch.confidence_score >= 70 ? 'matched' : 'partial_match',
        statusMessage: b.bestMatch?.confidence_reason || '',
        products: b.rankedCandidates.map((c) => ({
          id: c.id,
          sku: c.item_no,
          name: c.description,
          category: c.matched_specs[0] || '',
          costPrice: c.cost,
          listPrice: c.suggested_selling_price,
          stock: c.available_stock ?? 0,
          leadTime: '',
          minOrderQty: 1,
          relevanceScore: c.confidence_score,
          relevanceReason: c.confidence_reason,
        })),
        historicalOrders: [],
      })),
    );

    if (bundles.every((b) => b.rankedCandidates.length === 0)) {
      setAiParseNotice(
        'Internal Match completed, but BC returned no usable candidates for the current RFQ wording.',
      );
    }
  }, []);

  const runInternalMatch = useCallback(
    async (lines: RequestedItem[], company: string) => {
      setMatchLoading(true);
      setAiParseNotice(null);
      const payload = lines.map((it) => ({
        lineId: it.line_id,
        originalText: it.original_text,
        quantity: it.quantity,
        uom: it.uom,
        productType: it.product_type,
        specsSummary: Object.values(it.specs)
          .filter(Boolean)
          .join(' · '),
      }));
      setMatchProgress(createInternalMatchLiveState(payload.length));

      try {
        const res = await fetch('/api/sales/internal-match/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: payload, customerName: company }),
        });
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, 'Internal Match failed'));
        }

        let finalBundles: InternalMatchBundle[] = [];

        await consumeInternalMatchStream(res, (event) => {
          if (event.type === 'error') {
            throw new Error(event.message);
          }
          if (event.type === 'complete') {
            finalBundles = event.bundles;
          }
          setMatchProgress((prev) =>
            prev ? applyInternalMatchProgressEvent(prev, event) : prev,
          );
        });

        if (finalBundles.length === 0) {
          throw new Error('Internal Match returned no data');
        }
        applyInternalMatchBundles(finalBundles);
      } catch (error) {
        setAiParseNotice(error instanceof Error ? error.message : 'Internal Match failed');
      } finally {
        setMatchLoading(false);
        setMatchProgress(null);
      }
    },
    [applyInternalMatchBundles],
  );

  const handleSelectMatchCandidate = (
    lineId: string,
    candidateId: string,
    selected: boolean,
  ) => {
    const update = (c: MatchCandidate) => {
      if (c.id === candidateId) {
        return {
          ...c,
          selected,
          verified: c.confidence_score >= 90 ? selected : c.verified,
        };
      }
      if (selected) {
        return { ...c, selected: false };
      }
      return c;
    };

    setMatchMap((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] || []).map(update),
    }));
    setInternalMatchBundles((bundles) =>
      bundles.map((b) =>
        b.lineId === lineId
          ? { ...b, rankedCandidates: b.rankedCandidates.map(update) }
          : b,
      ),
    );
  };

  const handleEmlFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setEmlUploading(true);
    setEmlNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/emails/parse-eml', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Failed to read .eml file'));
      const data = await res.json();
      const uploaded = data.email as MailboxEmail;

      setEmails((prev) => {
        const withoutDup = prev.filter((item) => item.id !== uploaded.id);
        return [uploaded, ...withoutDup];
      });
      setMailboxView('inbox');
      setSelectedEmail(uploaded);
      setExpandedEmail(uploaded.id);
      await handleParseEmail(uploaded);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setEmlNotice(msg);
    } finally {
      setEmlUploading(false);
    }
  };

  const handleParseEmail = async (email: CustomerEmail) => {
    setSelectedEmail(email);
    setIsProcessing(true);
    setCurrentStep('extract');
    setAiParseNotice(null);
    try {
      const res = await fetch('/api/ai/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailContent: email.body,
          emailSubject: email.subject,
          emailFrom: email.from,
        }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'RFQ extraction failed'));
      const result = await res.json();
      const extraction = buildRfqExtraction(result.rfq || result.data || {}, email.from);
      setRfq(extraction);
      setItems(extraction.items);
      setExtractedInfo({
        customerName: extraction.customer.name,
        companyName: extraction.customer.company,
        products: extraction.items.map((i) => i.original_text),
        quantity: 'See line items',
        urgency:
          extraction.request.urgency === 'urgent'
            ? 'high'
            : extraction.request.urgency === 'low'
              ? 'low'
              : 'medium',
        keyRequirements: extraction.request.summary ? [extraction.request.summary] : [],
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      setAiParseNotice(msg);
      const demoProducts = [
        'Bolt M16 x 100mm Grade 8.8',
        'Nut M16 Grade 8.8',
        'Flat Washer M16 Grade 8.8',
        'Spring Washer M16 Grade 8.8',
        'Flat Wheel 4 inch',
        'Machine Screw Allen Type M14 x 30mm',
      ];
      const demoItems = demoProducts.map((p, i) => buildRequestedItem(`line-${i + 1}`, p));
      setItems(demoItems);
      setRfq({
        customer: { name: email.fromName, company: 'Client A Construction Pte Ltd', email: email.from, channel: 'email' },
        request: { type: 'RFQ', urgency: 'urgent', required_details: { price: true, lead_time: true, delivery_fee: true, vat: true, item_photo: true }, summary: 'Demo RFQ — fasteners and wheels' },
        items: demoItems,
      });
      setExtractedInfo({
        customerName: email.fromName,
        companyName: 'Client A Construction Pte Ltd',
        products: demoProducts,
        quantity: 'Various',
        urgency: 'high',
        keyRequirements: ['Price', 'Lead time', 'Delivery fee', 'VAT'],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItem = (lineId: string, patch: Partial<RequestedItem>) => {
    setItems((prev) => prev.map((it) => (it.line_id === lineId ? { ...it, ...patch } : it)));
  };

  const internalMatchSelectedCount = useMemo(
    () => countInternalMatchSelections(items, matchMap),
    [items, matchMap],
  );

  const quoteReadyCount = useMemo(
    () => countQuoteReadyLines(items, matchMap, supplierQuotes),
    [items, matchMap, supplierQuotes],
  );

  const internalReadyLineIds = useMemo(
    () =>
      items
        .filter((item) => getLineQuoteSource(item, matchMap, supplierQuotes) === 'internal_match')
        .map((item) => item.line_id),
    [items, matchMap, supplierQuotes],
  );

  const sourcingLineIds = useMemo(
    () => items.filter((item) => needsSupplierSourcing(item, matchMap, supplierQuotes)).map((i) => i.line_id),
    [items, matchMap, supplierQuotes],
  );

  const refreshQuoteLines = useCallback(() => {
    setQuoteLines(buildQuoteLinesFromMatchSelections(items, matchMap, supplierQuotes));
  }, [items, matchMap, supplierQuotes]);

  useEffect(() => {
    refreshQuoteLines();
  }, [refreshQuoteLines]);

  const formatCurrency = (n: number) =>
    `SGD ${n.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const reviewItem = useMemo(
    () => items.find((i) => i.line_id === reviewLineId) ?? null,
    [items, reviewLineId],
  );

  const activeReadinessItems = useMemo(
    () => items.filter((i) => !i.excluded && i.readiness_status !== 'cannot_quote'),
    [items],
  );

  const excludedItems = useMemo(() => items.filter((i) => i.excluded), [items]);

  const cannotQuoteItems = useMemo(
    () => items.filter((i) => !i.excluded && i.readiness_status === 'cannot_quote'),
    [items],
  );

  const openManualReview = (lineId: string, decision?: ManualReviewDecision) => {
    setReviewInitialDecision(decision);
    setReviewLineId(lineId);
  };

  const handleSaveManualReview = ({ item }: ManualReviewSavePayload) => {
    updateItem(item.line_id, item);
    if (item.readiness_status === 'need_sourcing' && !item.excluded) {
      setCurrentStep('sourcing');
    }
  };

  const handleSearchBcForLine = async (lineId: string) => {
    const line = items.find((i) => i.line_id === lineId);
    if (!line || line.excluded) return;
    setCurrentStep('match');
    await runInternalMatch([line], rfq?.customer.company || '');
  };

  const handleAskCustomer = (lineId: string) => {
    openManualReview(lineId, 'need_clarification');
  };

  const handleSearchSupplierForLine = (lineId: string) => {
    setCurrentStep('sourcing');
  };

  const handleCreateSupplierRfq = (lineId: string) => {
    const item = items.find((i) => i.line_id === lineId);
    if (!item) return;
    const sup = recommendSuppliers(item.product_type)[0];
    const specs = Object.values(item.specs).filter(Boolean).join(', ');
    setRfqDraft(
      buildSupplierRfqDraft(sup.name, [
        { name: item.normalized_name, qty: item.quantity, specs },
      ]),
    );
    setCurrentStep('sourcing');
  };

  const goToQuoteBuilder = useCallback(() => {
    refreshQuoteLines();
    setCurrentStep('builder');
  }, [refreshQuoteLines]);

  return (
    <div className="space-y-6">
      {/* Workflow map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Sales Quote Copilot — Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {WORKFLOW_MAP.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setCurrentStep(s.key)}
                className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                  currentStep === s.key ? 'border-blue-500 bg-blue-50' : 'hover:bg-muted/50'
                }`}
              >
                <span className="font-semibold text-[10px] text-muted-foreground">{i + 1}</span>
                <div className="font-medium leading-tight">{s.label}</div>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{s.helper}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {WORKFLOW_STEPS.map((key, idx) => (
          <div key={key} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentStep(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                currentStep === key ? 'bg-blue-600 text-white' : idx < stepIndex ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              {STEP_LABELS[key]}
            </button>
            {idx < WORKFLOW_STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step: Select RFQ */}
      {currentStep === 'rfq' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600" />Select RFQ</CardTitle>
            <CardDescription>Capture customer RFQ from inbox, WhatsApp, or an uploaded .eml file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-3">
              <input
                ref={emlInputRef}
                type="file"
                accept=".eml"
                className="hidden"
                onChange={handleEmlFileSelected}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={emlUploading || isProcessing}
                  onClick={() => emlInputRef.current?.click()}
                >
                  {emlUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload .eml
                </Button>
                <p className="text-xs text-muted-foreground">
                  Import a saved Outlook / RFC822 email — AI will extract the RFQ automatically.
                </p>
              </div>
              {emlNotice && <p className="text-xs text-red-600">{emlNotice}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant={mailboxView === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setMailboxView('all')}>
                All Mail
              </Button>
              <Button type="button" variant={mailboxView === 'inbox' ? 'default' : 'outline'} size="sm" onClick={() => setMailboxView('inbox')}>
                Inbox
              </Button>
              <Button type="button" variant={mailboxView === 'sent' ? 'default' : 'outline'} size="sm" onClick={() => setMailboxView('sent')}>
                Replies
              </Button>
            </div>
            {filteredEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No {mailboxView === 'sent' ? 'replies' : mailboxView === 'inbox' ? 'inbox messages' : 'messages'} found.
              </p>
            ) : (
              filteredEmails.map((email) => {
                const isExpanded = expandedEmail === email.id;
                const isSelected = selectedEmail?.id === email.id;
                const isOutbound = isOutboundMailboxEmail(email);
                const formattedDate = formatMailboxDate(email.date || email.receivedAt);

                return (
                  <div
                    key={email.id}
                    role="button"
                    tabIndex={0}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors min-w-0 overflow-hidden ${
                      isSelected ? 'border-blue-500 bg-blue-50/50' : 'hover:bg-muted/40'
                    }`}
                    onClick={() => {
                      setSelectedEmail(email);
                      setExpandedEmail(isExpanded ? null : email.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedEmail(email);
                        setExpandedEmail(isExpanded ? null : email.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-sm pr-2">
                        {isOutbound
                          ? `Reply to ${email.to?.[0] || email.subject}`
                          : `${email.fromName} — ${email.subject}`}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={isOutbound ? 'outline' : 'secondary'}>
                          {email.source === 'eml_upload' ? 'Upload' : isOutbound ? 'Reply' : 'Inbox'}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isOutbound
                        ? `To: ${email.to?.join(', ') || 'Unknown recipient'}`
                        : `From: ${email.from}`}
                      {formattedDate ? ` · ${formattedDate}` : ''}
                    </p>
                    {!isExpanded && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                        {email.preview || email.body.slice(0, 160)}
                        {!email.preview && email.body.length > 160 ? '…' : ''}
                      </p>
                    )}
                    {isExpanded && (
                      <div
                        className="mt-3 pt-3 border-t space-y-2 min-w-0"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <p className="text-xs font-medium text-muted-foreground">Full message</p>
                        <div className="max-h-[min(20rem,45vh)] overflow-y-auto overscroll-contain rounded-md border bg-muted/20 p-3">
                          <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed break-words">
                            {email.body}
                          </pre>
                        </div>
                        {email.cc && email.cc.length > 0 && (
                          <p className="text-xs text-muted-foreground">Cc: {email.cc.join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <Button
              className="w-full mt-1"
              disabled={!selectedEmail || isOutboundMailboxEmail(selectedEmail)}
              onClick={() => selectedEmail && handleParseEmail(selectedEmail)}
            >
              <Sparkles className="h-4 w-4 mr-2" /> AI Extract RFQ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: AI Extract */}
      {currentStep === 'extract' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" />AI Extract</CardTitle>
            <CardDescription>Structured RFQ extraction — source of truth for downstream steps.</CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
            ) : rfq ? (
              <div className="space-y-4">
                {aiParseNotice && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{aiParseNotice}</div>
                )}
                {rfq.request.summary && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">{rfq.request.summary}</div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Customer</span><div className="font-medium">{rfq.customer.name}</div></div>
                  <div><span className="text-muted-foreground">Company</span><div className="font-medium">{rfq.customer.company}</div></div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50"><tr>
                      <th className="p-2 text-left">Original Request</th>
                      <th className="p-2 text-left">Normalized</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Qty</th>
                      <th className="p-2 text-left">UOM</th>
                      <th className="p-2 text-left">Specs</th>
                    </tr></thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.line_id} className="border-t">
                          <td className="p-2">{it.original_text}</td>
                          <td className="p-2">{it.normalized_name}</td>
                          <td className="p-2">{it.product_type}</td>
                          <td className="p-2 text-right tabular-nums">{it.quantity}</td>
                          <td className="p-2 uppercase">{it.uom}</td>
                          <td className="p-2 text-muted-foreground">{Object.values(it.specs).filter(Boolean).join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={() => setCurrentStep('readiness')}>Continue to Readiness Check <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Select an RFQ first.</p>
            )}
          </CardContent>
        </Card>
      )}


      {currentStep === 'readiness' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Readiness Check</CardTitle>
            <CardDescription>
              Use Manual Review to correct AI extraction and set workflow status. All active lines can be searched in
              Internal Match (Need Clarification may be less precise). Need Clarification and Cannot Quote remain
              blocked from Quote Builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Original</th>
                  <th className="p-2 text-left">Normalized</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Specs</th>
                  <th className="p-2 text-left">Qty</th>
                  <th className="p-2 text-left">UOM</th>
                  <th className="p-2 text-left">Missing</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Recommended</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeReadinessItems.map((it) => (
                  <tr key={it.line_id} className="border-t">
                    <td className="p-2 max-w-[140px]">{it.original_text}</td>
                    <td className="p-2">{it.normalized_name}</td>
                    <td className="p-2">{it.product_type}</td>
                    <td className="p-2">{Object.values(it.specs).filter(Boolean).join(', ') || '—'}</td>
                    <td className="p-2 text-right tabular-nums">{it.quantity}</td>
                    <td className="p-2 uppercase">{it.uom}</td>
                    <td className="p-2 text-amber-700">{it.missing_info.join(', ') || '—'}</td>
                    <td className="p-2">
                      <Badge className={readinessBadgeClass(it.readiness_status)}>
                        {readinessLabel(it.readiness_status)}
                      </Badge>
                      {it.manual_price?.confirmed && (
                        <Badge variant="outline" className="ml-1 text-[10px] border-purple-300 text-purple-800">
                          Manual Price
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{it.recommended_action}</td>
                    <td className="p-2">
                      <ReadinessCheckActions
                        item={it}
                        onSearchBc={handleSearchBcForLine}
                        onManualReview={(id) => openManualReview(id)}
                        onAskCustomer={handleAskCustomer}
                        onSearchSupplier={handleSearchSupplierForLine}
                        onCreateRfq={handleCreateSupplierRfq}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {excludedItems.length > 0 && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-xs font-semibold mb-2 text-muted-foreground">Excluded from quotation</p>
                <ul className="text-xs space-y-1">
                  {excludedItems.map((it) => (
                    <li key={it.line_id} className="flex justify-between gap-2">
                      <span>{it.original_text}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => openManualReview(it.line_id)}
                      >
                        Manual Review
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cannotQuoteItems.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                <p className="text-xs font-semibold mb-2 text-red-800">Cannot quote</p>
                <ul className="text-xs space-y-2">
                  {cannotQuoteItems.map((it) => (
                    <li key={it.line_id}>
                      <p className="font-medium">{it.original_text}</p>
                      <p className="text-red-700 mt-0.5">{it.cannot_quote_reason || 'No reason recorded'}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] mt-1"
                        onClick={() => openManualReview(it.line_id)}
                      >
                        Manual Review
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              className="mt-2"
              onClick={async () => {
                const ready = items.filter(
                  (i) => !i.excluded && i.readiness_status !== 'cannot_quote',
                );
                setCurrentStep('match');
                if (ready.length) await runInternalMatch(ready, rfq?.customer.company || '');
              }}
            >
              Continue to Internal Match
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 'match' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Internal Match
            </CardTitle>
            <CardDescription>
              Customer request on the left; AI-ranked matches and optional BC inventory, sales, and purchase
              details on the right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiParseNotice && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {aiParseNotice}
              </div>
            )}
            <InternalMatchPanel
              bundles={internalMatchBundles}
              loading={matchLoading}
              progress={matchProgress}
              onSelectCandidate={handleSelectMatchCandidate}
            />
            {!matchLoading && internalMatchBundles.length === 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  const ready = items.filter((i) => !i.excluded);
                  if (ready.length) await runInternalMatch(ready, rfq?.customer.company || '');
                }}
              >
                Run match again
              </Button>
            )}
            {!matchLoading && internalMatchBundles.length > 0 && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  <strong className="text-foreground">{internalMatchSelectedCount}</strong> BC selected
                </span>
                <span>
                  <strong className="text-foreground">{sourcingLineIds.length}</strong> need supplier / web
                </span>
                <span>
                  <strong className="text-foreground">{quoteReadyCount}</strong> ready for quote
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={matchLoading || sourcingLineIds.length === 0}
                onClick={() => setCurrentStep('sourcing')}
              >
                Supplier Sourcing
                {sourcingLineIds.length > 0 ? ` (${sourcingLineIds.length})` : ''}
              </Button>
              <Button
                variant="default"
                disabled={matchLoading || quoteReadyCount === 0}
                onClick={goToQuoteBuilder}
              >
                Quote Builder ({quoteReadyCount} line{quoteReadyCount === 1 ? '' : 's'})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'sourcing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Users className="h-5 w-5 text-muted-foreground" />
              Supplier Sourcing
            </CardTitle>
            <CardDescription>
              Lines not in BC or not selected in Internal Match — contact suppliers, run web search, then add
              unit cost. BC-selected lines are remembered and merge in Quote Builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rfqDraft && (
              <div className="rounded-md border p-3 text-xs">
                <p className="font-medium mb-2">Supplier RFQ draft</p>
                <pre className="whitespace-pre-wrap text-muted-foreground">{rfqDraft}</pre>
              </div>
            )}
            <SupplierSourcingPanel
              items={items}
              matchMap={matchMap}
              supplierQuotes={supplierQuotes}
              sourcingLineIds={sourcingLineIds}
              internalReadyLineIds={internalReadyLineIds}
              onAddSupplierQuote={(q) => setSupplierQuotes((prev) => [...prev, q])}
              onUpdateSupplierQuote={(id, patch) =>
                setSupplierQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
              }
              onRemoveSupplierQuote={(id) =>
                setSupplierQuotes((prev) => prev.filter((q) => q.id !== id))
              }
              onRfqDraft={setRfqDraft}
            />
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setCurrentStep('match')}>
                Back to Internal Match
              </Button>
              <Button disabled={quoteReadyCount === 0} onClick={goToQuoteBuilder}>
                Quote Builder ({quoteReadyCount} line{quoteReadyCount === 1 ? '' : 's'})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 'builder' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Quote Builder
            </CardTitle>
            <CardDescription>
              BC selections and supplier-sourced lines are combined here. Customer reply mirrors the original RFQ
              email format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuoteBuilderPanel
              quoteLines={quoteLines}
              rfq={rfq}
              selectedEmail={selectedEmail}
              selectedMatchCount={quoteReadyCount}
              onQuoteLinesChange={setQuoteLines}
            />
            <Button className="mt-2" disabled={!quoteLines.length} onClick={() => setCurrentStep('bc-quote')}>
              Continue to BC Quote
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStep === 'bc-quote' && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />BC Quote</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button disabled={!quoteLines.length} onClick={() => setBcSync({ status: 'success', bc_quote_no: 'SQ-DEMO-2025-0142', synced_at: new Date().toLocaleString() })}>Create Draft Quote in BC</Button>
            {bcSync.bc_quote_no && <p className="text-sm text-green-700">BC Quote {bcSync.bc_quote_no} (draft)</p>}
            <p className="text-xs text-muted-foreground">Review quote lines before sending to the customer.</p>
          </CardContent>
        </Card>
      )}

      <ManualReviewDrawer
        open={!!reviewLineId}
        onOpenChange={(open) => {
          if (!open) {
            setReviewLineId(null);
            setReviewInitialDecision(undefined);
          }
        }}
        item={reviewItem}
        rfq={rfq}
        rfqSource={selectedEmail ? `Email: ${selectedEmail.subject}` : undefined}
        reviewedBy={rfq?.customer.email || 'Sales User'}
        initialDecision={reviewInitialDecision}
        onSave={handleSaveManualReview}
      />
    </div>
  );
}
