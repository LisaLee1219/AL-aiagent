'use client';

import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Megaphone,
  Target,
  TrendingUp,
  Users,
  Sparkles,
  Loader2,
  Flame,
  Zap,
  BarChart3,
  Globe,
} from 'lucide-react';
import { useState } from 'react';
import type { Campaign, Lead } from '@/lib/mock-data';
import { FloatingAgent } from '@/components/floating-agent';
import { mockCampaigns, mockLeads } from '@/lib/mock-data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const LEAD_COLORS = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#6b7280',
};

const CHANNEL_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const totalBudget = mockCampaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = mockCampaigns.reduce((sum, c) => sum + c.spent, 0);
  const totalLeads = mockCampaigns.reduce((sum, c) => sum + c.leads, 0);
  const totalConversions = mockCampaigns.reduce((sum, c) => sum + c.conversions, 0);

  const leadDistribution = [
    { name: 'Hot', value: mockLeads.filter((l) => l.status === 'hot').length, color: LEAD_COLORS.hot },
    { name: 'Warm', value: mockLeads.filter((l) => l.status === 'warm').length, color: LEAD_COLORS.warm },
    { name: 'Cold Lead', value: mockLeads.filter((l) => l.status === 'cold').length, color: LEAD_COLORS.cold },
  ];

  const channelData = mockCampaigns.map((c) => ({
    name: c.channel,
    leads: c.leads,
    conversions: c.conversions,
    roi: c.roi,
  }));

  const handleLeadScoring = async (lead: Lead) => {
    setIsAnalyzing(true);
    setAiAnalysis('');

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'marketing',
          context: `Lead Information:\nCompany: ${lead.company}\nContact: ${lead.contact}\nIndustry: ${lead.industry}\nSource: ${lead.source}\nCurrent Score: ${lead.score}/100\nStatus: ${lead.status === 'hot' ? 'Hot' : lead.status === 'warm' ? 'Warm' : 'Cold Lead'}\nEst. Value: S$${lead.estimatedValue.toLocaleString()}\nLast Activity: ${lead.lastActivity}`,
          question: `Please analyse this lead${lead.company}，Provide detailed scoring rationale, follow-up strategy, and conversion recommendations.`,
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
      setAiAnalysis('Lead analysis is temporarily unavailable.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-gray-600';
  };

  const getStatusBadge = (status: Lead['status']) => {
    switch (status) {
      case 'hot': return <Badge className="bg-red-100 text-red-700 text-xs"><Flame className="w-3 h-3 mr-1" />Hot</Badge>;
      case 'warm': return <Badge className="bg-amber-100 text-amber-700 text-xs"><Zap className="w-3 h-3 mr-1" />Warm</Badge>;
      case 'cold': return <Badge variant="secondary" className="text-xs">Cold Lead</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Marketing Marketing Workspace</h1>
        <p className="text-muted-foreground mt-1">
          Campaign ROI analysis, AI lead scoring, and market trend insights
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-pink-600" />
              </div>
              <div>
                <div className="text-xl font-bold">S${(totalBudget / 10000).toFixed(0)}K</div>
                <div className="text-xs text-muted-foreground">Total Campaign Budget</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalLeads}</div>
                <div className="text-xs text-muted-foreground">Total Leads</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-xl font-bold">{totalConversions}</div>
                <div className="text-xs text-muted-foreground">Conversions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xl font-bold">{((totalConversions / totalLeads) * 100).toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Conv. Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaign Analysis</TabsTrigger>
          <TabsTrigger value="leads">Lead Scoring</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-pink-600" />
                    Campaign Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockCampaigns.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{campaign.name}</span>
                          <Badge variant={campaign.status === 'active' ? 'default' : campaign.status === 'completed' ? 'secondary' : 'outline'} className="text-xs">
                            {campaign.status === 'active' ? 'In Progress' : campaign.status === 'completed' ? 'Completed' : 'Paused'}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-xs">{campaign.channel}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs mb-2">
                        <div>
                          <span className="text-muted-foreground">Budget Used</span>
                          <div className="font-semibold">S${(campaign.spent / 10000).toFixed(1)}K / S${(campaign.budget / 10000).toFixed(0)}K</div>
                          <Progress value={(campaign.spent / campaign.budget) * 100} className="h-1.5 mt-1" />
                        </div>
                        <div>
                          <span className="text-muted-foreground">Leads</span>
                          <div className="font-semibold">{campaign.leads}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversions</span>
                          <div className="font-semibold">{campaign.conversions}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ROI</span>
                          <div className={`font-semibold ${campaign.roi >= 3 ? 'text-green-600' : campaign.roi >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                            {campaign.roi}x
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {campaign.startDate} ~ {campaign.endDate}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Lead Distribution by Channel</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={channelData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="leads"
                        nameKey="name"
                        label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {channelData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Lead Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={leadDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                      >
                        {leadDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-pink-600" />
                    AI Lead Scoring
                  </CardTitle>
                  <CardDescription>AI scores leads automatically based on industry, source, behaviour, and more</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mockLeads.sort((a, b) => b.score - a.score).map((lead) => (
                    <div key={lead.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{lead.company}</span>
                          {getStatusBadge(lead.status)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${getScoreColor(lead.score)}`}>{lead.score}</span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Contact</span>
                          <div className="font-medium">{lead.contact}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Industry</span>
                          <div>{lead.industry}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Source</span>
                          <div>{lead.source}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Value</span>
                          <div className="font-medium">S${(lead.estimatedValue / 10000).toFixed(0)}K</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Last Activity: {lead.lastActivity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => handleLeadScoring(lead)}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Deep Analysis
                        </Button>
                      </div>
                      <Progress value={lead.score} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div>
              {aiAnalysis && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-600" />
                      AI Lead Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap bg-pink-50/50 p-3 rounded-lg">
                      {aiAnalysis}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-pink-600" />
                Market Trend Insights
              </CardTitle>
              <CardDescription>AI-analysed market trends with marketing strategy recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Channel ROI Comparison</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={channelData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="roi" fill="#ec4899" name="ROI (x)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-3">Lead Conversion Funnel</h3>
                  <div className="space-y-3 pt-2">
                    {[
                      { label: 'Total Leads', value: totalLeads, color: 'bg-blue-500' },
                      { label: 'Warm Leads', value: mockLeads.filter(l => l.score >= 60).length, color: 'bg-amber-500' },
                      { label: 'Hot Leads', value: mockLeads.filter(l => l.score >= 80).length, color: 'bg-red-500' },
                      { label: 'Converted', value: totalConversions, color: 'bg-green-500' },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div
                            className={`${item.color} h-3 rounded-full transition-all`}
                            style={{ width: `${(item.value / totalLeads) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                className="w-full mt-6"
                size="lg"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Generated Marketing Strategy Recommendations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    
      <FloatingAgent agent="marketing" />
    </AppShell>
  );
}
