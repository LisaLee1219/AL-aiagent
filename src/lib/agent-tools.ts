/**
 * Tool Execution Layer
 *
 * Executes tool calls from agents against real Business Central data
 * and other backend services.
 */

import {
  findItemByNumber,
  getItemLastDirectCost,
  getItems,
  getSalesLines,
  getSalesLinesStats,
  getSalesOrders,
  isBCConfigured,
} from '@/lib/business-central';
import { mockERPProducts, mockHistoricalOrders } from '@/lib/mock-data';
import { TOOLS } from './agent-config';

// ============================================================
// Tool Call Parsing
// ============================================================

export interface ToolCall {
  tool: string;
  params: Record<string, string>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  data: unknown;
  error?: string;
}

/**
 * Parse [TOOL:tool_name|key=value|key=value] patterns from agent output
 */
export function parseToolCalls(text: string): ToolCall[] {
  const regex = /\[TOOL:(\w+)\|([^\]]+)\]/g;
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const toolName = match[1];
    const paramsStr = match[2];
    const params: Record<string, string> = {};

    paramsStr.split('|').forEach((pair) => {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        params[key.trim()] = valueParts.join('=').trim();
      }
    });

    if (TOOLS[toolName]) {
      calls.push({ tool: toolName, params });
    }
  }

  return calls;
}

export function stripToolCalls(text: string): string {
  return text.replace(/\[TOOL:\w+\|[^\]]+\]/g, '').trim();
}

// ============================================================
// Tool Execution (direct BC / mock — no HTTP loop)
// ============================================================

function mapItemRow(item: {
  number: string;
  description: string;
  unitPrice?: number;
  inventoryPostingGroup?: string;
  baseUnitOfMeasure?: string;
  blocked?: boolean;
  lastDirectCost?: number;
  unitCost?: number;
}) {
  return {
    number: item.number,
    description: item.description,
    unitCost: item.lastDirectCost ?? item.unitCost ?? 0,
    unitPrice: item.unitPrice ?? 0,
    category: item.inventoryPostingGroup || '—',
    uom: item.baseUnitOfMeasure || 'PCS',
    blocked: item.blocked ?? false,
  };
}

function mockProducts(keyword: string, top: number) {
  const kw = keyword.toLowerCase();
  return mockERPProducts
    .filter(
      (p) =>
        !kw ||
        p.sku.toLowerCase().includes(kw) ||
        p.name.toLowerCase().includes(kw) ||
        p.category.toLowerCase().includes(kw),
    )
    .slice(0, top)
    .map((p) => ({
      number: p.sku,
      description: p.name,
      unitCost: p.costPrice,
      unitPrice: p.listPrice,
      category: p.category,
      uom: 'PCS',
      blocked: false,
    }));
}

async function executeQueryProducts(params: Record<string, string>): Promise<ToolResult> {
  const keyword = params.keyword || '';
  const top = Math.min(parseInt(params.top || '10', 10) || 10, 30);

  try {
    if (await isBCConfigured()) {
      const items = await getItems({ search: keyword || undefined, top });
      return {
        tool: 'query_products',
        success: true,
        data: {
          source: 'business_central',
          keyword: keyword || '(all)',
          count: items.length,
          items: items.map((i) =>
            mapItemRow({
              number: i.number,
              description: i.description,
              unitPrice: i.unitPrice,
              inventoryPostingGroup: i.inventoryPostingGroup,
              baseUnitOfMeasure: i.baseUnitOfMeasure,
              blocked: i.blocked,
              lastDirectCost: getItemLastDirectCost(i),
            }),
          ),
        },
      };
    }

    const items = mockProducts(keyword, top);
    return {
      tool: 'query_products',
      success: true,
      data: { source: 'mock', keyword: keyword || '(all)', count: items.length, items },
    };
  } catch (err) {
    const items = mockProducts(keyword, top);
    return {
      tool: 'query_products',
      success: items.length > 0,
      data: {
        source: 'mock_fallback',
        keyword,
        count: items.length,
        items,
        note: err instanceof Error ? err.message : String(err),
      },
      error: items.length === 0 ? String(err) : undefined,
    };
  }
}

