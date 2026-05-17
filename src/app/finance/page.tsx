'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  DollarSign,
  FileText,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  BarChart3,
  Receipt,
} from 'lucide-react';
import { useState } from 'react';
import type { Invoice, FinancialMetric } from '@/lib/mock-data';
import { FloatingAgent } from '@/components/floating-agent';
import { mockInvoices, mockFinancialMetrics } from '@/lib/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const totalReceivables = mockInvoices
    .filter((i) => i.type === 'receivable' && i.status !== 'paid')
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const totalPayables = mockInvoices
    .filter((i) => i.type === 'payable' && i.status !== 'paid')
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const overdueAmount = mockInvoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const handleAnomalyAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'finance',
          context: `Financial Data Overview:\nTotal Receivables: S$${totalReceivables.toLocaleString()}\nTotal Payables: S$${totalPayables.toLocaleString()}\nOverdue Amount: S$${overdueAmount.toLocaleString()}\n\nOverdue Invoices:\n${mockInvoices
            .filter((i) => i.status === 'overdue')
            .map((i) => `- ${i.invoiceNo}: ${i.customer} S$${i.totalAmount.toLocaleString()} (Due Date: ${i.dueDate})`)
            .join('\n')}\n\nMonthly Trend:\n${mockFinancialMetrics
            .map((m) => `${m.month}: RevenueS$${m.revenue.toLocaleString()} CostS$${m.cost.toLocaleString()} ProfitS$${m.profit.toLocaleString()}`)
            .join('\n')}`,
          question: 'Please analyse the current financial situation, identify risk areas, and provide receivables & payables management recommendations.',
        }),
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
                if (parsed.content) setAiAnalysis((prev) => prev + parsed.content);
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      setAiAnalysis('Financial analysis is temporarily unavailable.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getInvoiceStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>;
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending Payment</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>;
      case 'processing': return <Badge className="bg-blue-100 text-blue-700 text-xs">Processing</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Finance Finance Workspace</h1>
        <p className="text-muted-foreground mt-1">
          AI invoice processing, receivables & payables management, and automated financial reporting
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="text-xl font-bold">S$338K</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  Monthly Revenue
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold">S${(totalReceivables / 10000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">Accounts Receivable</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <div className="text-xl font-bold">S${(totalPayables / 10000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">Accounts Payable</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">S${(overdueAmount / 10000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">Overdue Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Financial Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoice Management</TabsTrigger>
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  Monthly Revenue & Profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockFinancialMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v / 10000}K`} />
                    <Tooltip formatter={(value: number) => `S$${(value / 10000).toFixed(0)}K`} />
                    <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                    <Bar dataKey="profit" fill="#22c55e" name="Profit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Receivables & Payables Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockFinancialMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v / 10000}K`} />
                    <Tooltip formatter={(value: number) => `S$${(value / 10000).toFixed(0)}K`} />
                    <Legend />
                    <Line type="monotone" dataKey="receivables" stroke="#3b82f6" name="Receivable" strokeWidth={2} />
                    <Line type="monotone" dataKey="payables" stroke="#f97316" name="Payable" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-600" />
                Invoice Management
              </CardTitle>
              <CardDescription>Manage receivable & payable invoices with AI-powered exception detection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockInvoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{invoice.invoiceNo}</span>
                      {getInvoiceStatusBadge(invoice.status)}
                      <Badge variant="outline" className="text-xs">
                        {invoice.type === 'receivable' ? 'Receivable' : 'Payable'}
                      </Badge>
                    </div>
                    <span className="font-semibold text-sm">
                      S${invoice.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                    <div>
                      <span>{invoice.customer}</span>
                    </div>
                    <div>
                      <span>Issued: {invoice.issueDate}</span>
                    </div>
                    <div>
                      <span className={invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                        Due: {invoice.dueDate}
                      </span>
                    </div>
                  </div>
                  {invoice.status === 'overdue' && (
                    <div className="mt-2 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <span className="text-xs text-red-600">Overdue - please follow up urgently</span>
                      <Button size="sm" variant="outline" className="h-6 text-xs ml-auto">
                        Send Reminder
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Financial Analysis
              </CardTitle>
              <CardDescription>AI automatically analyses financial data, identifies exceptions and risks</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full mb-4"
                size="lg"
                disabled={isAnalyzing}
                onClick={handleAnomalyAnalysis}
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analysing...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />AI Financial Diagnosis</>
                )}
              </Button>

              {aiAnalysis && (
                <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">AI Financial Diagnosis Report</span>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {aiAnalysis}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    
      <FloatingAgent agent="finance" />
    </AppShell>
  );
}
