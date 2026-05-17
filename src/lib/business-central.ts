/**
 * Microsoft Dynamics 365 Business Central On-Premise OData V4 集成模块
 *
 * 认证方式: Basic Auth (用户名/密码)
 * 协议: OData V4
 *
 * 环境变量:
 * - BC_ODATA_URL: OData V4 端点 (如 http://businesscentral.allinton.com.sg:17048/BC180/ODataV4)
 * - BC_USERNAME: 用户名 (如 ALLINTON\YIWEN.LI)
 * - BC_PASSWORD: 密码
 * - BC_COMPANY_ID: 公司 ID (可选，不设则自动取第一个公司)
 */

// ============ 类型定义 ============

export interface BCODataConfig {
  odataUrl: string;
  username: string;
  password: string;
  companyId?: string;
}

/** BC SalesOrderSalesLines 实体 (OData V4 字段名) */
export interface BCSalesLine {
  Document_Type: string;
  Document_No: string;
  Line_No: number;
  Type: string;                // Item, Resource, G/L Account, etc.
  No: string;                  // Item No.
  Description: string;
  Description_2: string;
  Quantity: number;
  Unit_of_Measure_Code: string;
  Unit_Cost_LCY: number;
  Unit_Price: number;
  Minimum_Price: number;
  Line_Discount_Percent: number;
  Line_Amount: number;
  Line_Discount_Amount: number;
  Location_Code: string;
  Qty_to_Ship: number;
  Quantity_Shipped: number;
  Qty_to_Invoice: number;
  Quantity_Invoiced: number;
  Shipment_Date: string;
  Item_Category_Code: string;
  Shortcut_Dimension_1_Code: string;
  Shortcut_Dimension_2_Code: string; // 通常是 Salesperson
  ShortcutDimCode3: string;
  ShortcutDimCode4: string;
  Purchasing_Code: string;
  Special_Order: boolean;
  Variant_Code: string;
  VAT_Prod_Posting_Group: string;
  Requested_Delivery_Date: string;
  Promised_Delivery_Date: string;
  Planned_Delivery_Date: string;
  Planned_Shipment_Date: string;
  Remarks: string;
}

/** BC SalesOrder 实体 (OData V4 字段名) */
export interface BCSalesOrder {
  Document_Type: string;
  No: string;
  Sell_to_Customer_No: string;
  Sell_to_Customer_Name: string;
  Order_Date: string;
  Posting_Date: string;
  Due_Date: string;
  Requested_Delivery_Date: string;
  Status: string;              // Draft, Released, etc.
  Salesperson_Code: string;
  Currency_Code: string;
  Prices_Including_VAT: boolean;
  Payment_Terms_Code: string;
  Shortcut_Dimension_1_Code: string;
  Shortcut_Dimension_2_Code: string;
  Ship_to_Code: string;
  Ship_to_Name: string;
  External_Document_No: string;
  Your_Reference: string;
  Location_Code: string;
}

/** BC workflowItems 实体 (OData V4 字段名) */
export interface BCItem {
  id: string;
  number: string;
  number2: string;
  description: string;
  description2: string;
  type: string;                // Inventory, Service, etc.
  baseUnitOfMeasure: string;
  unitPrice: number;
  unitCost: number;
  profitPercent: number;
  costingMethod: string;
  lastDirectCost: number;
  vendorNumber: string;
  vendorItemNumber: string;
  inventoryPostingGroup: string;
  itemDiscGroup: string;
  blocked: boolean;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (value === null || value === undefined || value === '') continue;
    const parsed = typeof value === 'number' ? value : parseFloat(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pickString(raw: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && value !== '') return String(value);
  }
  return fallback;
}

/** Item card Last Direct Cost (BC field Last_Direct_Cost). */
export function getItemLastDirectCost(item: BCItem): number {
  return item.lastDirectCost ?? 0;
}