async function executeQueryOrders(params: Record<string, string>): Promise<ToolResult> {
  const top = Math.min(parseInt(params.top || '20', 10) || 20, 40);
  const customer = params.customer || '';

  try {
    if (await isBCConfigured()) {
      const orders = await getSalesOrders({ top });
      const filtered = customer
        ? orders.filter(
            (o) =>
              o.Sell_to_Customer_Name?.toLowerCase().includes(customer.toLowerCase()) ||
              o.Sell_to_Customer_No?.toLowerCase().includes(customer.toLowerCase()),
          )
        : orders;

      return {
        tool: 'query_orders',
        success: true,
        data: {
          source: 'business_central',
          count: filtered.length,
          orders: filtered.slice(0, top).map((o) => ({
            orderNo: o.No,
            customer: o.Sell_to_Customer_Name,
            customerNo: o.Sell_to_Customer_No,
            date: o.Order_Date,
            status: o.Status,
            currency: o.Currency_Code,
          })),
        },
      };
    }

    const orders = mockHistoricalOrders
      .filter((o) => !customer || o.customer.toLowerCase().includes(customer.toLowerCase()))
      .slice(0, top)
      .map((o) => ({
        orderNo: o.orderId,
        customer: o.customer,
        date: o.date,
        status: o.status,
        total: o.totalPrice,
      }));

    return {
      tool: 'query_orders',
      success: true,
      data: { source: 'mock', count: orders.length, orders },
    };
  } catch (err) {
    return { tool: 'query_orders', success: false, data: null, error: String(err) };
  }
}

async function executeQuerySalesLines(params: Record<string, string>): Promise<ToolResult> {
  const top = Math.min(parseInt(params.top || '50', 10) || 50, 60);
  const documentNo = params.documentNo || '';
  const itemNo = params.itemNo || '';
  const search = params.search || '';

  try {
    if (await isBCConfigured()) {
      let filter: string | undefined;
      if (search) {
        filter = `(contains(No, '${search.replace(/'/g, "''")}') or contains(Description, '${search.replace(/'/g, "''")}'))`;
      }
      const lines = await getSalesLines({
        top,
        documentNo: documentNo || undefined,
        itemNo: itemNo || undefined,
        filter,
      });

      return {
        tool: 'query_sales_lines',
        success: true,
        data: {
          source: 'business_central',
          count: lines.length,
          lines: lines.slice(0, top).map((l) => ({
            documentNo: l.Document_No,
            itemNo: l.No,
            description: l.Description,
            quantity: l.Quantity,
            unitPrice: l.Unit_Price,
            lineAmount: l.Line_Amount,
            customer: l.Shortcut_Dimension_2_Code,
          })),
        },
      };
    }

    return {
      tool: 'query_sales_lines',
      success: true,
      data: { source: 'mock', count: 0, lines: [], note: 'BC not configured' },
    };
  } catch (err) {
    return { tool: 'query_sales_lines', success: false, data: null, error: String(err) };
  }
}

async function executeQueryInventory(params: Record<string, string>): Promise<ToolResult> {
  const itemNo = params.itemNo || params.keyword || '';

  try {
    if (await isBCConfigured()) {
      if (itemNo) {
        const item = await findItemByNumber(itemNo);
        if (item) {
          return {
            tool: 'query_inventory',
            success: true,
            data: {
              source: 'business_central',
              items: [mapItemRow({ ...item, lastDirectCost: getItemLastDirectCost(item) })],
            },
          };
        }
      }
      const items = await getItems({ search: itemNo || undefined, top: 20 });
      return {
        tool: 'query_inventory',
        success: true,
        data: {
          source: 'business_central',
          count: items.length,
          items: items.map((i) =>
            mapItemRow({ ...i, lastDirectCost: getItemLastDirectCost(i) }),
          ),
        },
      };
    }

    const items = mockProducts(itemNo, 20);
    return {
      tool: 'query_inventory',
      success: true,
      data: { source: 'mock', count: items.length, items },
    };
  } catch (err) {
    return { tool: 'query_inventory', success: false, data: null, error: String(err) };
  }
}

