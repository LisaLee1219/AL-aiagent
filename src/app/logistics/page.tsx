'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  Package,
  Warehouse,
  Sparkles,
  Loader2,
  CheckCircle2,
  Navigation,
  Box,
} from 'lucide-react';
import { useState } from 'react';
import type { Shipment, WarehouseItem } from '@/lib/mock-data';
import { FloatingAgent } from '@/components/floating-agent';
import { mockShipments, mockWarehouse } from '@/lib/mock-data';

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState('shipments');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  const getStatusColor = (status: Shipment['status']) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'in_transit': return 'bg-blue-100 text-blue-700';
      case 'customs': return 'bg-amber-100 text-amber-700';
      case 'delayed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: Shipment['status']) => {
    switch (status) {
      case 'preparing': return 'Preparing';
      case 'in_transit': return 'In Transit';
      case 'customs': return 'Customs Clearance';
      case 'delivered': return 'Delivered';
      case 'delayed': return 'Delayed';
    }
  };

  const handleAnomalyAnalysis = async (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'logistics',
          context: `Logistics exception details:\nTracking No: ${shipment.trackingNo}\nCustomer: ${shipment.customer}\nDestination: ${shipment.destination}\nStatus: ${getStatusLabel(shipment.status)}\nCurrent Location: ${shipment.currentLocation}\nItems: ${shipment.items}\nCarrier: ${shipment.carrier}\nETA: ${shipment.estimatedDelivery}`,
          question: 'Please analyse this logistics exception and provide handling recommendations and preventive measures.',
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
      setAiAnalysis('Logistics analysis is temporarily unavailable. Recommend contacting the carrier for latest status and notifying the customer of potential delays.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Logistics Logistics Workspace</h1>
        <p className="text-muted-foreground mt-1">
          Real-time shipment tracking, delivery optimisation, and warehouse visualisation
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Truck className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold">{mockShipments.filter(s => s.status === 'in_transit').length}</div>
                <div className="text-xs text-muted-foreground">In Transit</div>
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
                <div className="text-xl font-bold text-red-600">{mockShipments.filter(s => s.status === 'delayed').length}</div>
                <div className="text-xs text-muted-foreground">Delayed</div>
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
                <div className="text-xl font-bold">{mockShipments.filter(s => s.status === 'delivered').length}</div>
                <div className="text-xs text-muted-foreground">Delivered</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-xl font-bold">{mockShipments.filter(s => s.status === 'customs').length}</div>
                <div className="text-xs text-muted-foreground">Customs Clearance</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="shipments">Shipment Tracking</TabsTrigger>
          <TabsTrigger value="warehouse">Warehouse Management</TabsTrigger>
          <TabsTrigger value="optimization">Delivery Optimisation</TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-orange-600" />
                    Real-time Shipment Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockShipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-sm ${
                        selectedShipment?.id === shipment.id ? 'border-orange-500 bg-orange-50/50' : ''
                      }`}
                      onClick={() => setSelectedShipment(shipment)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{shipment.trackingNo}</span>
                          <Badge className={`text-xs ${getStatusColor(shipment.status)}`}>
                            {getStatusLabel(shipment.status)}
                          </Badge>
                          {shipment.status === 'delayed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnomalyAnalysis(shipment);
                              }}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Handle
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{shipment.carrier}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Customer: </span>
                          <span>{shipment.customer}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Destination: </span>
                          <span>{shipment.destination}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Current Location: </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {shipment.currentLocation}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Delivery: </span>
                          <span>{shipment.estimatedDelivery}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {shipment.items} · {shipment.weight}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <Progress
                          value={
                            shipment.status === 'delivered' ? 100 :
                            shipment.status === 'in_transit' ? 60 :
                            shipment.status === 'customs' ? 40 :
                            shipment.status === 'delayed' ? 30 : 10
                          }
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Side Panel */}
            <div className="space-y-4">
              {selectedShipment && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Shipment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    <div><span className="text-muted-foreground">Tracking No:</span> {selectedShipment.trackingNo}</div>
                    <div><span className="text-muted-foreground">Customer:</span> {selectedShipment.customer}</div>
                    <div><span className="text-muted-foreground">Items:</span> {selectedShipment.items}</div>
                    <div><span className="text-muted-foreground">Weight:</span> {selectedShipment.weight}</div>
                    <div><span className="text-muted-foreground">Carrier:</span> {selectedShipment.carrier}</div>
                  </CardContent>
                </Card>
              )}

              {aiAnalysis && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-orange-600" />
                      AI Exception HandlingRecommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap bg-orange-50/50 p-3 rounded-lg">
                      {aiAnalysis}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="warehouse" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-orange-600" />
                Warehouse Visualisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockWarehouse.map((item) => {
                  const utilization = Math.round((item.quantity / item.capacity) * 100);
                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{item.zone}</span>
                        </div>
                        <Badge variant={utilization > 80 ? 'destructive' : utilization > 50 ? 'secondary' : 'outline'} className="text-xs">
                          {utilization}% Utilisation
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {item.product} ({item.sku})
                      </div>
                      <Progress value={utilization} className="h-2 mb-1" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.quantity} / {item.capacity}</span>
                        <span>Updated: {item.lastUpdated}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-600" />
                AI Delivery Route Optimisation
              </CardTitle>
              <CardDescription>AI-optimised delivery plans based on order destination, weight, and urgency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockShipments.filter(s => s.status === 'in_transit' || s.status === 'preparing').map((shipment) => (
                  <div key={shipment.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{shipment.trackingNo}</span>
                      <Badge variant="outline" className="text-xs">{shipment.carrier}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">
                      {shipment.customer} → {shipment.destination} · {shipment.items}
                    </div>
                    <Button size="sm" variant="outline">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Optimise Route
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    
      <FloatingAgent agent="logistics" />
    </AppShell>
  );
}
