'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Sparkles,
  Search,
  FileText,
  Package,
  History,
  Calculator,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  TrendingUp,
  BarChart3,
  RefreshCw,
  ExternalLink,
  DollarSign,
  ShoppingCart,
  Box,
  Globe,
  ThumbsUp,
  HelpCircle,
  XCircle,
  X,
  Plus,
  Edit3,
  Trash2,
  Percent,
  Copy,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { CustomerEmail, ExtractedInfo, ERPProduct, HistoricalOrder } from '@/lib/mock-data';
import { FloatingAgent } from '@/components/floating-agent';
import { SalesQuoteWorkflow } from '@/components/sales-quote-copilot/SalesQuoteWorkflow';
import { mockEmails } from '@/lib/mock-data';
import type { BCSalesLine, BCSalesOrder, BCItem } from '@/lib/business-central';
import { readApiErrorMessage } from '@/lib/api-error';

/** Scored product from AI ranking */
interface ScoredProduct extends ERPProduct {
  relevanceScore: number;
  relevanceReason: string;
}

/** Manually entered product when no ERP match */
interface ManualProduct {
  id: string;
  keyword: string;
  name: string;
  supplier: string;
  costPrice: number;
  listPrice: number;
  quantity: number;
  margin: number;
  marginPercent: number;
}

/** Per-keyword search result with status feedback */
interface ProductSearchResult {
  searchKeyword: string;
  status: 'matched' | 'partial_match' | 'not_found';
  statusMessage: string;
  products: ScoredProduct[];
  historicalOrders: HistoricalOrder[];
  webSearchAvailable: boolean;
}

/** Web search result */
interface WebSearchData {
  productName: string;
  searchResults: Array<{
    title: string;
    url: string;
    snippet: string;
    source: string;
    isSupplierResult: boolean;
    matchScore?: number;
    matchReason?: string;
    region?: 'singapore' | 'sea' | 'global';
  }>;
  supplierSummary: string;
  specSummary: string;
  aiAnalysis: string;
  totalResults: number;
  regionFocus?: 'singapore';
}

type Step = 'email' | 'extract' | 'search' | 'history' | 'quote';
type ViewMode = 'workflow' | 'bc-data';

const steps: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'email', label: 'Select Email', icon: Mail },
  { key: 'extract', label: 'AI Extract', icon: Sparkles },
  { key: 'search', label: 'ERP Match', icon: Search },
  { key: 'history', label: 'Past Orders', icon: History },
  { key: 'quote', label: 'Quick Quote', icon: Calculator },
];