function getInternalApiBaseUrl(): string {
  if (process.env.AGENT_INTERNAL_BASE_URL?.trim()) {
    return process.env.AGENT_INTERNAL_BASE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
  }
  const port = process.env.PORT || process.env.DEPLOY_RUN_PORT || '5001';
  return `http://127.0.0.1:${port}`;
}

async function fetchFromApi(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(`${getInternalApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

async function executeParseEmail(params: Record<string, string>): Promise<ToolResult> {
  try {
    const result = (await fetchFromApi('/api/ai/parse-email', {
      method: 'POST',
      body: JSON.stringify({
        emailContent: params.emailContent || '',
        emailSubject: params.emailSubject || '',
        emailFrom: params.emailFrom || '',
      }),
    })) as { success: boolean; data: unknown };
    return { tool: 'parse_email', success: true, data: result.data };
  } catch (err) {
    return { tool: 'parse_email', success: false, data: null, error: String(err) };
  }
}

async function executeGenerateReport(params: Record<string, string>): Promise<ToolResult> {
  const reportType = params.reportType || 'sales';
  const period = params.period || '';
  const format = params.format || 'summary';

  try {
    let generatedData: unknown = null;
    let source = 'mock';

    if (await isBCConfigured()) {
      source = 'business_central';
      if (reportType === 'sales' || reportType === 'financial') {
        generatedData = await getSalesLinesStats();
      } else if (reportType === 'inventory') {
        const items = await getItems({ top: 50 });
        generatedData = items.map((i) =>
          mapItemRow({ ...i, lastDirectCost: getItemLastDirectCost(i) }),
        );
      }
    } else if (reportType === 'inventory') {
      generatedData = mockProducts('', 50);
    } else {
      generatedData = { note: 'BC not configured — connect BC for live reports' };
    }

    return {
      tool: 'generate_report',
      success: true,
      data: { source, reportType, period, format, generatedData },
    };
  } catch (err) {
    return { tool: 'generate_report', success: false, data: null, error: String(err) };
  }
}

async function executeSendEmail(params: Record<string, string>): Promise<ToolResult> {
  return {
    tool: 'send_email',
    success: true,
    data: {
      message: 'Email queued successfully (simulated)',
      to: params.to,
      subject: params.subject,
      note: 'In production, connect to SMTP/email service for actual delivery',
    },
  };
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const executors: Record<string, (params: Record<string, string>) => Promise<ToolResult>> = {
    query_products: executeQueryProducts,
    query_orders: executeQueryOrders,
    query_sales_lines: executeQuerySalesLines,
    query_inventory: executeQueryInventory,
    parse_email: executeParseEmail,
    generate_report: executeGenerateReport,
    send_email: executeSendEmail,
  };

  const executor = executors[call.tool];
  if (!executor) {
    return { tool: call.tool, success: false, data: null, error: `Unknown tool: ${call.tool}` };
  }

  return executor(call.params);
}

export async function executeAllToolCalls(text: string): Promise<ToolResult[]> {
  const calls = parseToolCalls(text);
  if (calls.length === 0) return [];
  return Promise.all(calls.map((call) => executeTool(call)));
}

export function formatToolResults(
  results: ToolResult[],
  options?: { header?: string; footer?: string },
): string {
  if (results.length === 0) return '';

  const header = options?.header ?? 'Tool Results';
  const footer =
    options?.footer ??
    'Based on the data above, answer the user. Do not invent numbers not present in the JSON.';

  let output = `\n\n--- ${header} ---\n`;
  for (const result of results) {
    output += `\n[Tool: ${result.tool}] ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
    if (result.success && result.data) {
      output += '```json\n' + JSON.stringify(result.data, null, 2).slice(0, 6000) + '\n```\n';
    } else if (result.error) {
      output += `Error: ${result.error}\n`;
    }
  }
  output += `--- End ${header} ---\n\n`;
  output += footer + '\n';

  return output;
}