/** Normalize raw workflowItems OData row to BCItem. */
export function normalizeBCItem(raw: Record<string, unknown>): BCItem {
  const lastDirectCost = pickNumber(raw, [
    'Last_Direct_Cost',
    'LastDirectCost',
    'lastDirectCost',
    'last_direct_cost',
  ]);
  const unitCost = pickNumber(raw, ['Unit_Cost', 'unitCost', 'unit_cost']);
  const unitPrice = pickNumber(raw, ['Unit_Price', 'unitPrice', 'unit_price']);

  return {
    id: pickString(raw, ['id', 'Id']),
    number: pickString(raw, ['number', 'Number']),
    number2: pickString(raw, ['number2', 'Number_2']),
    description: pickString(raw, ['description', 'Description']),
    description2: pickString(raw, ['description2', 'Description_2']),
    type: pickString(raw, ['type', 'Type']),
    baseUnitOfMeasure: pickString(
      raw,
      ['baseUnitOfMeasure', 'Base_Unit_of_Measure', 'Base_Unit_of_Measure_Code'],
      'PCS',
    ),
    unitPrice,
    unitCost,
    lastDirectCost,
    profitPercent: pickNumber(raw, ['profitPercent', 'Profit_Percent']),
    costingMethod: pickString(raw, ['costingMethod', 'Costing_Method']),
    vendorNumber: pickString(raw, ['vendorNumber', 'Vendor_No']),
    vendorItemNumber: pickString(raw, ['vendorItemNumber', 'Vendor_Item_No']),
    inventoryPostingGroup: pickString(raw, ['inventoryPostingGroup', 'Inventory_Posting_Group']),
    itemDiscGroup: pickString(raw, ['itemDiscGroup', 'Item_Disc_Group']),
    blocked: Boolean(raw.blocked ?? raw.Blocked),
  };
}

/** BC workflowCustomers 实体 (normalized app shape) */
export interface BCCustomer {
  id: string;
  number: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  balance: number;
}

