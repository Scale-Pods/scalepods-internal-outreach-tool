"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    Users,
    MessageCircle,
    Send,
    Reply,
    RefreshCw,
    Filter,
    X,
    Sparkles,
    Flame,
    BarChart3,
} from "lucide-react";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SPLoader } from "@/components/sp-loader";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import type { CampaignWaOverviewStats } from "@/lib/services/campaign-whatsapp";

export default function CampaignWhatsAppAnalyticsPage() {
    const router = useRouter();

    const [stats, setStats] = useState<CampaignWaOverviewStats | null>(null);
    const [trendData, setTrendData] = useState<{ date: string; sent: number; replies: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=whatsapp');
            if (res.ok) {
                const json = await res.json();
                setCampaignOptions((json.campaignOptions || []).map((c: any) => ({
                    id: String(c.campaign_id),
                    name: c.campaign_name,
                })));
            }
        } catch (e) {
            console.error("Failed to fetch campaign options:", e);
        }
    }, []);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange.from) {
                params.set('from', startOfDay(dateRange.from).toISOString());
                params.set('to', endOfDay(dateRange.to || dateRange.from).toISOString());
            }
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/whatsapp/analytics?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            const json = await res.json();
            setStats(json.overview || null);
            setTrendData(json.trendData || []);
        } catch (err) {
            console.error("Failed to fetch WhatsApp analytics:", err);
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setDateRange({
                from: new Date(range.range.from),
                to: new Date(range.range.to || range.range.from),
            });
        }
    };

    const toggleCampaign = (id: string) => {
        setSelectedCampaigns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const resetFilters = () => {
        setSelectedCampaigns([]);
        setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    };

    const hasActiveFilters = selectedCampaigns.length > 0;

    const positiveRate = useMemo(() => {
        if (!stats?.uniqueLeadsContacted) return 0;
        return Math.round((stats.positiveLeads / stats.uniqueLeadsContacted) * 1000) / 10;
    }, [stats]);

    const campaignChartData = useMemo(() => {
        return (stats?.campaignBreakdown || []).map(c => ({
            name: c.campaignName,
            sent: c.messagesSent,
            replies: c.totalReplies,
            positive: c.positiveLeads,
        }));
    }, [stats]);

    return (
        <div className="space-y-6 pb-12 pt-4 px-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                        Campaign WhatsApp Analytics
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        In-depth trends, reply rates, and funnel metrics across all campaigns
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Campaign filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                                <Filter className="h-3.5 w-3.5 text-slate-500" />
                                {selectedCampaigns.length === 0
                                    ? "All Campaigns"
                                    : `${selectedCampaigns.length} Campaign${selectedCampaigns.length > 1 ? 's' : ''}`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white p-1">
                            <DropdownMenuItem
                                className="text-xs font-bold cursor-pointer"
                                onClick={() => setSelectedCampaigns([])}
                            >
                                All Campaigns
                            </DropdownMenuItem>
                            {campaignOptions.map(c => (
                                <DropdownMenuItem
                                    key={c.id}
                                    className="text-xs cursor-pointer flex items-center justify-between"
                                    onClick={() => toggleCampaign(c.id)}
                                >
                                    <span className="truncate">{c.name}</span>
                                    {selectedCampaigns.includes(c.id) && (
                                        <Badge className="h-4 px-1 text-[9px] bg-cyan-600">Active</Badge>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Date Picker */}
                    <DateRangePicker onUpdate={handleDateUpdate} />

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 font-bold"
                        >
                            <X className="h-3.5 w-3.5" /> Reset
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchAnalytics}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Quick Sub-navigation banner */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp')}
                >
                    Overview
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/chat')}
                >
                    Chat
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/leads')}
                >
                    Leads
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/analytics')}
                >
                    Analytics
                </Button>
            </div>

            {/* Top KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="border-border shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Leads Contacted</span>
                        <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.uniqueLeadsContacted ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Enrolled: {stats?.totalEnrolled ?? 0}</div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Total Messages</span>
                        <Send className="h-4 w-4 text-cyan-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.totalMessagesSent ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Bot drip messages</div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Customer Replies</span>
                        <Reply className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.totalReplies ?? 0}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                        {stats?.replyRate ?? 0}% reply rate
                    </div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Positive Leads</span>
                        <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.positiveLeads ?? 0}
                    </div>
                    <div className="text-[11px] text-amber-600 font-bold mt-0.5">
                        {positiveRate}% positive rate
                    </div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>PF Leads</span>
                        <Flame className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.pfLeads ?? 0}
                    </div>
                    <div className="text-[11px] text-purple-600 font-bold mt-0.5">Product fit qualified</div>
                </Card>
            </div>

            {/* Daily Trend Area Chart */}
            <Card className="border-border shadow-sm bg-white">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        Daily Activity Trend (Messages Sent vs Replies)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                        Chronological volume of bot outreach sent and inbound customer replies
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    {trendData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                            No daily message activity in the selected date range.
                        </div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#ffffff',
                                            borderColor: '#e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sent"
                                        name="Bot Sent"
                                        stroke="#06b6d4"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorSent)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="replies"
                                        name="Replies"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorReplies)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Campaign Comparison Chart */}
            <Card className="border-border shadow-sm bg-white">
                <CardHeader className="p-4 border-b border-border">
                    <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-cyan-600" />
                        Campaign Comparison
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400">
                        Outreach messages and replies by campaign
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    {campaignChartData.length === 0 ? (
                        <div className="h-60 flex flex-col items-center justify-center text-slate-400 text-xs">
                            No campaigns with WhatsApp activity in selected range.
                        </div>
                    ) : (
                        <div className="h-60 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={campaignChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#ffffff',
                                            borderColor: '#e2e8f0',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                        }}
                                    />
                                    <Bar dataKey="sent" name="Messages Sent" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="replies" name="Replies Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="positive" name="Positive Leads" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

