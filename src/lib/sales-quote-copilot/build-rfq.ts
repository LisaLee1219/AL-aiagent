import type { ExtractedInfo } from '@/lib/mock-data';
import type { CompletenessStatus, ReadinessStatus, RequestedItem, RfqExtraction, RfqSpecs } from './types';

function inferProductType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('bolt') || t.includes('nut') || t.includes('washer') || t.includes('screw')) return 'Fasteners';
  if (t.includes('wheel') || t.includes('castor')) return 'Castors & Wheels';
  if (t.includes('valve')) return 'Valves';
  if (t.includes('pressure')) return 'Instrumentation';
  return 'Industrial Supplies';
}

function parseSpecs(text: string): RfqSpecs {
  const specs: RfqSpecs = {};
  const t = text;
  const grade = t.match(/grade\s*([\d.]+)/i) || t.match(/g([\d.]+)/i);
  if (grade) specs.grade = grade[1] || grade[0];
  const thread = t.match(/m(\d+)/i);
  if (thread) specs.thread = `M${thread[1]}`;
  const dim = t.match(/(\d+)\s*x\s*(\d+)\s*mm/i);
  if (dim) specs.dimension = `${dim[1]} x ${dim[2]}mm`;
  const sizeInch = t.match(/(\d+)\s*inch/i);
  if (sizeInch) specs.size = `${sizeInch[1]} inch`;
  return specs;
}

/** Split numeric quantity from unit (e.g. "10 EA" → qty 10, uom EA). */
export function normalizeQuantityUom(
  quantity: unknown,
  uom?: unknown,
): { quantity: number; uom: string } {
  const uomStr = typeof uom === 'string' ? uom.trim() : '';
  if (uomStr && !/^\d/.test(uomStr)) {
    const parsedQty =
      typeof quantity === 'number'
        ? quantity
        : parseFloat(String(quantity ?? '').replace(/,/g, ''));
    return {
      quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
      uom: uomStr.toUpperCase(),
    };
  }

  const raw =
    typeof quantity === 'number' ? String(quantity) : String(quantity ?? '').trim();
  if (!raw) return { quantity: 1, uom: 'PCS' };

  const combined = raw.match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?([A-Za-z][A-Za-z0-9/-]*)$/i);
  if (combined) {
    return {
      quantity: parseFloat(combined[1]),
      uom: combined[2].toUpperCase(),
    };
  }

  const parsedQty = parseFloat(raw.replace(/,/g, ''));
  if (Number.isFinite(parsedQty)) {
    return {
      quantity: parsedQty > 0 ? parsedQty : 1,
      uom: uomStr ? uomStr.toUpperCase() : 'PCS',
    };
  }

  return { quantity: 1, uom: 'PCS' };
}

function deriveReadiness(
  originalText: string,
  specs: RfqSpecs,
  missing: string[],
): { status: ReadinessStatus; action: string; completeness: CompletenessStatus } {
  const t = originalText.toLowerCase();
  if (t.includes('flat wheel') || (t.includes('wheel') && t.includes('4'))) {
    const miss = ['material', 'bore size', 'load rating', 'reference photo'];
    return {
      status: 'need_clarification',
      action: 'Ask customer for wheel material, bore, load rating, and photo',
      completeness: 'incomplete',
    };
  }
  if (missing.length > 0) {
    return {
      status: 'need_human_review',
      action: 'Sales review before BC search',
      completeness: 'ambiguous',
    };
  }
  if (specs.thread && specs.dimension && specs.grade) {
    return {
      status: 'ready_to_match',
      action: 'Search BC inventory and past quotes',
      completeness: 'complete',
    };
  }
  if (specs.thread || specs.grade) {
    return {
      status: 'ready_to_match',
      action: 'Search BC — verify remaining specs with customer if needed',
      completeness: 'complete',
    };
  }
  return {
    status: 'need_sourcing',
    action: 'Insufficient specs — try supplier sourcing',
    completeness: 'incomplete',
  };
}

export function buildRequestedItem(lineId: string, originalText: string, qty = 1): RequestedItem {
  const specs = parseSpecs(originalText);
  const missing: string[] = [];
  const t = originalText.toLowerCase();
  if (t.includes('wheel') && !specs.material) missing.push('material');
  if (t.includes('wheel') && !specs.size) missing.push('bore size / load rating');
  if (t.includes('bolt') && !specs.grade) missing.push('grade');
  if (t.includes('bolt') && !specs.dimension) missing.push('length');

  const { status, action, completeness } = deriveReadiness(originalText, specs, missing);

  return {
    line_id: lineId,
    original_text: originalText,
    normalized_name: originalText.replace(/\s+/g, ' ').trim(),
    product_type: inferProductType(originalText),
    quantity: qty,
    uom: 'pcs',
    specs,
    missing_info: missing,
    completeness_status: completeness,
    recommended_action: action,
    readiness_status: status,
  };
}

/** Build RFQ from API structured payload or legacy ExtractedInfo */
export function buildRfqExtraction(
  payload: Record<string, unknown>,
  emailFrom: string,
  fallback?: ExtractedInfo | null,
): RfqExtraction {
  if (payload.customer && payload.items && Array.isArray(payload.items)) {
    const items = (payload.items as Partial<RequestedItem>[]).map((it, i) => {
      const { quantity, uom } = normalizeQuantityUom(it.quantity, it.uom);
      const base = buildRequestedItem(
        it.line_id || `line-${i + 1}`,
        it.original_text || it.normalized_name || 'Unknown item',
        quantity,
      );
      return {
        ...base,
        ...it,
        line_id: it.line_id || base.line_id,
        quantity,
        uom,
        specs: { ...base.specs, ...(it.specs || {}) },
        missing_info: it.missing_info?.length ? it.missing_info : base.missing_info,
        readiness_status: it.readiness_status || base.readiness_status,
        recommended_action: it.recommended_action || base.recommended_action,
        completeness_status: it.completeness_status || base.completeness_status,
      };
    });
    return {
      customer: payload.customer as RfqExtraction['customer'],
      request: (payload.request || {
        type: 'RFQ',
        urgency: 'normal',
        required_details: { price: true, lead_time: true, delivery_fee: true, vat: true, item_photo: false },
      }) as RfqExtraction['request'],
      items,
    };
  }

  const products =
    (payload.products as string[]) ||
    fallback?.products ||
    [];
  const urgencyRaw = (payload.urgency as string) || fallback?.urgency || 'medium';
  const urgency =
    urgencyRaw === 'high' ? 'urgent' : urgencyRaw === 'low' ? 'low' : 'normal';

  const items = products.map((p, i) => buildRequestedItem(`line-${i + 1}`, p));

  return {
    customer: {
      name: (payload.customerName as string) || fallback?.customerName || '',
      company: (payload.companyName as string) || fallback?.companyName || '',
      email: emailFrom,
      channel: 'email',
    },
    request: {
      type: 'RFQ',
      urgency,
      required_details: {
        price: true,
        lead_time: true,
        delivery_fee: true,
        vat: true,
        item_photo: items.some((it) => it.product_type.includes('Wheel')),
      },
      summary: (payload.summary as string) || undefined,
    },
    items,
  };
}