function scoreCustomerSearch(term: string, customer: BCCustomer): number {
  const needle = term.toLowerCase();
  const haystacks = [
    customer.displayName,
    customer.number,
    customer.email,
    customer.phone,
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  let score = 0;
  for (const hay of haystacks) {
    if (hay === needle) score = Math.max(score, 100);
    else if (hay.startsWith(needle)) score = Math.max(score, 80);
    else if (hay.includes(needle)) score = Math.max(score, 60);
  }
  return score;
}

function rankCustomers(term: string, customers: BCCustomer[]): BCCustomer[] {
  return [...customers]
    .map((customer) => ({
      customer,
      score: scoreCustomerSearch(term, customer),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.customer);
}

function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/** Normalize raw workflowCustomers OData row (API fields vary by BC version). */
export function normalizeBCCustomer(raw: Record<string, unknown>): BCCustomer {
  return {
    id: pickString(raw, ['id', 'Id']),
    number: pickString(raw, ['number', 'Number', 'No']),
    displayName: pickString(raw, ['displayName', 'searchName', 'Name', 'Display_Name', 'Search_Name']),
    email: pickString(raw, ['E_Mail', 'Email', 'email']),
    phone: pickString(raw, ['Phone_No', 'Phone', 'phone']),
    address: pickString(raw, ['Address', 'address']),
    city: pickString(raw, ['City', 'city']),
    country: pickString(raw, ['Country_Region_Code', 'Country', 'country']),
    balance: pickNumber(raw, ['Balance_LCY', 'balance', 'Balance']),
  };
}

/** BC 公司信息 */
export interface BCCompany {
  Name: string;
  Display_Name: string;
  Id: string;
  Evaluation_Company: boolean;
}

// ============ 配置检查 ============

import { getSession } from '@/lib/auth/session';

/**
 * Get BC OData config.
 * Priority: session credentials (user's own BC login) > env vars (fallback for dev).
 * When called from an API route, pass the request to read session from cookies.
 */
export async function getBCODataConfig(): Promise<BCODataConfig | null> {
  // 1. Try session credentials first (user logged in with their own BC account)
  const session = await getSession();
  if (session?.username && session?.password) {
    return {
      odataUrl: session.odataUrl.replace(/\/$/, ''),
      username: session.username,
      password: session.password,
      companyId: session.companyId,
    };
  }

  // 2. Fallback to env vars (dev mode without login)
  const odataUrl = process.env.BC_ODATA_URL;
  const username = process.env.BC_USERNAME;
  const password = process.env.BC_PASSWORD;

  if (!odataUrl || !username || !password) {
    return null;
  }

  return {
    odataUrl: odataUrl.replace(/\/$/, ''),
    username,
    password,
    companyId: process.env.BC_COMPANY_ID,
  };
}

/** Check if BC is configured (either via session or env vars) */
export async function isBCConfigured(): Promise<boolean> {
  return (await getBCODataConfig()) !== null;
}

// ============ API 客户端 ============

/**
 * 通用 BC OData V4 请求方法
 * 使用 Basic Auth 认证
 */
async function odataRequest<T>(
  config: BCODataConfig,
  path: string,
  options?: {
    method?: string;
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  }
): Promise<T> {
  const companyId = await resolveCompanyId(config);

  // 构建 URL: {odataUrl}/Company('{companyId}')/{path}
  let url = `${config.odataUrl}/Company('${companyId}')/${path}`;

  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  // Basic Auth header
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers,
  };

  if (options?.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BC OData request failed (${response.status}) [${path}]: ${errorText}`);
  }

  const data = await response.json();
  // OData V4 返回的数组在 value 字段中
  return data.value !== undefined ? data.value : data;
}

/**
 * 不需要 Company ID 的请求 (如获取公司列表)
 */
async function odataRequestNoCompany<T>(
  config: BCODataConfig,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  let url = `${config.odataUrl}/${path}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BC OData request failed (${response.status}) [${path}]: ${errorText}`);
  }

  const data = await response.json();
  return data.value !== undefined ? data.value : data;
}

// ============ 公司 ============

let cachedCompanyId: string | null = null;

async function resolveCompanyId(config: BCODataConfig): Promise<string> {
  if (config.companyId) return config.companyId;
  if (cachedCompanyId) return cachedCompanyId;

  const companies = await odataRequestNoCompany<BCCompany[]>(config, 'Company', {
    '$top': '1',
  });

  if (!companies || companies.length === 0) {
    throw new Error('No company found in Business Central');
  }

  cachedCompanyId = companies[0].Id;
  return cachedCompanyId;
}

/**
 * 获取公司列表
 */
export async function getCompanies(): Promise<BCCompany[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');
  return odataRequestNoCompany<BCCompany[]>(config, 'Company');
}

// ============ Sales Lines (SalesOrderSalesLines) ============

/**
 * 获取销售订单行
 */
export async function getSalesLines(params?: {
  documentNo?: string;
  itemNo?: string;
  top?: number;
  skip?: number;
  filter?: string;
}): Promise<BCSalesLine[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  const filters: string[] = [];

  // 只取 Type=Item 的行（排除空行和文本行）
  filters.push("Type eq 'Item'");

  if (params?.documentNo) {
    filters.push(`Document_No eq '${params.documentNo}'`);
  }
  if (params?.itemNo) {
    filters.push(`No eq '${params.itemNo}'`);
  }
  if (params?.filter) {
    filters.push(params.filter);
  }

  queryParams['$filter'] = filters.join(' and ');
  queryParams['$orderby'] = 'Document_No desc, Line_No asc';

  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }
  if (params?.skip) {
    queryParams['$skip'] = String(params.skip);
  }

  return odataRequest<BCSalesLine[]>(config, 'SalesOrderSalesLines', { params: queryParams });
}

/**
 * 获取销售订单行 (salesDocumentLines - 包含 Quote/Order/Invoice 等)
 */
export async function getSalesDocumentLines(params?: {
  documentType?: string;
  documentNo?: string;
  itemNo?: string;
  top?: number;
  filter?: string;
}): Promise<BCSalesLine[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  const filters: string[] = [];

  filters.push("Type eq 'Item'");

  if (params?.documentType) {
    filters.push(`Document_Type eq '${params.documentType}'`);
  }
  if (params?.documentNo) {
    filters.push(`Document_No eq '${params.documentNo}'`);
  }
  if (params?.itemNo) {
    filters.push(`No eq '${params.itemNo}'`);
  }
  if (params?.filter) {
    filters.push(params.filter);
  }

  queryParams['$filter'] = filters.join(' and ');
  queryParams['$orderby'] = 'Document_No desc, Line_No asc';

  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }

  return odataRequest<BCSalesLine[]>(config, 'salesDocumentLines', { params: queryParams });
}

/** BC purchase document line (purchase orders / quotes) */
export interface BCPurchaseLine {
  Document_Type: string;
  Document_No: string;
  Line_No: number;
  Type: string;
  No: string;
  Description: string;
  Quantity: number;
  Unit_of_Measure_Code: string;
  Unit_Cost_LCY: number;
  Line_Amount: number;
  Buy_from_Vendor_No?: string;
  Buy_from_Vendor_Name?: string;
  Expected_Receipt_Date?: string;
  Location_Code?: string;
}

/**
 * Purchase document lines (PO history) — entity name may vary by BC version
 */
export async function getPurchaseDocumentLines(params?: {
  documentNo?: string;
  itemNo?: string;
  top?: number;
  filter?: string;
}): Promise<BCPurchaseLine[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  const filters: string[] = ["Type eq 'Item'"];

  if (params?.documentNo) {
    filters.push(`Document_No eq '${params.documentNo}'`);
  }
  if (params?.itemNo) {
    filters.push(`No eq '${params.itemNo}'`);
  }
  if (params?.filter) {
    filters.push(params.filter);
  }

  queryParams['$filter'] = filters.join(' and ');
  queryParams['$orderby'] = 'Document_No desc, Line_No asc';

  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }

  return odataRequest<BCPurchaseLine[]>(config, 'purchaseDocumentLines', {
    params: queryParams,
  });
}

// ============ Sales Orders ============

/**
 * 获取销售订单头
 */
export async function getSalesOrders(params?: {
  customerNo?: string;
  status?: string;
  salesperson?: string;
  search?: string;
  top?: number;
  filter?: string;
}): Promise<BCSalesOrder[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  const filters: string[] = [];

  if (params?.customerNo) {
    filters.push(`Sell_to_Customer_No eq '${params.customerNo}'`);
  }
  if (params?.status) {
    filters.push(`Status eq '${params.status}'`);
  }
  if (params?.salesperson) {
    filters.push(`Shortcut_Dimension_2_Code eq '${params.salesperson}'`);
  }
  if (params?.search) {
    filters.push(
      `(contains(Sell_to_Customer_Name, '${params.search}') or contains(No, '${params.search}'))`
    );
  }
  if (params?.filter) {
    filters.push(params.filter);
  }

  if (filters.length > 0) {
    queryParams['$filter'] = filters.join(' and ');
  }
  queryParams['$orderby'] = 'Order_Date desc';

  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }

  return odataRequest<BCSalesOrder[]>(config, 'SalesOrder', { params: queryParams });
}

// ============ Items (Products) ============

/**
 * 获取产品列表
 */
export async function getItems(params?: {
  search?: string;
  categoryCode?: string;
  top?: number;
  filter?: string;
}): Promise<BCItem[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  const filters: string[] = [];

  // 只取库存类型且未封锁的产品
  filters.push("type eq 'Inventory'");
  filters.push('blocked eq false');

  if (params?.search) {
    // BC OData does not support OR on distinct fields, so search description only
    filters.push(`contains(description, '${params.search}')`);
  }
  if (params?.filter) {
    filters.push(params.filter);
  }

  queryParams['$filter'] = filters.join(' and ');

  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }

  const rows = await odataRequest<Record<string, unknown>[]>(config, 'workflowItems', {
    params: queryParams,
  });
  return rows.map(normalizeBCItem);
}

/**
 * 按产品编号搜索产品
 */
export async function findItemByNumber(itemNo: string): Promise<BCItem | null> {
  const items = await getItems({ filter: `number eq '${itemNo}'`, top: 1 });
  return items.length > 0 ? items[0] : null;
}

// ============ Customers ============

/**
 * 获取客户列表
 */
export async function getCustomers(params?: {
  search?: string;
  top?: number;
}): Promise<BCCustomer[]> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  const queryParams: Record<string, string> = {};
  if (params?.top) {
    queryParams['$top'] = String(params.top);
  }

  const rawTop = params?.top ?? 20;
  const rawSearch = params?.search?.trim();

  if (!rawSearch) {
    const rows = await odataRequest<Record<string, unknown>[]>(config, 'workflowCustomers', {
      params: queryParams,
    });
    return rows.map(normalizeBCCustomer);
  }

  const term = escapeODataLiteral(rawSearch);
  const filterCandidates = [
    `(contains(searchName, '${term}') or contains(number, '${term}'))`,
    `(contains(Name, '${term}') or contains(No, '${term}'))`,
    `contains(E_Mail, '${term}')`,
  ];

  for (const filter of filterCandidates) {
    try {
      const rows = await odataRequest<Record<string, unknown>[]>(config, 'workflowCustomers', {
        params: {
          ...queryParams,
          '$filter': filter,
        },
      });
      const normalized = rows.map(normalizeBCCustomer);
      if (normalized.length > 0) {
        return rankCustomers(rawSearch, normalized).slice(0, rawTop);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('Could not find a property named')) {
        throw error;
      }
    }
  }

  const fallbackRows = await odataRequest<Record<string, unknown>[]>(config, 'workflowCustomers', {
    params: {
      '$top': String(Math.max(rawTop * 5, 50)),
    },
  });

  return rankCustomers(rawSearch, fallbackRows.map(normalizeBCCustomer)).slice(0, rawTop);
}

// ============ 统计辅助 ============

/**
 * 获取 Sales Line 统计汇总
 */
export async function getSalesLinesStats(): Promise<{
  totalLines: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  topCategories: Array<{ category: string; revenue: number; lines: number }>;
  recentOrders: Array<{ orderNo: string; customer: string; amount: number; date: string }>;
}> {
  const config = await getBCODataConfig();
  if (!config) throw new Error('Business Central not configured');

  // 拉取最近的销售行
  const lines = await getSalesLines({ top: 200 });
  const orders = await getSalesOrders({ top: 50 });

  const totalRevenue = lines.reduce((sum, l) => sum + l.Line_Amount, 0);
  const totalCost = lines.reduce((sum, l) => sum + (l.Unit_Cost_LCY * l.Quantity), 0);
  const grossProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // 按类目汇总
  const categoryMap = new Map<string, { revenue: number; lines: number }>();
  for (const line of lines) {
    const cat = line.Item_Category_Code || 'Uncategorized';
    const existing = categoryMap.get(cat) || { revenue: 0, lines: 0 };
    existing.revenue += line.Line_Amount;
    existing.lines += 1;
    categoryMap.set(cat, existing);
  }

  const topCategories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // 最近的订单
  const recentOrders = orders.slice(0, 10).map((o) => ({
    orderNo: o.No,
    customer: o.Sell_to_Customer_Name,
    amount: 0, // 需要从 lines 汇总
    date: o.Order_Date,
  }));

  // 填充订单金额
  const orderAmounts = new Map<string, number>();
  for (const line of lines) {
    const existing = orderAmounts.get(line.Document_No) || 0;
    orderAmounts.set(line.Document_No, existing + line.Line_Amount);
  }
  for (const ro of recentOrders) {
    ro.amount = orderAmounts.get(ro.orderNo) || 0;
  }

  return {
    totalLines: lines.length,
    totalRevenue,
    totalCost,
    grossProfit,
    grossMargin,
    topCategories,
    recentOrders,
  };
}
