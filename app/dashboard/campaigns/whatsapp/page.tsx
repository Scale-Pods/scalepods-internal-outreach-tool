"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    MessageCircle,
    Send,
    Reply,
    Percent,
    Sparkles,
    Flame,
    RefreshCw,
    Filter,
    X,
    ChevronRight,
    Building2,
    Calendar,
    AlertCircle,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { SPLoader } from "@/components/sp-loader";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { CampaignLabel } from "@/components/dashboard/campaign-badge";
import { CampaignWhatsAppChatDetail } from "@/components/dashboard/campaign-whatsapp-chat-detail";
import type { CampaignWaOverviewStats, CampaignWaLead } from "@/lib/services/campaign-whatsapp";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { useCampaignDateRange } from "@/context/CampaignDateContext";

function CampaignWhatsAppOverviewContent() {
    const router = useRouter();
    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();

    const [stats, setStats] = useState<CampaignWaOverviewStats | null>(null);
    const [recentLeads, setRecentLeads] = useState<CampaignWaLead[]>([]);
    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string; alias?: string | null }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<CampaignWaLead | null>(null);
    const [leadLoading, setLeadLoading] = useState(false);

    // Fetch Overview data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const params = new URLSearchParams();
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            // Fetch Overview stats
            const res = await fetch(`/api/campaigns/whatsapp/overview?${params.toString()}`);
            if (!res.ok) {
                const errorJson = await res.json().catch(() => ({}));
                const errMsg = errorJson.error || errorJson.details || `Failed to fetch overview (HTTP ${res.status})`;
                throw new Error(errMsg);
            }
            const json = await res.json();
            setStats(json.stats || null);

            // Fetch recent 5 leads for activity snapshot
            const leadsParams = new URLSearchParams(params.toString());
            leadsParams.set('page', '1');
            leadsParams.set('pageSize', '5');
            const leadsRes = await fetch(`/api/campaigns/whatsapp/leads?${leadsParams.toString()}`);
            if (leadsRes.ok) {
                const leadsJson = await leadsRes.json();
                setRecentLeads(leadsJson.data || []);
            }
        } catch (err: any) {
            console.error("Failed to fetch WhatsApp overview:", err);
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
        fetch('/api/campaigns/channel-stats?channel=whatsapp')
            .then(r => r.json())
            .then(json => {
                const opts = (json.campaignOptions || []).map((c: any) => ({
                    id: String(c.id || c.campaign_id),
                    name: c.name || c.campaign_name || `Campaign ${c.id || c.campaign_id}`,
                    alias: c.alias || null,
                }));
                setCampaignOptions(opts);
            })
            .catch(err => console.error("Failed to fetch campaign options:", err));
    }, []);

    // Fetch single lead when modal opened
    useEffect(() => {
        if (!selectedLeadId) {
            setSelectedLead(null);
            return;
        }
        setLeadLoading(true);
        fetch(`/api/campaigns/whatsapp/leads/${selectedLeadId}`)
            .then(r => r.json())
            .then(json => {
                setSelectedLead(json.lead || null);
            })
            .catch(err => console.error("Failed to load lead detail:", err))
            .finally(() => setLeadLoading(false));
    }, [selectedLeadId]);

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

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`space-y-6 pb-8 sm:pb-12 pt-4 px-1 sm:px-4 md:px-6 relative ${loading ? 'h-[calc(100dvh-5rem)] overflow-hidden' : 'min-h-[500px]'}`}>
            {loading && <SPLoader />}

            {/* Top Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
                        Campaign WhatsApp Overview
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Real-time WhatsApp outreach performance across all campaigns
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
                    {/* Campaign Dropdown Filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                                <Filter className="h-3.5 w-3.5 text-slate-500" />
                                {selectedCampaigns.length === 0
                                    ? "All Campaigns"
                                    : `${selectedCampaigns.length} Campaign${selectedCampaigns.length > 1 ? 's' : ''}`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white p-1 border border-border shadow-md">
                            <DropdownMenuItem
                                className="text-xs font-bold cursor-pointer text-slate-800 hover:text-slate-900 hover:bg-slate-100"
                                onClick={() => setSelectedCampaigns([])}
                            >
                                All Campaigns
                            </DropdownMenuItem>
                            {campaignOptions.length === 0 ? (
                                <div className="px-2 py-1.5 text-xs text-slate-400 italic">No campaigns found</div>
                            ) : (
                                campaignOptions.map(c => (
                                    <DropdownMenuItem
                                        key={c.id}
                                        className="text-xs cursor-pointer flex items-center justify-between gap-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                                        onClick={() => toggleCampaign(c.id)}
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate font-medium">{c.name}</span>
                                            {c.alias && <span className="text-[10px] text-slate-400 truncate">Alias: {c.alias}</span>}
                                        </div>
                                        {selectedCampaigns.includes(c.id) && (
                                            <Badge className="h-4 px-1 text-[9px] bg-cyan-600 text-white shrink-0">Active</Badge>
                                        )}
                                    </DropdownMenuItem>
                                ))
                            )}
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
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/analytics')}
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

            {/* 5 Core Required Overview Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* 1. Unique Leads Contacted */}
                <MetricCard
                    title="Unique Leads Contacted"
                    value={stats?.uniqueLeadsContacted ?? 0}
                    subtitle="WhatsApp outreach sent"
                    icon={Users}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                />

                {/* 2. Total Replies */}
                <MetricCard
                    title="Total Replies"
                    value={stats?.totalReplies ?? 0}
                    subtitle={`Reply rate: ${stats?.replyRate ?? 0}%`}
                    icon={Reply}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                />

                {/* 3. Total Messages Sent */}
                <MetricCard
                    title="Total Messages Sent"
                    value={stats?.totalMessagesSent ?? 0}
                    subtitle="Bot sequence outreach"
                    icon={Send}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-50"
                />

                {/* 4. PF Leads */}
                <MetricCard
                    title="PF Leads"
                    value={stats?.pfLeads ?? 0}
                    subtitle="Product Fit / Qualified"
                    icon={Flame}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-50"
                />

                {/* 5. Positive Leads */}
                <MetricCard
                    title="Positive Leads"
                    value={stats?.positiveLeads ?? 0}
                    subtitle="Meetings & high intent"
                    icon={Sparkles}
                    iconColor="text-amber-600"
                    iconBg="bg-amber-50"
                />
            </div>

            {/* Campaign Breakdown & Sequence Funnel */}
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
                            onClick={() => router.push('/dashboard/campaigns/whatsapp/analytics')}
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
                                        <th className="px-4 py-3 text-right">Leads Contacted</th>
                                        <th className="px-4 py-3 text-right">Messages Sent</th>
                                        <th className="px-4 py-3 text-right">Replies</th>
                                        <th className="px-4 py-3 text-right">PF Leads</th>
                                        <th className="px-4 py-3 text-right">Positive</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {!stats?.campaignBreakdown?.length ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                No campaign WhatsApp data for selected range.
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.campaignBreakdown.map(c => (
                                            <tr key={c.campaignId} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-4 py-3">
                                                    <CampaignLabel
                                                        campaignId={c.campaignId === 'unknown' ? null : Number(c.campaignId)}
                                                        campaignName={c.campaignName}
                                                        alias={c.campaignAlias}
                                                        showUnassigned
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                    {c.leadsContacted}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                    {c.messagesSent}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                    {c.totalReplies}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-purple-600">
                                                    {c.pfLeads}
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-amber-600">
                                                    {c.positiveLeads}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Sequence Funnel (1 Col) */}
                <Card className="border-border shadow-sm bg-white">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">Outreach Step Funnel</h2>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Bot Sequence</span>
                    </div>
                    <CardContent className="p-4 space-y-3">
                        {stats?.stepBreakdown?.map(item => {
                            const total = stats.totalMessagesSent || 1;
                            const percent = Math.round((item.sentCount / total) * 100);
                            return (
                                <div key={item.step} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Step {item.step} Message</span>
                                        <span className="font-bold text-slate-900">
                                            {item.sentCount}{" "}
                                            <span className="text-slate-400 font-normal">({percent}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(percent, item.sentCount > 0 ? 5 : 0)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Recent WhatsApp Leads Activity */}
            <Card className="border-border shadow-sm bg-white">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Recent WhatsApp Activity</h2>
                        <p className="text-xs text-slate-400">Latest contacted leads and customer replies</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-cyan-600 hover:text-cyan-700 h-7"
                        onClick={() => router.push('/dashboard/campaigns/whatsapp/leads')}
                    >
                        View All Leads <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </div>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {recentLeads.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                No recent WhatsApp activity found.
                            </div>
                        ) : (
                            recentLeads.map(lead => (
                                <div
                                    key={lead.id}
                                    onClick={() => setSelectedLeadId(lead.id)}
                                    className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                                            <MessageCircle className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-900">{lead.fullName}</span>
                                                <CampaignLabel
                                                    campaignId={lead.campaignId}
                                                    campaignName={lead.campaignName}
                                                    alias={lead.campaignAlias}
                                                    compact
                                                />
                                                {lead.isPositive && (
                                                    <Badge className="bg-emerald-100 text-emerald-800 border-none text-[9px] font-bold uppercase">
                                                        Positive
                                                    </Badge>
                                                )}
                                                {lead.isPf && (
                                                    <Badge className="bg-purple-100 text-purple-800 border-none text-[9px] font-bold uppercase">
                                                        PF
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                <span>{lead.mobileNumber || 'No phone'}</span>
                                                {lead.companyName && <span>• {lead.companyName}</span>}
                                                <span>• {lead.messagesSentCount} sent</span>
                                                <span>• {lead.repliesCount} replies</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-end sm:self-center">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] font-bold uppercase ${
                                                lead.hasReplied
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}
                                        >
                                            {lead.hasReplied ? 'Replied' : lead.whatsappStatus || 'Sent'}
                                        </Badge>
                                        <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-cyan-600">
                                            View Chat <ChevronRight className="h-3 w-3 ml-0.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Chat Detail Modal */}
            <Dialog open={!!selectedLeadId} onOpenChange={open => !open && setSelectedLeadId(null)}>
                <DialogContent className="max-w-4xl p-4 sm:p-6 h-[90dvh] lg:h-[85dvh] flex flex-col bg-white overflow-hidden">
                    <VisuallyHidden.Root>
                        <DialogTitle>
                            {selectedLead ? `WhatsApp Chat with ${selectedLead.fullName}` : "WhatsApp Chat Details"}
                        </DialogTitle>
                        <DialogDescription>
                            Conversation history and lead details
                        </DialogDescription>
                    </VisuallyHidden.Root>
                    <CampaignWhatsAppChatDetail
                        lead={selectedLead}
                        loading={leadLoading}
                        onClose={() => setSelectedLeadId(null)}
                    />
                </DialogContent>
            </Dialog>
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
    value: number;
    subtitle: string;
    icon: any;
    iconColor: string;
    iconBg: string;
}) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
                    <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2">
                    <div className="text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
                    <div className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function CampaignWhatsAppOverviewPage() {
    return (
        <Suspense fallback={<SPLoader />}>
            <CampaignWhatsAppOverviewContent />
        </Suspense>
    );
}