export default function SalesPage() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('workflow');

  // Workflow state
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [selectedEmail, setSelectedEmail] = useState<CustomerEmail | null>(null);
  const [extractedInfo, setExtractedInfo] = useState<ExtractedInfo | null>(null);
  const [matchedProducts, setMatchedProducts] = useState<ScoredProduct[]>([]);
  const [matchedOrders, setMatchedOrders] = useState<HistoricalOrder[]>([]);
  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
  const [webSearchData, setWebSearchData] = useState<Map<string, WebSearchData>>(new Map());
  const [webSearchLoading, setWebSearchLoading] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiParseNotice, setAiParseNotice] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: ScoredProduct; quantity: number }>>(new Map());
  const [manualProducts, setManualProducts] = useState<Map<string, ManualProduct>>(new Map());
  const [manualFormVisible, setManualFormVisible] = useState<string | null>(null); // keyword being edited
  const [manualForm, setManualForm] = useState({ name: '', supplier: '', costPrice: '', listPrice: '', quantity: '1' });
  const [quoteEdits, setQuoteEdits] = useState<Map<string, { listPrice: number; quantity: number; discount: number }>>(new Map());
  const [quoteConfirmed, setQuoteConfirmed] = useState(false);
  const [emailReply, setEmailReply] = useState('');
  const [emailReplyLoading, setEmailReplyLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'business_central' | 'mock'>('mock');
  const abortControllerRef = useRef<AbortController | null>(null);

  // BC Data state
  const [bcSalesLines, setBcSalesLines] = useState<BCSalesLine[]>([]);
  const [bcSalesOrders, setBcSalesOrders] = useState<Array<BCSalesOrder & { lines?: BCSalesLine[] }>>([]);
  const [bcItems, setBcItems] = useState<BCItem[]>([]);
  const [bcConnected, setBcConnected] = useState(false);
  const [bcCompanyName, setBcCompanyName] = useState('');
  const [bcStats, setBcStats] = useState<{
    totalLines: number;
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    grossMargin: number;
    topCategories: Array<{ category: string; revenue: number; lines: number }>;
  } | null>(null);
  const [emails, setEmails] = useState<typeof mockEmails>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailSource, setEmailSource] = useState<'graph_api' | 'mock'>('mock');
  const [bcLoading, setBcLoading] = useState(false);
  const [bcSearchQuery, setBcSearchQuery] = useState('');
  const [bcOrderSearch, setBcOrderSearch] = useState('');

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);

  // Fetch BC data and emails on mount
  useEffect(() => {
    fetchBcStats();
    fetchBcSalesLines();
    fetchBcSalesOrders();
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setEmailsLoading(true);
    try {
      const res = await fetch('/api/emails/list?top=30&folder=all');
      if (res.ok) {
        const data = await res.json();
        const incoming = data.emails || data.data;
        const source = data.source === 'graph_api' || data.source === 'microsoft_graph' ? 'graph_api' : 'mock';
        if (data.success && incoming && incoming.length > 0) {
          setEmailSource(source);
          setEmails(incoming);
        } else {
          setEmails(mockEmails);
          setEmailSource('mock');
        }
      } else {
        setEmails(mockEmails);
        setEmailSource('mock');
      }
    } catch {
      setEmails(mockEmails);
      setEmailSource('mock');
    } finally {
      setEmailsLoading(false);
    }
  };

  // Auto-refresh emails every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchEmails, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchBcStats = async () => {
    try {
      const res = await fetch('/api/bc/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setBcConnected(data.data.configured);
          if (data.data.company) {
            setBcCompanyName(data.data.company.displayName || data.data.company.name);
          }
          if (data.data.stats) {
            setBcStats(data.data.stats);
          }
        }
      }
    } catch {
      // silently fail
    }
  };

  // Fetch BC stats on mount
  useEffect(() => {
    fetchBcStats();
  }, []);

  const fetchBcSalesLines = async (search?: string) => {
    setBcLoading(true);
    try {
      const params = new URLSearchParams({ top: '100' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/bc/sales-lines?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBcSalesLines(data.data);
          if (data.source === 'business_central') setDataSource('business_central');
        }
      }
    } catch {
      // silently fail
    } finally {
      setBcLoading(false);
    }
  };

  const fetchBcSalesOrders = async (search?: string) => {
    try {
      const params = new URLSearchParams({ top: '30', withLines: 'true' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/bc/sales-orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBcSalesOrders(data.data);
          if (data.source === 'business_central') setDataSource('business_central');
        }
      }
    } catch {
      // silently fail
    }
  };

  const fetchBcItems = async (search?: string) => {
    try {
      const params = new URLSearchParams({ top: '50' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/bc/items?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBcItems(data.data);
          if (data.source === 'business_central') setDataSource('business_central');
        }
      }
    } catch {
      // silently fail
    }
  };

  // Step 1: Parse email with AI
  const handleParseEmail = useCallback(async (email: CustomerEmail) => {
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

      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, '邮件解析失败'));
      }
      const result = await res.json();

      if (result.success && result.data) {
        const info: ExtractedInfo = {
          customerName: result.data.customerName || email.fromName,
          companyName: result.data.companyName || '',
          products: result.data.products || [],
          quantity: result.data.quantity || '',
          urgency: result.data.urgency || 'medium',
          keyRequirements: result.data.keyRequirements || [],
        };
        setExtractedInfo(info);

        if (result.data.bcCustomer) {
          console.log('BC customer matched:', result.data.bcCustomer);
        }
        if (result.source === 'business_central') {
          setDataSource('business_central');
        }

        // Auto-search products with AI ranking
        if (info.products.length > 0) {
          // Try BC items first
          if (bcConnected) {
            for (const productName of info.products) {
              await fetchBcItems(productName);
            }
          }

          // Search ERP with AI ranking
          const searchRes = await fetch('/api/erp/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productNames: info.products, customerName: info.companyName }),
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.success && searchData.data) {
              const searchResults: ProductSearchResult[] = searchData.data;
              setProductSearchResults(searchResults);

              // Flatten for backward compatibility
              const allProducts: ScoredProduct[] = [];
              const allOrders: HistoricalOrder[] = [];
              searchResults.forEach((item: ProductSearchResult) => {
                allProducts.push(...item.products);
                allOrders.push(...item.historicalOrders);
              });
              setMatchedProducts(allProducts);
              setMatchedOrders(allOrders);
              if (searchData.source === 'business_central') {
                setDataSource('business_central');
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Parse email error:', error);
      const message =
        error instanceof Error ? error.message : '邮件解析失败，已使用本地示例数据';
      setAiParseNotice(message);
      setExtractedInfo({
        customerName: email.fromName,
        companyName: email.from.includes('clienta') || email.from.includes('construction') ? 'Client A Construction Pte Ltd' : email.fromName,
        products: email.subject.toLowerCase().includes('fastener') || email.subject.toLowerCase().includes('wheel') ?
          ['Flat Wheel 4"', 'Machine Screw M14x30', 'Bolt M16x100 Gr8.8', 'Nut M16 Gr8.8', 'Flat Washer M16', 'Spring Washer M16', 'Bolt M22x80 Gr8.8', 'Nut M22 Gr8.8', 'Flat Washer M22', 'Spring Washer M22'] :
          email.subject.toLowerCase().includes('valve') || email.subject.toLowerCase().includes('pressure') ?
          ['Butterfly Valve 2" CI Wafer', 'Pressure Switch 0-5 Bar'] :
          ['General Industrial Supplies'],
        quantity: email.subject.toLowerCase().includes('fastener') ? 'Various - see email' : '1 PC each',
        urgency: email.body.toLowerCase().includes('urgent') ? 'high' : 'medium',
        keyRequirements: ['See email for specific requirements'],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [bcConnected]);

  // Web Search for products not found in ERP
  const handleWebSearch = useCallback(async (productName: string) => {
    setWebSearchLoading(productName);
    try {
      const res = await fetch('/api/erp/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          context: extractedInfo ? `Customer: ${extractedInfo.companyName}, Urgency: ${extractedInfo.urgency}` : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setWebSearchData((prev) => {
            const next = new Map(prev);
            next.set(productName, data.data);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Web search error:', error);
    } finally {
      setWebSearchLoading(null);
    }
  }, [extractedInfo]);

  // AI Quote Analysis (streaming)
  // Add manual product entry
  const handleAddManualProduct = useCallback((keyword: string) => {
    const cost = parseFloat(manualForm.costPrice) || 0;
    const list = parseFloat(manualForm.listPrice) || 0;
    const qty = parseInt(manualForm.quantity) || 1;
    const margin = list - cost;
    const marginPercent = list > 0 ? ((margin / list) * 100) : 0;

    const manual: ManualProduct = {
      id: `manual-${keyword}-${Date.now()}`,
      keyword,
      name: manualForm.name || keyword,
      supplier: manualForm.supplier,
      costPrice: cost,
      listPrice: list,
      quantity: qty,
      margin,
      marginPercent,
    };

    setManualProducts(prev => new Map(prev).set(keyword, manual));
    setManualFormVisible(null);
    setManualForm({ name: '', supplier: '', costPrice: '', listPrice: '', quantity: '1' });
  }, [manualForm]);

  // Remove manual product
  const handleRemoveManualProduct = useCallback((keyword: string) => {
    setManualProducts(prev => {
      const next = new Map(prev);
      next.delete(keyword);
      return next;
    });
  }, []);

  // Start editing manual product form
  const openManualForm = useCallback((keyword: string) => {
    const existing = manualProducts.get(keyword);
    if (existing) {
      setManualForm({
        name: existing.name,
        supplier: existing.supplier,
        costPrice: String(existing.costPrice),
        listPrice: String(existing.listPrice),
        quantity: String(existing.quantity),
      });
    } else {
      setManualForm({ name: keyword, supplier: '', costPrice: '', listPrice: '', quantity: '1' });
    }
    setManualFormVisible(keyword);
  }, [manualProducts]);

  // Get effective quote value (edited or original) for a product
  const getQuoteValue = useCallback((productId: string, field: 'listPrice' | 'quantity' | 'discount', original: number) => {
    const edit = quoteEdits.get(productId);
    if (!edit) return field === 'discount' ? 0 : original;
    return edit[field] ?? (field === 'discount' ? 0 : original);
  }, [quoteEdits]);

  // Update a single quote edit field
  const updateQuoteEdit = useCallback((productId: string, field: 'listPrice' | 'quantity' | 'discount', value: number) => {
    setQuoteEdits(prev => {
      const next = new Map(prev);
      const existing = next.get(productId) || { listPrice: 0, quantity: 1, discount: 0 };
      next.set(productId, { ...existing, [field]: value });
      return next;
    });
  }, []);

  // Build the confirmed quote data for all selected products
  const buildConfirmedQuote = useCallback(() => {
    const lines: Array<{
      name: string; sku: string; source: string; supplier?: string;
      costPrice: number; listPrice: number; quantity: number; discount: number;
      finalPrice: number; margin: number; marginPercent: number; totalCost: number; totalList: number;
    }> = [];

    Array.from(selectedProducts.entries()).forEach(([id, { product, quantity }]) => {
      const edit = quoteEdits.get(id);
      const q = edit?.quantity ?? quantity;
      const lp = edit?.listPrice ?? product.listPrice;
      const disc = edit?.discount ?? 0;
      const finalPrice = lp * (1 - disc / 100);
      const margin = finalPrice - product.costPrice;
      lines.push({
        name: product.name, sku: product.sku, source: product.source || 'erp',
        costPrice: product.costPrice, listPrice: lp, quantity: q, discount: disc,
        finalPrice, margin, marginPercent: lp > 0 ? (margin / finalPrice) * 100 : 0,
        totalCost: q * product.costPrice, totalList: q * finalPrice,
      });
    });

    Array.from(manualProducts.entries()).forEach(([id, mp]) => {
      const edit = quoteEdits.get(id);
      const q = edit?.quantity ?? mp.quantity;
      const lp = edit?.listPrice ?? mp.listPrice;
      const disc = edit?.discount ?? 0;
      const finalPrice = lp * (1 - disc / 100);
      const margin = finalPrice - mp.costPrice;
      lines.push({
        name: mp.name, sku: 'MANUAL', source: 'manual', supplier: mp.supplier,
        costPrice: mp.costPrice, listPrice: lp, quantity: q, discount: disc,
        finalPrice, margin, marginPercent: lp > 0 ? (margin / finalPrice) * 100 : 0,
        totalCost: q * mp.costPrice, totalList: q * finalPrice,
      });
    });

    return lines;
  }, [selectedProducts, manualProducts, quoteEdits]);

  // Generate email reply using AI
  const handleGenerateEmailReply = useCallback(async () => {
    if (!selectedEmail || !extractedInfo) return;
    setEmailReplyLoading(true);
    setEmailReply('');
    try {
      const quoteLines = buildConfirmedQuote();
      const res = await fetch('/api/ai/generate-email-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalEmail: { from: selectedEmail.fromName, subject: selectedEmail.subject, body: selectedEmail.body },
          customerInfo: { name: extractedInfo.customerName, company: extractedInfo.companyName },
          quoteLines,
          totals: {
            totalCost: quoteLines.reduce((s, l) => s + l.totalCost, 0),
            totalList: quoteLines.reduce((s, l) => s + l.totalList, 0),
            totalMargin: quoteLines.reduce((s, l) => s + l.quantity * l.margin, 0),
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to generate reply');
      const data = await res.json();
      setEmailReply(data.reply || data.error || 'Failed to generate');
      setQuoteConfirmed(true);
    } catch (err) {
      setEmailReply(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setEmailReplyLoading(false);
    }
  }, [selectedEmail, extractedInfo, buildConfirmedQuote]);

  const handleAiQuote = useCallback(async () => {
    setIsAiStreaming(true);
    setAiAnalysis('');
    setCurrentStep('quote');

    const context = selectedEmail ? `Customer email: ${selectedEmail.body}\n\n` : '';
    const productsContext = matchedProducts.length > 0
      ? `Matched products:\n${matchedProducts.map(p => `- ${p.name}: Cost SGD${p.costPrice}, List SGD${p.listPrice}, Stock ${p.stock}`).join('\n')}\n\n`
      : '';
    const ordersContext = matchedOrders.length > 0
      ? `Historical orders:\n${matchedOrders.map(o => `- ${o.orderId}: ${o.customer} ${o.product} x${o.quantity} @SGD${o.unitPrice} (${o.date})`).join('\n')}\n\n`
      : '';
    const bcContext = bcSalesLines.length > 0
      ? `\n\nBC Sales Lines (recent transaction reference):\n${bcSalesLines.slice(0, 10).map(l => `- ${l.Document_No}: ${l.Description} x${l.Quantity} @SGD${l.Unit_Price} Cost SGD${l.Unit_Cost_LCY}`).join('\n')}`
      : '';
    const selectedContext = selectedProducts.size > 0
      ? `Selected products:\n${Array.from(selectedProducts.values()).map(s => `- ${s.product.name} x${s.quantity} Cost SGD${s.product.costPrice}`).join('\n')}\n\n`
      : '';
    const manualContext = manualProducts.size > 0
      ? `Manually entered products:\n${Array.from(manualProducts.values()).map(m => `- ${m.name} (Supplier: ${m.supplier}) Cost SGD${m.costPrice}, List SGD${m.listPrice}, Margin ${m.marginPercent.toFixed(1)}%`).join('\n')}\n\n`
      : '';
    const webSearchContext = webSearchData.size > 0
      ? `\n\nWeb Search Research:\n${Array.from(webSearchData.entries()).map(([name, data]) => `--- ${name} ---\n${data.aiAnalysis}`).join('\n\n')}`
      : '';

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sales',
          context: context + productsContext + ordersContext + bcContext + selectedContext + manualContext + webSearchContext,
          question: extractedInfo
            ? `${extractedInfo.customerName} from ${extractedInfo.companyName} is requesting a quote. Based on cost price, historical transaction prices, and market conditions, provide specific pricing recommendations and negotiation strategies. Currency is SGD.`
            : 'Please provide pricing recommendations. Currency is SGD.',
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error('Analysis failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  setAiAnalysis((prev) => prev + parsed.content);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAiAnalysis('Analysis generation failed. Please retry. Based on current data, we recommend a 30%-50% markup on cost price, using historical transaction prices as a negotiation baseline.');
      }
    } finally {
      setIsAiStreaming(false);
    }
  }, [selectedEmail, matchedProducts, matchedOrders, bcSalesLines, selectedProducts, extractedInfo]);

  const toggleProductSelection = (product: ScoredProduct) => {
    const newMap = new Map(selectedProducts);
    if (newMap.has(product.id)) {
      newMap.delete(product.id);
    } else {
      newMap.set(product.id, { product, quantity: product.minOrderQty });
    }
    setSelectedProducts(newMap);
  };

  const updateQuantity = (productId: string, qty: number) => {
    const newMap = new Map(selectedProducts);
    const entry = newMap.get(productId);
    if (entry) {
      newMap.set(productId, { ...entry, quantity: qty });
    }
    setSelectedProducts(newMap);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'Urgent';
      case 'medium': return 'Normal';
      default: return 'Low';
    }
  };

  const formatCurrency = (amount: number, currency = 'SGD') => {
    return `${currency} ${amount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Quote Copilot</h1>
          <p className="text-muted-foreground mt-1">
            {bcConnected
              ? `RFQ → quote-ready workflow · Business Central (${bcCompanyName})`
              : 'RFQ → quote-ready workflow · Extract, readiness check, internal match, supplier sourcing, and approved quoting'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={bcConnected ? 'default' : 'secondary'} className="shrink-0">
            {bcConnected ? (
              <><CheckCircle2 className="mr-1 h-3 w-3" /> BC Connected</>
            ) : (
              <><AlertCircle className="mr-1 h-3 w-3" /> Demo Data</>
            )}
          </Badge>
          {emailSource === 'graph_api' && (
            <Badge variant="default" className="shrink-0 bg-green-600">
              <><CheckCircle2 className="mr-1 h-3 w-3" /> Live Email</>
            </Badge>
          )}
          {emailSource === 'mock' && (
            <Badge variant="secondary" className="shrink-0">
              <><AlertCircle className="mr-1 h-3 w-3" /> Demo Emails</>
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchBcStats();
              fetchBcSalesLines();
              fetchBcSalesOrders();
              fetchEmails();
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="bc-data" className="gap-1">
            <Database className="w-3.5 h-3.5" />
            BC Sales Data
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-1">
            <Zap className="w-3.5 h-3.5" />
            Sales Quote Copilot
          </TabsTrigger>
        </TabsList>

        {/* ============ BC Sales Data View ============ */}
        <TabsContent value="bc-data" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Sales Lines</div>
                    <div className="text-xl font-bold">{bcStats?.totalLines ?? bcSalesLines.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Revenue</div>
                    <div className="text-xl font-bold">
                      {bcStats ? formatCurrency(bcStats.totalRevenue) : formatCurrency(bcSalesLines.reduce((s, l) => s + l.Line_Amount, 0))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gross Profit</div>
                    <div className="text-xl font-bold">
                      {bcStats ? formatCurrency(bcStats.grossProfit) : '-'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Gross Margin</div>
                    <div className="text-xl font-bold">
                      {bcStats ? `${bcStats.grossMargin.toFixed(1)}%` : '-'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown */}
          {bcStats && bcStats.topCategories.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Sales by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bcStats.topCategories.map((cat) => {
                    const maxRevenue = bcStats.topCategories[0]?.revenue || 1;
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <div className="w-28 text-xs font-medium truncate">{cat.category}</div>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all"
                            style={{ width: `${(cat.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <div className="w-24 text-xs text-right font-medium">{formatCurrency(cat.revenue)}</div>
                        <div className="w-12 text-xs text-muted-foreground text-right">{cat.lines} lines</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales Lines Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Sales Lines
                  <Badge variant="outline" className="text-xs ml-2">
                    {bcSalesLines.length} records
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search by item no. / description..."
                    value={bcSearchQuery}
                    onChange={(e) => setBcSearchQuery(e.target.value)}
                    className="w-48 h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchBcSalesLines(bcSearchQuery);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchBcSalesLines(bcSearchQuery)}
                  >
                    <Search className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {bcLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-muted-foreground">Fetching data from Business Central...</span>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Order No.</th>
                        <th className="text-left p-2 font-medium">Item No.</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-right p-2 font-medium">Qty</th>
                        <th className="text-left p-2 font-medium">UOM</th>
                        <th className="text-right p-2 font-medium">Unit Cost</th>
                        <th className="text-right p-2 font-medium">Unit Price</th>
                        <th className="text-right p-2 font-medium">Line Amt</th>
                        <th className="text-left p-2 font-medium">Category</th>
                        <th className="text-left p-2 font-medium">Location</th>
                        <th className="text-left p-2 font-medium">Shipment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bcSalesLines.map((line, idx) => (
                        <tr key={`${line.Document_No}-${line.Line_No}-${idx}`} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium text-blue-600">{line.Document_No}</td>
                          <td className="p-2 font-mono">{line.No}</td>
                          <td className="p-2 max-w-[200px] truncate" title={line.Description}>{line.Description}</td>
                          <td className="p-2 text-right">{line.Quantity}</td>
                          <td className="p-2">{line.Unit_of_Measure_Code}</td>
                          <td className="p-2 text-right text-red-600">{line.Unit_Cost_LCY.toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">{line.Unit_Price.toFixed(2)}</td>
                          <td className="p-2 text-right font-semibold">{line.Line_Amount.toFixed(2)}</td>
                          <td className="p-2">
                            {line.Item_Category_Code && (
                              <Badge variant="secondary" className="text-[10px]">{line.Item_Category_Code}</Badge>
                            )}
                          </td>
                          <td className="p-2">{line.Location_Code}</td>
                          <td className="p-2 text-muted-foreground">{line.Shipment_Date?.split('T')[0]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Sales Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Sales Orders
                  <Badge variant="outline" className="text-xs ml-2">
                    {bcSalesOrders.length} orders
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search by customer / order no...."
                    value={bcOrderSearch}
                    onChange={(e) => setBcOrderSearch(e.target.value)}
                    className="w-48 h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchBcSalesOrders(bcOrderSearch);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchBcSalesOrders(bcOrderSearch)}
                  >
                    <Search className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {bcSalesOrders.map((order) => {
                    const totalAmount = order.lines
                      ? order.lines.reduce((sum, l) => sum + l.Line_Amount, 0)
                      : 0;
                    return (
                      <div key={order.No} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-blue-600">{order.No}</span>
                            <Badge
                              variant={order.Status === 'Released' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {order.Status}
                            </Badge>
                            {order.Currency_Code && (
                              <Badge variant="outline" className="text-xs">{order.Currency_Code}</Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">{formatCurrency(totalAmount)}</div>
                            <div className="text-xs text-muted-foreground">{order.Order_Date?.split('T')[0]}</div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {order.Sell_to_Customer_Name} ({order.Sell_to_Customer_No})
                          {order.Salesperson_Code && ` · Sales: ${order.Salesperson_Code}`}
                          {order.Payment_Terms_Code && ` · ${order.Payment_Terms_Code}`}
                        </div>
                        {order.lines && order.lines.length > 0 && (
                          <div className="bg-muted/50 rounded p-2 space-y-1">
                            {order.lines.slice(0, 5).map((line) => (
                              <div key={line.Line_No} className="flex items-center justify-between text-xs">
                                <span className="flex-1 truncate mr-2">
                                  <span className="font-mono text-muted-foreground">{line.No}</span> {line.Description}
                                </span>
                                <span className="whitespace-nowrap">
                                  x{line.Quantity} @ {formatCurrency(line.Unit_Price)}
                                </span>
                              </div>
                            ))}
                            {order.lines.length > 5 && (
                              <div className="text-xs text-muted-foreground text-center">
                                ...{order.lines.length - 5} more lines
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Items / Products from BC */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  ERP Product Catalogue (Items)
                  <Badge variant="outline" className="text-xs ml-2">
                    {bcItems.length} items
                  </Badge>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchBcItems()}
                >
                  <Search className="w-3 h-3 mr-1" />
                  Load Products
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bcItems.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">No.</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-left p-2 font-medium">UOM</th>
                        <th className="text-right p-2 font-medium">Cost</th>
                        <th className="text-right p-2 font-medium">Price</th>
                        <th className="text-right p-2 font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bcItems.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-mono text-blue-600">{item.number}</td>
                          <td className="p-2 max-w-[200px] truncate" title={item.description}>{item.description}</td>
                          <td className="p-2">{item.type}</td>
                          <td className="p-2">{item.baseUnitOfMeasure}</td>
                          <td className="p-2 text-right text-red-600">{item.unitCost.toFixed(2)}</td>
                          <td className="p-2 text-right font-medium">{item.unitPrice.toFixed(2)}</td>
                          <td className="p-2 text-right">
                            <span className={item.profitPercent > 30 ? 'text-green-600' : 'text-amber-600'}>
                              {item.profitPercent.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {`Click "Load Products" to fetch items from Business Central`}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Sales Quote Copilot Workflow ============ */}
        <TabsContent value="workflow" className="space-y-4">
          <SalesQuoteWorkflow />
        </TabsContent>
      </Tabs>
    
      <FloatingAgent agent="sales" />
    </AppShell>
  );
}
