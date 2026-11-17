"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Mic,
    Users,
    PhoneCall,
    PhoneOff,
    Sparkles,
    Flame,
    Clock,
    DollarSign,
    Filter,
    RefreshCw,
    X,
    ChevronRight,
    Building2,
    Calendar,
    Phone,
    AlertCircle,
    ThumbsUp,
    ThumbsDown,
    Minus,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CampaignBadge } from "@/components/dashboard/campaign-badge";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { formatDuration } from "@/lib/utils";
import type { CampaignVoiceOverviewStats, CampaignVoiceCall } from "@/lib/services/campaign-voice";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useCampaignDateRange } from "@/context/CampaignDateContext";

export default function CampaignVoiceOverviewPage() {
    const router = useRouter();
    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();

    const [stats, setStats] = useState<CampaignVoiceOverviewStats | null>(null);
    const [recentCalls, setRecentCalls] = useState<CampaignVoiceCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);

    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = new URLSearchParams();
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            // 1. Fetch Overview stats
            const res = await fetch(`/api/campaigns/voice/overview?${params.toString()}`);
            if (!res.ok) {
                const errorJson = await res.json().catch(() => ({}));
                throw new Error(errorJson.error || errorJson.details || `Failed to fetch voice overview (HTTP ${res.status})`);
            }
            const json = await res.json();
            setStats(json.stats || null);

            // 2. Fetch recent calls for quick activity feed
            const callsParams = new URLSearchParams(params.toString());
            callsParams.set('page', '1');
            callsParams.set('pageSize', '6');
            const callsRes = await fetch(`/api/campaigns/voice/calls?${callsParams.toString()}`);
            if (callsRes.ok) {
                const callsJson = await callsRes.json();
                setRecentCalls(callsJson.data || []);
            }
        } catch (err: any) {
            console.error("Failed to fetch campaign voice overview:", err);
            setFetchError(err?.message || "Failed to fetch overview");
        } finally {
            setLoading(false);
        }
    }, [fromIso, toIso, selectedCampaigns]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Fetch campaign options once
    useEffect(() => {
        fetch('/api/campaigns/channel-stats?channel=voice')
            .then(r => r.json())
            .then(json => {
                const opts = (json.campaignOptions || []).map((c: any) => ({
                    id: String(c.campaign_id),
                    name: c.campaign_name,
                }));
                setCampaignOptions(opts);
            })
            .catch(err => console.error("Failed to fetch campaign options:", err));
    }, []);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
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

    const openCallDetails = (call: CampaignVoiceCall) => {
        setSelectedCall({
            id: call.vapiCallId || call.id,
            name: call.leadName,
            phone: call.phone,
            startedAt: call.callDate,
            durationSeconds: call.durationSeconds,
            status: call.status,
            cost: call.costUsd !== null && call.costUsd !== undefined ? `$${call.costUsd.toFixed(2)}` : 'N/A',
            callSummary: call.summary,
            audio_url: call.recordingUrl,
            transcript: call.transcript,
            note: call.note,
            campaignName: call.campaignName,
            callNumber: call.callNumber,
        });
        setModalOpen(true);
    };

    return (
        <div className="space-y-6 pb-12 pt-4 px-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Mic className="h-6 w-6 text-cyan-600" />
                        Campaign Voice Overview
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        AI voice outreach &amp; dialer campaign tracking from &quot;outreach_leads&quot; and &quot;vapi_call_logs&quot;
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

                    {/* Date Range Picker */}
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

                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchData}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Quick Sub-navigation banner */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
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
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice/cold-logs')}
                >
                    Cold Call Logs
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice/analytics')}
                >
                    Analytics
                </Button>
            </div>

            {/* Error banner if fetch failed */}
            {fetchError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                        <span className="font-medium">{fetchError}</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100 gap-1 font-semibold"
                    >
                        <RefreshCw className="h-3 w-3" /> Retry
                    </Button>
                </div>
            )}

            {/* Primary KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Total Calls"
                    value={stats?.totalCalls ?? 0}
                    subtitle="AI outreach attempts"
                    icon={PhoneCall}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                />

                <MetricCard
                    title="Unique Leads Contacted"
                    value={stats?.uniqueLeadsContacted ?? 0}
                    subtitle="Distinct campaign contacts"
                    icon={Users}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50"
                />

                <MetricCard
                    title="Calls Picked Up"
                    value={stats?.callsPickedUp ?? 0}
                    subtitle={`Pickup rate: ${stats?.pickupRate ?? 0}%`}
                    icon={Phone}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                />

                <MetricCard
                    title="Missed / Unanswered"
                    value={stats?.callsMissed ?? 0}
                    subtitle="No answer or busy"
                    icon={PhoneOff}
                    iconColor="text-slate-600"
                    iconBg="bg-slate-100"
                />

                <MetricCard
                    title="Positive Sentiment"
                    value={stats?.positiveSentimentCalls ?? 0}
                    subtitle="Interested & high intent"
                    icon={Sparkles}
                    iconColor="text-amber-600"
                    iconBg="bg-amber-50"
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 bg-white border border-border rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Duration</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                            {formatDuration(stats?.avgDurationSeconds ?? 0)}
                        </div>
                    </div>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>

                <div className="p-3 bg-white border border-border rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Duration</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                            {formatDuration(stats?.totalDurationSeconds ?? 0)}
                        </div>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Clock className="h-4 w-4" />
                    </div>
                </div>

                <div className="p-3 bg-white border border-border rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neutral Calls</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                            {stats?.neutralSentimentCalls ?? 0}
                        </div>
                    </div>
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                        <Minus className="h-4 w-4" />
                    </div>
                </div>

                <div className="p-3 bg-white border border-border rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Negative Calls</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                            {stats?.negativeSentimentCalls ?? 0}
                        </div>
                    </div>
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                        <ThumbsDown className="h-4 w-4" />
                    </div>
                </div>

                <div className="p-3 bg-white border border-border rounded-xl flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call Cost</div>
                        <div className="text-base font-bold text-slate-800 mt-0.5">
                            {stats?.totalCostUsd !== null && stats?.totalCostUsd !== undefined ? `$${stats.totalCostUsd.toFixed(2)}` : 'N/A'}
                        </div>
                    </div>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <DollarSign className="h-4 w-4" />
                    </div>
                </div>
            </div>

            {/* Campaign Breakdown & Call Slots */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Campaign Breakdown Table (2 Cols) */}
                <Card className="lg:col-span-2 border-border shadow-sm bg-white overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-cyan-600" />
                            <h2 className="text-sm font-bold text-slate-900">Campaign Performance Breakdown</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-cyan-600 hover:text-cyan-700 h-7"
                            onClick={() => router.push('/dashboard/campaigns/voice/analytics')}
                        >
                            View Analytics <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                    </div>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3">Campaign</th>
                                        <th className="px-4 py-3 text-center">Total Calls</th>
                                        <th className="px-4 py-3 text-center">Unique Leads</th>
                                        <th className="px-4 py-3 text-center">Picked Up</th>
                                        <th className="px-4 py-3 text-center">Positive</th>
                                        <th className="px-4 py-3 text-right">Avg Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {!stats?.campaignBreakdown || stats.campaignBreakdown.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                No campaign call activity found for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.campaignBreakdown.map(c => (
                                            <tr key={c.campaignId} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 font-semibold text-slate-900">
                                                    <CampaignBadge
                                                        campaignId={c.campaignId === 'unknown' ? null : Number(c.campaignId)}
                                                        campaignName={c.campaignName}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-800">
                                                    {c.totalCalls}
                                                </td>
                                                <td className="px-4 py-3 text-center font-semibold text-slate-600">
                                                    {c.uniqueLeads}
                                                </td>
                                                <td className="px-4 py-3 text-center text-emerald-600 font-bold">
                                                    {c.pickedUpCalls}
                                                </td>
                                                <td className="px-4 py-3 text-center text-amber-600 font-bold">
                                                    {c.positiveCalls}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-600">
                                                    {formatDuration(c.avgDurationSeconds)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Call Slot Distribution (Call 1, Call 2, Call 3) */}
                <Card className="border-border shadow-sm bg-white">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PhoneCall className="h-4 w-4 text-cyan-600" />
                            <h2 className="text-sm font-bold text-slate-900">Calls by Touchpoint</h2>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Touch 1–3</span>
                    </div>
                    <CardContent className="p-4 space-y-4">
                        {(stats?.callNumberBreakdown || [
                            { callNumber: 1, count: 0, pickedUp: 0, positive: 0 },
                            { callNumber: 2, count: 0, pickedUp: 0, positive: 0 },
                            { callNumber: 3, count: 0, pickedUp: 0, positive: 0 },
                        ]).map(item => {
                            const pct = stats?.totalCalls ? Math.round((item.count / stats.totalCalls) * 100) : 0;
                            return (
                                <div key={item.callNumber} className="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-cyan-600" />
                                            Call Touchpoint {item.callNumber}
                                        </span>
                                        <span>{item.count} Calls ({pct}%)</span>
                                    </div>
                                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-cyan-600 h-1.5 rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                        <span>Picked up: <strong className="text-emerald-600">{item.pickedUp}</strong></span>
                                        <span>Positive: <strong className="text-amber-600">{item.positive}</strong></span>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Call Activity Snapshot */}
            <Card className="border-border shadow-sm bg-white overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-emerald-600" />
                        <h2 className="text-sm font-bold text-slate-900">Recent Voice Outreach Activity</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-cyan-600 hover:text-cyan-700 h-7"
                        onClick={() => router.push('/dashboard/campaigns/voice/logs')}
                    >
                        View Full Logs <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </div>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-border">
                                <tr>
                                    <th className="px-4 py-3">Campaign</th>
                                    <th className="px-4 py-3">Lead Name</th>
                                    <th className="px-4 py-3">Phone</th>
                                    <th className="px-4 py-3 text-center">Touch</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Sentiment</th>
                                    <th className="px-4 py-3 text-center">Duration</th>
                                    <th className="px-4 py-3">Call Date</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentCalls.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                                            No recent call activity found.
                                        </td>
                                    </tr>
                                ) : (
                                    recentCalls.map(c => (
                                        <tr
                                            key={c.id}
                                            onClick={() => openCallDetails(c)}
                                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3">
                                                <CampaignBadge
                                                    campaignId={c.campaignId}
                                                    campaignName={c.campaignName}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-900">
                                                {c.leadName}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                                                {c.phone}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                                                Call {c.callNumber}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] font-bold uppercase ${
                                                        c.isPickedUp
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    {c.status}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] font-bold uppercase ${
                                                        c.sentiment === 'positive'
                                                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                            : c.sentiment === 'negative'
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    {c.sentiment}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-slate-600">
                                                {formatDuration(c.durationSeconds)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                                                {c.callDate ? new Date(c.callDate).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                }) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                    onClick={() => openCallDetails(c)}
                                                >
                                                    Details
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal for call details */}
            <CallDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                call={selectedCall}
            />
        </div>
    );
}

function MetricCard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor,
    iconBg,
}: {
    title: string;
    value: number | string;
    subtitle: string;
    icon: any;
    iconColor: string;
    iconBg: string;
}) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {title}
                    </span>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                        {subtitle}
                    </p>
                </div>
                <div className={`p-3 rounded-2xl ${iconBg} ${iconColor} flex-shrink-0 shadow-sm`}>
                    <Icon className="h-5 w-5" />
                </div>
            </CardContent>
        </Card>
    );
}
