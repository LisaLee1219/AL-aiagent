'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShoppingCart,
  Star,
  AlertTriangle,
  TrendingUp,
  Package,
  BarChart3,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  Truck,
} from 'lucide-react';
import { useState } from 'react';
import type { Supplier, InventoryAlert } from '@/lib/mock-data';
import { FloatingAgent } from '@/components/floating-agent';
import { mockSuppliers, mockInventoryAlerts, mockERPProducts } from '@/lib/mock-data';

export default function ProcurementPage() {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('suppliers');

  const handleSupplierCompare = async () => {
    if (selectedSuppliers.length < 2) return;
    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'procurement',
          context: `Supplier comparison data:\n${mockSuppliers
            .filter((s) => selectedSuppliers.includes(s.id))
            .map(
              (s) =>
                `- ${s.name}: Score${s.rating}, Lead Time${s.leadTime}, Price Index${s.priceIndex}, Quality Score${s.qualityScore}, Delivery Score${s.deliveryScore}`
            )
            .join('\n')}`,
          question: 'Please compare these suppliers and provide procurement recommendations, including recommended supplier and negotiation points.',
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
      setAiAnalysis('Supplier comparison analysis is temporarily unavailable. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const getStatusIcon = (status: InventoryAlert['status']) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusColor = (status: InventoryAlert['status']) => {
    switch (status) {
      case 'critical': return 'text-red-600';
      case 'warning': return 'text-amber-600';
      default: return 'text-green-600';
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Procurement Procurement Workspace</h1>
        <p className="text-muted-foreground mt-1">
          AI-powered supplier comparison, procurement recommendations, and inventory alert management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="suppliers">Supplier Comparison</TabsTrigger>
          <TabsTrigger value="inventory">Inventory Alerts</TabsTrigger>
          <TabsTrigger value="orders">Procurement</TabsTrigger>
        </TabsList>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    Supplier Comparison Analysis
                  </CardTitle>
                  <CardDescription>Select 2-3 suppliers to compare. AI will provide procurement recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockSuppliers.map((supplier) => {
                    const isSelected = selectedSuppliers.includes(supplier.id);
                    return (
                      <div
                        key={supplier.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'hover:border-emerald-300'
                        }`}
                        onClick={() => toggleSupplier(supplier.id)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{supplier.name}</span>
                            <Badge variant="outline">{supplier.category}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                            <span className="font-medium text-sm">{supplier.rating}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Price Index</div>
                            <Progress value={supplier.priceIndex} className="h-2" />
                            <div className="text-xs mt-1">{supplier.priceIndex}/100 (lower is better)</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Quality Score</div>
                            <Progress value={supplier.qualityScore} className="h-2" />
                            <div className="text-xs mt-1">{supplier.qualityScore}/100</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Delivery Score</div>
                            <Progress value={supplier.deliveryScore} className="h-2" />
                            <div className="text-xs mt-1">{supplier.deliveryScore}/100</div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Lead Time: {supplier.leadTime}</span>
                          <span>Min. Order: {supplier.minOrder}</span>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedSuppliers.length < 2 || isAnalyzing}
                    onClick={handleSupplierCompare}
                  >
                    {isAnalyzing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI Analyzing...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />AI Compare ({selectedSuppliers.length} selected)</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {aiAnalysis && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      AI ProcurementRecommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap bg-emerald-50/50 p-4 rounded-lg">
                      {aiAnalysis}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Supplier Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Suppliers</span>
                    <span className="font-bold text-lg">{mockSuppliers.length}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Score</span>
                    <span className="font-bold text-lg">
                      {(mockSuppliers.reduce((a, s) => a + s.rating, 0) / mockSuppliers.length).toFixed(1)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Inventory Alerts</span>
                    <span className="font-bold text-lg text-amber-600">
                      {mockInventoryAlerts.filter((i) => i.status !== 'normal').length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Pending Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    NetApp FAS8300 InventoryCritical shortage
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                    <Package className="w-3 h-3 text-blue-500" />
                    Huawei switch restock pending approval
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Dell servers received and stored
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-red-600">
                        {mockInventoryAlerts.filter((i) => i.status === 'critical').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Critical shortage</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-amber-600">
                        {mockInventoryAlerts.filter((i) => i.status === 'warning').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Inventory Alerts</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">
                        {mockInventoryAlerts.filter((i) => i.status === 'normal').length}
                      </div>
                      <div className="text-xs text-muted-foreground">InventoryNormal</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  Inventory Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockInventoryAlerts.map((alert) => (
                  <div key={alert.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(alert.status)}
                        <span className="font-medium text-sm">{alert.product}</span>
                        <Badge variant="outline" className="text-xs">{alert.sku}</Badge>
                      </div>
                      <span className={`text-sm font-medium ${getStatusColor(alert.status)}`}>
                        {alert.status === 'critical' ? 'Critical' : alert.status === 'warning' ? 'Warning' : 'Normal'}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Current Stock</span>
                        <div className="font-semibold">{alert.currentStock}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Safety Stock</span>
                        <div className="font-semibold">{alert.minStock}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Suggested Reorder</span>
                        <div className="font-semibold">{alert.suggestedOrder}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Est. Cost</span>
                        <div className="font-semibold text-red-600">S${alert.estimatedCost.toLocaleString()}</div>
                      </div>
                    </div>
                    {alert.status !== 'normal' && (
                      <Button size="sm" variant="outline" className="mt-3">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Generate Purchase Order
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                Purchase Order Management
              </CardTitle>
              <CardDescription>Track purchase order status and manage supplier deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { po: 'PO-2025-0001', supplier: 'Dell Direct', items: 'Dell R750 x5', amount: 'S$340,000', status: 'shipped', eta: '2025-01-18' },
                  { po: 'PO-2025-0002', supplier: 'H3C Distributor', items: 'H3C S6850 x10', amount: 'S$280,000', status: 'processing', eta: '2025-01-22' },
                  { po: 'PO-2025-0003', supplier: 'Mindray Direct', items: 'Blood Analyzer x8', amount: 'S$680,000', status: 'pending', eta: '2025-01-25' },
                  { po: 'PO-2024-0156', supplier: 'FANUC Robotics', items: 'FANUC R-2000iC x2', amount: 'S$760,000', status: 'shipped', eta: '2025-02-01' },
                ].map((order) => (
                  <div key={order.po} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{order.po}</span>
                        <Badge variant={order.status === 'shipped' ? 'default' : order.status === 'processing' ? 'secondary' : 'outline'} className="text-xs">
                          {order.status === 'shipped' ? 'Shipped' : order.status === 'processing' ? 'Processing' : 'Pending Confirmation'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {order.supplier} · {order.items}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{order.amount}</div>
                      <div className="text-xs text-muted-foreground">ETA: {order.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    
      <FloatingAgent agent="procurement" />
    </AppShell>
  );
}
