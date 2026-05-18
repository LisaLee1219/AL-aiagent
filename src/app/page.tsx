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
  Bot,
  Database,
  Wrench,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const departments = [
  {
    name: 'Sales',
    href: '/sales',
    icon: Briefcase,
    description: 'RFQ extraction, BC matching, supplier sourcing, and quotation builder.',
    stat: '3 pending RFQs',
  },
  {
    name: 'Procurement',
    href: '/procurement',
    icon: ShoppingCart,
    description: 'Supplier comparison, purchase orders, and inventory alerts.',
    stat: '5 inventory alerts',
  },
  {
    name: 'Logistics',
    href: '/logistics',
    icon: Truck,
    description: 'Shipment tracking, delivery planning, and warehouse visibility.',
    stat: '6 in transit',
  },
  {
    name: 'Finance',
    href: '/finance',
    icon: DollarSign,
    description: 'Invoices, receivables & payables, and financial reporting.',
    stat: '1 overdue AR',
  },
  {
    name: 'Marketing',
    href: '/marketing',
    icon: Megaphone,
    description: 'Campaign ROI, lead scoring, and market analysis.',
    stat: '3 hot leads',
  },
];

const architectureLayers: {
  title: string;
  icon: LucideIcon;
  items: string[];
}[] = [
  {
    title: 'Master Agent',
    icon: Bot,
    items: ['Task routing', 'Cross-dept coordination', 'Status tracking'],
  },
  {
    title: 'Department agents',
    icon: Layers,
    items: ['Sales', 'Procurement', 'Logistics', 'Finance', 'Marketing'],
  },
  {
    title: 'Shared tools',
    icon: Wrench,
    items: ['BC data query', 'Document parse', 'Reports', 'Email'],
  },
  {
    title: 'Data',
    icon: Database,
    items: ['Products', 'Orders', 'Inventory', 'Customers'],
  },
];

export default function HomePage() {
  return (
    <AppShell>
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Master Agent with Business Central integration. Ask questions or open a department
          workspace below.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="h-[560px]">
            <AgentChat defaultAgent="master" title="Master Agent" />
          </div>
        </div>

        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">System</CardTitle>
              <CardDescription className="text-xs">Platform layout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {architectureLayers.map((layer, index) => {
                const LayerIcon = layer.icon;
                return (
                  <div key={layer.title}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                        <LayerIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{layer.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {layer.items.join(' · ')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Database className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">Business Central</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allinton Engineering & Trading Pte Ltd
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-foreground mb-4">Departments</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {departments.map((dept) => {
            const Icon = dept.icon;
            return (
              <Card
                key={dept.name}
                className="shadow-none hover:border-foreground/20 transition-colors"
              >
                <CardHeader className="pb-2 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/30">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-sm font-medium">{dept.name}</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-relaxed line-clamp-2">
                    {dept.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{dept.stat}</p>
                  <Link href={dept.href}>
                    <Button variant="outline" size="sm" className="w-full h-8 text-xs font-normal">
                      Open
                      <ArrowRight className="w-3 h-3 ml-1 opacity-60" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
