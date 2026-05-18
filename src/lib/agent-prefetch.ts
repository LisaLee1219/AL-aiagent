import type { ToolCall } from '@/lib/agent-tools';
import { executeTool, formatToolResults } from '@/lib/agent-tools';

const PRODUCT_INTENT =
  /\b(product|item|sku|stock|inventory|price|cost|castor|wheel|valve|fastener|bolt|nut|hardware|物料|产品|库存|价格|型号|货号|轮子|脚轮)\b/i;
const ORDER_INTENT =
  /\b(order|sales\s*order|purchase|customer|quote|quotation|订单|客户|报价|销售)\b/i;
const SALES_LINE_INTENT = /\b(sales\s*line|line\s*item|order\s*line|行项目|明细)\b/i;
const STATS_INTENT =
  /\b(stats|statistics|revenue|margin|report|summary|dashboard|销售额|统计|报表|收入|毛利)\b/i;
const INVENTORY_INTENT = /\b(inventory|stock\s*level|available|in\s*stock|库存|现货|有货)\b/i;

const QUESTION_PREFIX =
  /^(what|how|show|find|search|list|get|tell|查|找|搜|列|显示|有没有|多少|帮我|请)\s+/i;

function extractSearchKeyword(message: string): string {
  const quoted = message.match(/["']([^"']{2,80})["']/);
  if (quoted?.[1]) return quoted[1].trim();

  let cleaned = message.replace(/[?？!！。,，;；]/g, ' ').trim();
  cleaned = cleaned.replace(QUESTION_PREFIX, '').trim();
  if (cleaned.length > 100) {
    return cleaned.slice(0, 100).trim();
  }
  return cleaned || message.trim().slice(0, 80);
}

function extractCustomerHint(message: string): string {
  const m = message.match(
    /(?:customer|client|for|from|客户)\s+["']?([A-Za-z0-9 &.\-]{2,60})["']?/i,
  );
  return m?.[1]?.trim() || '';
}

function extractDocumentNo(message: string): string {
  const m = message.match(/\b(SO|PO|QT|INV)[-\s]?\d{3,}\b/i);
  return m?.[0]?.replace(/\s+/g, '') || '';
}

export interface PrefetchResult {
  context: string;
  tools: string[];
}

/**
 * Before the LLM answers, fetch likely-relevant live data based on the user question.
 */
export async function prefetchDataForUserMessage(message: string): Promise<PrefetchResult> {
  const text = message.trim();
  if (!text || text.length < 3) {
    return { context: '', tools: [] };
  }

  const calls: ToolCall[] = [];
  const keyword = extractSearchKeyword(text);
  const customer = extractCustomerHint(text);
  const documentNo = extractDocumentNo(text);

  if (STATS_INTENT.test(text)) {
    calls.push({ tool: 'generate_report', params: { reportType: 'sales', format: 'summary' } });
  }

  if (PRODUCT_INTENT.test(text) || INVENTORY_INTENT.test(text)) {
    calls.push({
      tool: INVENTORY_INTENT.test(text) ? 'query_inventory' : 'query_products',
      params: {
        keyword,
        top: '15',
        ...(INVENTORY_INTENT.test(text) && keyword.length <= 20 ? { itemNo: keyword } : {}),
      },
    });
  }

  if (ORDER_INTENT.test(text)) {
    calls.push({
      tool: 'query_orders',
      params: {
        top: '15',
        ...(customer ? { customer } : {}),
      },
    });
  }

  if (SALES_LINE_INTENT.test(text) || documentNo) {
    calls.push({
      tool: 'query_sales_lines',
      params: {
        top: '25',
        ...(documentNo ? { documentNo } : {}),
        ...(keyword && !documentNo ? { search: keyword } : {}),
      },
    });
  }

  // Deduplicate by tool name (keep first)
  const seen = new Set<string>();
  const uniqueCalls = calls.filter((c) => {
    if (seen.has(c.tool)) return false;
    seen.add(c.tool);
    return true;
  });

  if (uniqueCalls.length === 0) {
    return { context: '', tools: [] };
  }

  const results = await Promise.all(uniqueCalls.map((call) => executeTool(call)));
  const context = formatToolResults(results, {
    header: 'Pre-fetched live system data (use as primary source for this answer)',
    footer:
      'Answer the user using only the data above for factual claims. If insufficient, say what is missing and optionally call [TOOL:...] for a narrower search.',
  });

  return {
    context,
    tools: uniqueCalls.map((c) => c.tool),
  };
}
