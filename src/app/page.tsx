'use client';

import { AppShell } from '@/components/app-shell';
import { AgentChat } from '@/components/agent-chat';
import {
  Briefcase,
  ShoppingCart,
  Truck,
  DollarSign,
  Megaphone,
  ArrowRight,
  TrendingUp,
  Package,
  Target,
  Bot,
  Layers,
  Database,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const departments = [
  {
    name: 'Sales Quote Copilot',
    href: '/sales',
    icon: Briefcase,
    color: 'from-blue-500 to-blue-600',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    description: 'Extract customer requirements, check BC inventory and past prices, source supplier quotes, compare margin, and generate salesperson-approved quotations.',
    features: ['RFQ Readiness Check', 'BC Internal Match', 'Supplier Sourcing', 'BC Quote'],
    stats: { label: 'Pending RFQs', value: '3', trend: 'Live demo' },
  },
  {
    name: 'Procurement',
    href: '/procurement',
    icon: ShoppingCart,
    color: 'from-emerald-500 to-emerald-600',
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    description: 'Intelligent supplier comparison, automated PO generation, and inventory alerts',
    features: ['Supplier Price Comparison', 'Smart Procurement Suggestions', 'Inventory Alert System', 'AI Contract Review'],
    stats: { label: 'Inventory Alerts', value: '5', trend: '2 critical' },
  },
  {
    name: 'Logistics',
    href: '/logistics',
    icon: Truck,
    color: 'from-orange-500 to-orange-600',
    lightColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    description: 'Real-time shipment tracking, route optimization, and warehouse visualization',
    features: ['Real-Time Tracking', 'Route Optimization', 'Warehouse Visualization', 'Smart Exception Handling'],
    stats: { label: 'In Transit', value: '6', trend: '1 delayed' },
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: DollarSign,
    color: 'from-purple-500 to-purple-600',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    description: 'AI invoice processing, receivables & payables management, and automated financial reports',
    features: ['AI Invoice Recognition', 'AR/AP Tracking', 'Financial Report Generation', 'Anomaly Detection'],
    stats: { label: 'Overdue AR', value: '$192K', trend: '1 overdue' },
  },
  {
    name: 'Marketing',
    href: '/marketing',
    icon: Megaphone,
    color: 'from-pink-500 to-pink-600',
    lightColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    description: 'Campaign ROI analysis, AI lead scoring, and market trend insights',
    features: ['Campaign ROI Analysis', 'AI Lead Scoring', 'Market Trend Insights', 'Content Recommendations'],
    stats: { label: 'Hot Leads', value: '3', trend: '+2 this week' },
  },
];

const architectureLayers = [
  {
    title: 'Master Agent',
    icon: Bot,
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    items: ['Task Distribution', 'Cross-Dept Coordination', 'Status Tracking', 'Data Aggregation'],
  },
  {
    title: 'Department Agents',
    icon: Layers,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    items: ['Sales Agent', 'Procurement Agent', 'Logistics Agent', 'Finance Agent', 'Marketing Agent'],
  },
  {
    title: 'Shared Tools',
    icon: Wrench,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    items: ['Document Parser', 'Data Query (BC)', 'Email Sender', 'Report Generator'],
  },
  {
    title: 'Shared Data',
    icon: Database,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    items: ['Products', 'Customers', 'Orders', 'Inventory', 'Suppliers'],
  },
];

export default function HomePage() {
  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Smart Workspace</h1>
            <p className="text-muted-foreground text-sm">
              Multi-Agent Architecture — Orchestrated by Master Agent, Powered by Business Central
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout: Agent Chat + Department Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Master Agent Chat (2/3 width) */}
        <div className="xl:col-span-2">
          <div className="h-[600px]">
            <AgentChat defaultAgent="master" title="Master Agent" />
          </div>
        </div>

        {/* Right: Architecture Overview + Quick Links (1/3 width) */}
        <div className="space-y-4">
          {/* Architecture Diagram */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Architecture Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {architectureLayers.map((layer) => {
                const LayerIcon = layer.icon;
                return (
                  <div key={layer.title} className={`rounded-lg border p-3 ${layer.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <LayerIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">{layer.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {layer.items.map((item) => (
                        <Badge key={item} variant="outline" className="text-[10px] px-1.5 py-0 bg-white/60">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* BC Connection Status */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Database className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium">Business Central</div>
                  <div className="text-xs text-emerald-600">Connected — Allinton Engineering</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Department Cards */}
      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Department Workspaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <Card key={dept.name} className="group hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${dept.color} flex items-center justify-center text-white`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm">{dept.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {dept.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${dept.textColor}`}>{dept.stats.value}</span>
                    <span className="text-[10px] text-muted-foreground">{dept.stats.label}</span>
                  </div>
                  <Link href={dept.href}>
                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1 h-7">
                      Open
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold">S$401K</div>
                <div className="text-xs text-muted-foreground">Monthly Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-xl font-bold">200</div>
                <div className="text-xs text-muted-foreground">Sales Lines</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-xl font-bold">34%</div>
                <div className="text-xs text-muted-foreground">Gross Margin</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <div className="text-xl font-bold">6</div>
                <div className="text-xs text-muted-foreground">AI Agents Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
