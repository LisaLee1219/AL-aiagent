/**
 * Tool Execution Layer
 * 
 * Executes tool calls from agents against real Business Central data
 * and other backend services.
 */

import { TOOLS } from './agent-config';

// ============================================================
// Tool Call Parsing
// ============================================================

export interface ToolCall {
  tool: string;
  params: Record<string, string>;
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

    // Validate tool exists
    if (TOOLS[toolName]) {
      calls.push({ tool: toolName, params });
    }
  }

  return calls;
}

/**
 * Remove tool call markers from text for display
 */
export function stripToolCalls(text: string): string {
  return text.replace(/\[TOOL:\w+\|[^\]]+\]/g, '').trim();
}

// ============================================================
// Tool Execution
// ============================================================

interface ToolResult {
  tool: string;
  success: boolean;
  data: unknown;
  error?: string;
}

async function fetchFromApi(path: string, options?: RequestInit): Promise<unknown> {
  const listenPort =
    process.env.PORT || process.env.DEPLOY_RUN_PORT || '5001';
  const baseUrl = `http://localhost:${listenPort}`;
  
  const response = await fetch(`${baseUrl}${path}`, {
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

async function executeQueryProducts(params: Record<string, string>): Promise<ToolResult> {
  try {
    const keyword = params.keyword || '';
    const top = params.top || '10';
    const url = `/api/bc/items?top=${top}${keyword ? `&search=${encodeURIComponent(keyword)}` : ''}`;
    const result = await fetchFromApi(url) as { success: boolean; data: unknown[]; source?: string };
    return { tool: 'query_products', success: true, data: result.data };
  } catch (err) {
    return { tool: 'query_products', success: false, data: null, error: String(err) };
  }
}

async function executeQueryOrders(params: Record<string, string>): Promise<ToolResult> {
  try {
    const top = params.top || '20';
    const customer = params.customer || '';
    const status = params.status || '';
    let url = `/api/bc/sales-orders?top=${top}&withLines=false`;
    if (customer) url += `&customer=${encodeURIComponent(customer)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    const result = await fetchFromApi(url) as { success: boolean; data: unknown[]; source?: string };
    return { tool: 'query_orders', success: true, data: result.data };
  } catch (err) {
    return { tool: 'query_orders', success: false, data: null, error: String(err) };
  }
}

async function executeQuerySalesLines(params: Record<string, string>): Promise<ToolResult> {
  try {
    const top = params.top || '50';
    const documentNo = params.documentNo || '';
    const itemNo = params.itemNo || '';
    const search = params.search || '';
    let url = `/api/bc/sales-lines?top=${top}`;
    if (documentNo) url += `&documentNo=${encodeURIComponent(documentNo)}`;
    if (itemNo) url += `&itemNo=${encodeURIComponent(itemNo)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const result = await fetchFromApi(url) as { success: boolean; data: unknown[]; source?: string };
    return { tool: 'query_sales_lines', success: true, data: result.data };
  } catch (err) {
    return { tool: 'query_sales_lines', success: false, data: null, error: String(err) };
  }
}

async function executeQueryInventory(params: Record<string, string>): Promise<ToolResult> {
  try {
    const itemNo = params.itemNo || '';
    const location = params.location || '';
    let url = `/api/bc/items?top=50`;
    if (itemNo) url += `&itemNo=${encodeURIComponent(itemNo)}`;
    const result = await fetchFromApi(url) as { success: boolean; data: unknown[]; source?: string };
    // Filter for inventory-relevant fields
    const inventoryData = Array.isArray(result.data) ? (result.data as Record<string, unknown>[]).map((item) => ({
      number: item.number,
      description: item.description,
      lastDirectCost: item.lastDirectCost ?? item.unitCost,
      unitCost: item.lastDirectCost ?? item.unitCost,
      unitPrice: item.unitPrice,
      type: item.type,
      blocked: item.blocked,
    })) : result.data;
    return { tool: 'query_inventory', success: true, data: inventoryData };
  } catch (err) {
    return { tool: 'query_inventory', success: false, data: null, error: String(err) };
  }
}

async function executeParseEmail(params: Record<string, string>): Promise<ToolResult> {
  try {
    const result = await fetchFromApi('/api/ai/parse-email', {
      method: 'POST',
      body: JSON.stringify({
        emailContent: params.emailContent || '',
        emailSubject: params.emailSubject || '',
        emailFrom: params.emailFrom || '',
      }),
    }) as { success: boolean; data: unknown };
    return { tool: 'parse_email', success: true, data: result.data };
  } catch (err) {
    return { tool: 'parse_email', success: false, data: null, error: String(err) };
  }
}

async function executeGenerateReport(params: Record<string, string>): Promise<ToolResult> {
  try {
    const reportType = params.reportType || 'sales';
    const period = params.period || '';
    const format = params.format || 'summary';
    // Generate report by querying relevant data
    let data: unknown = null;
    if (reportType === 'sales' || reportType === 'financial') {
      const statsResult = await fetchFromApi('/api/bc/stats') as { success: boolean; data: unknown };
      data = statsResult.data;
    } else if (reportType === 'inventory') {
      const itemsResult = await fetchFromApi('/api/bc/items?top=50') as { success: boolean; data: unknown[] };
      data = itemsResult.data;
    }
    return { 
      tool: 'generate_report', 
      success: true, 
      data: { reportType, period, format, generatedData: data } 
    };
  } catch (err) {
    return { tool: 'generate_report', success: false, data: null, error: String(err) };
  }
}

async function executeSendEmail(params: Record<string, string>): Promise<ToolResult> {
  // Email sending is simulated - in production, integrate with SMTP or API
  return { 
    tool: 'send_email', 
    success: true, 
    data: { 
      message: 'Email queued successfully (simulated)',
      to: params.to,
      subject: params.subject,
      note: 'In production, connect to SMTP/email service for actual delivery'
    } 
  };
}

/**
 * Execute a single tool call and return the result
 */
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

/**
 * Execute all tool calls found in agent text, return formatted results
 */
export async function executeAllToolCalls(text: string): Promise<ToolResult[]> {
  const calls = parseToolCalls(text);
  if (calls.length === 0) return [];
  
  // Execute tools in parallel
  const results = await Promise.all(calls.map(call => executeTool(call)));
  return results;
}

/**
 * Format tool results as a context string for the LLM
 */
export function formatToolResults(results: ToolResult[]): string {
  if (results.length === 0) return '';
  
  let output = '\n\n--- Tool Results ---\n';
  for (const result of results) {
    output += `\n[Tool: ${result.tool}] ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
    if (result.success && result.data) {
      output += '```json\n' + JSON.stringify(result.data, null, 2).slice(0, 3000) + '\n```\n';
    } else if (result.error) {
      output += `Error: ${result.error}\n`;
    }
  }
  output += '--- End Tool Results ---\n\n';
  output += 'Based on the tool results above, please provide your analysis and recommendations.\n';
  
  return output;
}
