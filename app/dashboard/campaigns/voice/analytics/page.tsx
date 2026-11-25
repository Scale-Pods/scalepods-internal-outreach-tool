"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    PhoneCall,
    Mic,
    Clock,
    Sparkles,
    Filter,
    X,
    RefreshCw,
    CheckCircle2,
    PhoneOff,
    BarChart3,
    Users,
    Smile,
    Meh,
    Frown,
    Radio,
    PhoneIncoming,
} from "lucide-react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
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
import { formatDuration } from "@/lib/utils";
import type { CampaignVoiceOverviewStats } from "@/lib/services/campaign-voice";
import { useCampaignDateRange } from "@/context/CampaignDateContext";

const SENTIMENT_COLORS = {
    positive: "#10b981", // emerald
    neutral: "#94a3b8",  // slate
    negative: "#f43f5e", // rose
};

export default function CampaignVoiceAnalyticsPage() {
    const router = useRouter();

    const [stats, setStats] = useState<CampaignVoiceOverviewStats | null>(null);
    const [loading, setLoading] = useState(true);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=voice');
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
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/voice/analytics?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch voice analytics");
            const json = await res.json();
            setStats(json.overview || null);
        } catch (err) {
            console.error("Failed to fetch Voice analytics:", err);
        } finally {
            setLoading(false);
        }
    }, [fromIso, toIso, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const handleDateUpdate = (range: any) => {
        if (range?.from) {
            setDateRange(range);
        } else if (range?.range?.from) {
            setDateRange(range.range, range.label);
        } else {
            setDateRange(undefined);
        }
    };

    const toggleCampaign = (id: string) => {
        setSelectedCampaigns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const resetFilters = () => {
        setSelectedCampaigns([]);
        setDateRange(undefined);
    };

    const hasActiveFilters = selectedCampaigns.length > 0;

    const positiveRate = useMemo(() => {
        if (!stats || !stats.totalCalls) return 0;
        return Math.round((stats.positiveSentimentCalls / stats.totalCalls) * 1000) / 10;
    }, [stats]);

    const pickedUpPositiveRate = useMemo(() => {
        if (!stats || !stats.callsPickedUp) return 0;
        return Math.round((stats.positiveSentimentCalls / stats.callsPickedUp) * 1000) / 10;
    }, [stats]);

    const campaignBarData = useMemo(() => {
        if (!stats?.campaignBreakdown) return [];
        return stats.campaignBreakdown.map(c => ({
            name: c.campaignName,
            calls: c.totalCalls,
            pickedUp: c.pickedUpCalls,
            positive: c.positiveCalls,
            pickupRate: c.totalCalls > 0 ? Math.round((c.pickedUpCalls / c.totalCalls) * 100) : 0,
        }));
    }, [stats]);

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`space-y-6 pb-12 pt-4 px-6 relative ${loading ? 'h-[calc(100vh-6rem)] overflow-hidden' : 'min-h-[500px]'}`}>
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-cyan-600" />
                        Campaign Voice Analytics
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        In-depth trends, pickup rates, sentiment breakdown, and touchpoint funnel performance
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
                    <DateRangePicker value={dateRange} onUpdate={handleDateUpdate} />

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
                    onClick={() => router.push('/dashboard/campaigns/voice')}
                >
                    Overview
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice/logs')}
                >
                    Call Logs
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
                    onClick={() => router.push('/dashboard/campaigns/voice/analytics')}
                >
                    Analytics
                </Button>
            </div>

            {/* Top KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Total Calls</span>
                        <PhoneCall className="h-4 w-4 text-cyan-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.totalCalls ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Attempted AI calls</div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Leads Contacted</span>
                        <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.uniqueLeadsContacted ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Distinct leads called</div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Pickup Rate</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 mt-2">
                        {stats?.pickupRate ?? 0}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{stats?.callsPickedUp ?? 0} answered</div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Inbound Calls</span>
                        <PhoneIncoming className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 mt-2">
                        {stats?.inboundCalls ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {stats?.inboundRate ?? 0}% of total · {stats?.inboundPickedUp ?? 0} picked up
                    </div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Positive Leads</span>
                        <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {stats?.positiveSentimentCalls ?? 0}
                    </div>
                    <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                        {pickedUpPositiveRate}% of answered
                    </div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Avg Duration</span>
                        <Clock className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {formatDuration(stats?.avgDurationSeconds || 0)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Per call average</div>
                </Card>

                <Card className="border-border shadow-xs bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                        <span>Total Talk Time</span>
                        <Mic className="h-4 w-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">
                        {Math.round((stats?.totalDurationSeconds || 0) / 60)} <span className="text-sm font-normal text-slate-500">mins</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        Cost: {stats?.totalCostUsd !== null && stats?.totalCostUsd !== undefined ? `₹${stats.totalCostUsd.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : 'N/A'}
                    </div>
                </Card>
            </div>

            {/* Charts Row 1: Daily Volume Trend & Hourly Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Call Volume & Pickup Trend */}
                <Card className="lg:col-span-2 border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-cyan-600" />
                                Daily Call Volume &amp; Answered Trend
                            </span>
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Volume of calls dispatched vs answered over the selected date range
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(!stats?.dailyVolume || stats.dailyVolume.length === 0) ? (
                            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                No call volume data for this date range
                            </div>
                        ) : (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.dailyVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="totalCallsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                                            </linearGradient>
                                            <linearGradient id="pickedUpGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                        <Area
                                            type="monotone"
                                            dataKey="totalCalls"
                                            name="Calls Placed"
                                            stroke="#06b6d4"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#totalCallsGrad)"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="pickedUp"
                                            name="Picked Up"
                                            stroke="#10b981"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#pickedUpGrad)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Hourly Call Distribution */}
                <Card className="border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-indigo-600" />
                            Hourly Distribution
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Calls initiated by time of day (00:00 - 23:00)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(!stats?.hourlyDistribution || stats.hourlyDistribution.every(h => h.calls === 0)) ? (
                            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                No hourly call activity
                            </div>
                        ) : (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.hourlyDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={2} />
                                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Bar dataKey="calls" name="Calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2: Campaign Performance & Touchpoint Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campaign Breakdown Performance */}
                <Card className="border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-600" />
                            Campaign Calling Volume &amp; Pickup
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Total calls dispatched versus answered per campaign
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {campaignBarData.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                                No campaign call data
                            </div>
                        ) : (
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={campaignBarData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: '#475569' }}
                                            axisLine={false}
                                            tickLine={false}
                                            angle={-15}
                                            textAnchor="end"
                                        />
                                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                        <Bar dataKey="calls" name="Total Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="pickedUp" name="Picked Up" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="positive" name="Positive Leads" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Touchpoint Funnel (Call 1 -> Call 2 -> Call 3) */}
                <Card className="border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Radio className="h-5 w-5 text-cyan-600" />
                            Multi-Touch Call Funnel
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Progression and conversion across outreach cadences Call 1, 2, and 3
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="space-y-4">
                            {(stats?.callNumberBreakdown || []).map((slot) => {
                                const rate = slot.count > 0 ? Math.round((slot.pickedUp / slot.count) * 100) : 0;
                                return (
                                    <div key={slot.callNumber} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/40">
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0">
                                                    Call {slot.callNumber}
                                                </Badge>
                                                <span className="font-bold text-slate-800">
                                                    {slot.callNumber === 1 ? 'Initial Touchpoint' : slot.callNumber === 2 ? 'Follow-Up Attempt' : 'Final Cadence Touch'}
                                                </span>
                                            </div>
                                            <span className="font-bold text-slate-900">
                                                {slot.count} calls ({slot.pickedUp} picked up)
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                                            <div
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(rate, 100)}%` }}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                                            <span className="flex items-center gap-1 font-medium text-emerald-700">
                                                <CheckCircle2 className="h-3 w-3" /> {rate}% Pickup Rate
                                            </span>
                                            <span className="flex items-center gap-1 font-medium text-amber-700">
                                                <Sparkles className="h-3 w-3" /> {slot.positive} Positive Sentiment
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 3: Sentiment & Outcomes Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sentiment Distribution */}
                <Card className="border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            AI Sentiment Distribution
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Evaluated lead interest from call transcripts and notes
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 text-center">
                                <Smile className="h-6 w-6 text-emerald-600 mx-auto mb-1.5" />
                                <p className="text-xs font-semibold text-emerald-800">Positive</p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">{stats?.positiveSentimentCalls ?? 0}</p>
                                <p className="text-[10px] text-emerald-600 mt-0.5">{positiveRate}% of total</p>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center">
                                <Meh className="h-6 w-6 text-slate-500 mx-auto mb-1.5" />
                                <p className="text-xs font-semibold text-slate-700">Neutral</p>
                                <p className="text-2xl font-bold text-slate-800 mt-1">{stats?.neutralSentimentCalls ?? 0}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Informational / General</p>
                            </div>

                            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 text-center">
                                <Frown className="h-6 w-6 text-rose-600 mx-auto mb-1.5" />
                                <p className="text-xs font-semibold text-rose-800">Negative</p>
                                <p className="text-2xl font-bold text-rose-700 mt-1">{stats?.negativeSentimentCalls ?? 0}</p>
                                <p className="text-[10px] text-rose-600 mt-0.5">Not interested / DND</p>
                            </div>
                        </div>

                        {/* Relative breakdown bar */}
                        <div className="mt-5">
                            <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                                <span>Sentiment Proportion</span>
                                <span>{stats?.totalCalls ?? 0} Analyzed Calls</span>
                            </div>
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                {stats && stats.totalCalls > 0 && (
                                    <>
                                        <div
                                            className="bg-emerald-500 h-full"
                                            style={{ width: `${(stats.positiveSentimentCalls / stats.totalCalls) * 100}%` }}
                                            title={`Positive: ${stats.positiveSentimentCalls}`}
                                        />
                                        <div
                                            className="bg-slate-400 h-full"
                                            style={{ width: `${(stats.neutralSentimentCalls / stats.totalCalls) * 100}%` }}
                                            title={`Neutral: ${stats.neutralSentimentCalls}`}
                                        />
                                        <div
                                            className="bg-rose-500 h-full"
                                            style={{ width: `${(stats.negativeSentimentCalls / stats.totalCalls) * 100}%` }}
                                            title={`Negative: ${stats.negativeSentimentCalls}`}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Call Outcomes Breakdown */}
                <Card className="border-border shadow-xs bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            Call Pickup &amp; Reachability
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Answered versus unanswered calls across voice outreach campaigns
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/40">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-cyan-800">Picked Up / Completed</span>
                                    <CheckCircle2 className="h-4 w-4 text-cyan-600" />
                                </div>
                                <p className="text-2xl font-bold text-cyan-900 mt-2">{stats?.callsPickedUp ?? 0}</p>
                                <p className="text-[11px] text-cyan-700 mt-0.5">{stats?.pickupRate ?? 0}% connected rate</p>
                            </div>

                            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-rose-800">Missed / Unanswered</span>
                                    <PhoneOff className="h-4 w-4 text-rose-600" />
                                </div>
                                <p className="text-2xl font-bold text-rose-900 mt-2">{stats?.callsMissed ?? 0}</p>
                                <p className="text-[11px] text-rose-700 mt-0.5">
                                    {stats && stats.totalCalls > 0 ? Math.round((stats.callsMissed / stats.totalCalls) * 100) : 0}% missed rate
                                </p>
                            </div>

                            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-indigo-800">Inbound Received</span>
                                    <PhoneIncoming className="h-4 w-4 text-indigo-600" />
                                </div>
                                <p className="text-2xl font-bold text-indigo-900 mt-2">{stats?.inboundCalls ?? 0}</p>
                                <p className="text-[11px] text-indigo-700 mt-0.5">
                                    {stats?.inboundRate ?? 0}% of all calls · {stats?.outboundCalls ?? 0} outbound
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs text-slate-600">
                            <p className="font-semibold text-slate-800 mb-1">Cadence Optimization Tip:</p>
                            <p>
                                Leads not reached on Call 1 will automatically queue for Call 2 according to your campaign cadence delays.
                                Reachability peaks during mid-day business hours.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
