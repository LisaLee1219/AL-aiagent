export type WorkflowStep =
  | 'rfq'
  | 'extract'
  | 'readiness'
  | 'match'
  | 'sourcing'
  | 'builder'
  | 'bc-quote';

export type ReadinessStatus =
  | 'ready_to_match'
  | 'need_clarification'
  | 'need_human_review'
  | 'need_sourcing'
  | 'cannot_quote';

export type CompletenessStatus = 'complete' | 'incomplete' | 'ambiguous';

export type MatchSourceType =
  | 'item_master'
  | 'inventory'
  | 'past_sales'
  | 'past_purchase'
  | 'past_quote'
  | 'supplier_quote'
  | 'manual';

export type ApprovalStatus = 'pending' | 'approved' | 'needs_review' | 'blocked';

export interface RfqSpecs {
  size?: string;
  material?: string;
  grade?: string;
  brand?: string;
  standard?: string;
  thread?: string;
  dimension?: string;
  bore_size?: string;
  load_rating?: string;
  notes?: string;
}

export type ManualReviewDecision =
  | 'ready_to_match'
  | 'need_clarification'
  | 'need_sourcing'
  | 'add_manual_price'
  | 'exclude_item'
  | 'cannot_quote';

export interface ManualPriceEntry {
  cost: number;
  selling_price: number;
  currency: string;
  lead_time: string;
  price_source_note: string;
  validity_date: string;
  override_reason: string;
  confirmed: boolean;
}

export interface ManualReviewAudit {
  reviewed_by: string;
  reviewed_at: string;
  previous_status: ReadinessStatus;
  new_status: ReadinessStatus;
  decision: ManualReviewDecision;
  edited_fields: string[];
  override_reason?: string;
}

export interface RequestedItem {
  line_id: string;
  original_text: string;
  normalized_name: string;
  product_type: string;
  quantity: number;
  uom: string;
  specs: RfqSpecs;
  missing_info: string[];
  completeness_status: CompletenessStatus;
  recommended_action: string;
  readiness_status: ReadinessStatus;
  user_action?: string;
  excluded?: boolean;
  cannot_quote_reason?: string;
  clarification_draft?: string;
  manual_price?: ManualPriceEntry;
  manual_review_audit?: ManualReviewAudit;
}

export interface RfqExtraction {
  customer: {
    name: string;
    company: string;
    email: string;
    channel: 'email' | 'whatsapp';
  };
  request: {
    type: 'RFQ';
    urgency: 'urgent' | 'normal' | 'low';
    required_details: {
      price: boolean;
      lead_time: boolean;
      delivery_fee: boolean;
      vat: boolean;
      item_photo: boolean;
    };
    summary?: string;
  };
  items: RequestedItem[];
}

export interface MatchCandidate {
  id: string;
  requested_item_id: string;
  source_type: MatchSourceType;
  item_no: string;
  description: string;
  matched_specs: string[];
  missing_specs: string[];
  available_stock: number;
  last_sold_price?: number;
  last_sold_date?: string;
  last_quoted_price?: number;
  customer_name?: string;
  cost: number;
  suggested_selling_price: number;
  confidence_score: number;
  confidence_reason: string;
  risk_flags: string[];
  selected?: boolean;
  verified?: boolean;
  /** Traceability to unified quote evidence row */
  evidence_id?: string;
  cost_source?: string;
  price_source?: string;
  warnings?: string[];
}

export interface SupplierProfile {
  id: string;
  name: string;
  categories: string[];
  brands: string[];
  contact_person: string;
  email: string;
  whatsapp?: string;
  typical_lead_time: string;
  moq: string;
  payment_terms: string;
  reliability_score: number;
  price_level: 'low' | 'mid' | 'high';
  last_quote?: string;
  notes?: string;
}

export interface SupplierQuote {
  id: string;
  requested_item_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_price: number;
  currency: string;
  lead_time: string;
  moq: string;
  validity_date: string;
  notes: string;
}

export interface FinalQuoteLine {
  id: string;
  requested_item_id: string;
  requested_label: string;
  description: string;
  source_type: MatchSourceType | 'web_estimate';
  source_label: string;
  supplier?: string;
  quantity: number;
  cost: number;
  selling_price: number;
  discount: number;
  final_price: number;
  margin_percent: number;
  lead_time: string;
  confidence_score: number;
  approval_status: ApprovalStatus;
  risk_flags: string[];
  manual_override?: boolean;
  approved?: boolean;
  item_no?: string;
  uom?: string;
}

export interface BcSyncState {
  status: 'idle' | 'syncing' | 'success' | 'error';
  bc_quote_no?: string;
  synced_at?: string;
  error?: string;
}
