"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Users, Send, Reply, UserMinus, AlertCircle, MessageCircle, Mic, RefreshCw, CheckCircle2, Sparkles, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import { CampaignBadge, campaignColorClasses } from "@/components/dashboard/campaign-badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignDateRange } from "@/context/CampaignDateContext";
import type { CampaignColor } from "@/lib/services/campaigns";

interface CampaignSummary {
    campaignId: number | string;
    campaignName: string;
    color: CampaignColor;
    totalLeads: number;
    emailSent: number;
    emailReplied: number;
    unsubscribed: number;
    bounced: number;
    whatsappActive: number;
    voiceActive: number;
    contacted: number;
    newLeads: number;
}

interface DashboardStats {
    totalLeads: number;
    totalCampaigns: number;
    emailSent: number;
    emailReplied: number;
    unsubscribed: number;
    bounced: number;
    whatsappActive: number;
    voiceActive: number;
    contacted: number;
    newLeads: number;
    whatsappSent?: number;
    whatsappReplies?: number;
    whatsappReplyRate?: number;
    whatsappContacted?: number;
    whatsappUniqueReplied?: number;
    voiceCalls?: number;
    voiceSarvamCalls?: number;
    voiceTwilioCalls?: number;
    voicePickedUp?: number;
    voicePickupRate?: number;
    voicePositive?: number;
    voiceDurationSeconds?: number;
    voiceDurationString?: string;
    campaigns: CampaignSummary[];
}

export default function CampaignsDashboardPage() {
    const router = useRouter();
    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            const res = await fetch(`/api/campaigns/dashboard?${params.toString()}`);
            const json = await res.json();
            setStats(json);
        } catch (err) {
            console.error("Failed to fetch campaign dashboard stats:", err);
        } finally {
            setLoading(false);
        }
    }, [fromIso, toIso]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px] px-6">
            {loading && <SPLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campaigns</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Multi-channel outreach performance across all campaigns, synced from Supabase
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker
                        value={dateRange}
                        onUpdate={({ range, label }) => setDateRange(range, label)}
                    />
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 h-10 px-4">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Row 1: High Level Campaign Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Leads"
                    value={stats?.totalLeads ?? "..."}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/campaigns/leads')}
                />
                <MetricCard
                    title="Active Campaigns"
                    value={stats?.totalCampaigns ?? "..."}
                    icon={<Sparkles className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                />
                <MetricCard
                    title="Emails Sent"
                    value={stats?.emailSent ?? "..."}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/campaigns/email')}
                />
                <MetricCard
                    title="Replied"
                    value={stats?.emailReplied ?? "..."}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-cyan-50 text-cyan-600"
                    onClick={() => router.push('/dashboard/campaigns/email')}
                />
            </div>

            {/* Row 2: Lead Acquisition & Lifecycle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="New Leads"
                    value={stats?.newLeads ?? "..."}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-slate-100 text-slate-600"
                    onClick={() => router.push('/dashboard/campaigns/leads')}
                />
                <MetricCard
                    title="Contacted"
                    value={stats?.contacted ?? "..."}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/campaigns/leads')}
                />
                <MetricCard
                    title="Unsubscribed"
                    value={stats?.unsubscribed ?? "..."}
                    icon={<UserMinus className="h-5 w-5" />}
                    iconBg="bg-rose-50 text-rose-600"
                />
                <MetricCard
                    title="Bounced"
                    value={stats?.bounced ?? "..."}
                    icon={<AlertCircle className="h-5 w-5" />}
                    iconBg="bg-amber-50 text-amber-600"
                />
            </div>

            {/* Row 3: WhatsApp & Voice Multi-Channel Outreach Metrics (Section 2 marked area) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="WhatsApp Sent"
                    value={stats?.whatsappSent !== undefined ? stats.whatsappSent.toLocaleString() : "..."}
                    subtitle={`${stats?.whatsappContacted ?? 0} leads contacted`}
                    icon={<MessageCircle className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp')}
                />
                <MetricCard
                    title="WhatsApp Replies"
                    value={stats?.whatsappReplies !== undefined ? stats.whatsappReplies.toLocaleString() : "..."}
                    subtitle={`${stats?.whatsappReplyRate ?? 0}% Reply Rate${stats?.whatsappUniqueReplied ? ` (${stats.whatsappUniqueReplied} leads)` : ''}`}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-teal-50 text-teal-600"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/chat')}
                />
                <MetricCard
                    title="Voice Calls"
                    value={stats?.voiceCalls !== undefined ? stats.voiceCalls.toLocaleString() : "..."}
                    subtitle={`Sarvam: ${stats?.voiceSarvamCalls ?? 0} | Twilio: ${stats?.voiceTwilioCalls ?? 0}`}
                    icon={<Phone className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                    onClick={() => router.push('/dashboard/campaigns/voice')}
                />
                <MetricCard
                    title="Voice Picked Up"
                    value={stats?.voicePickedUp !== undefined ? stats.voicePickedUp.toLocaleString() : "..."}
                    subtitle={`${stats?.voicePickupRate ?? 0}% Pickup | ${stats?.voicePositive ?? 0} Positive`}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/campaigns/voice/logs')}
                />
            </div>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Channel Reach</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Leads with activity on each outreach channel</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ChannelBox label="Email" value={stats?.emailSent ?? 0} total={stats?.totalLeads ?? 0} icon={Send} color="blue" />
                        <ChannelBox label="WhatsApp" value={stats?.whatsappActive ?? 0} total={stats?.totalLeads ?? 0} icon={MessageCircle} color="emerald" />
                        <ChannelBox label="Voice" value={stats?.voiceActive ?? 0} total={stats?.totalLeads ?? 0} icon={Mic} color="violet" />
                    </div>
                </CardContent>
            </Card>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Campaigns</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Performance breakdown by campaign</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(stats?.campaigns || []).map((c) => (
                        <CampaignCard
                            key={c.campaignId}
                            campaign={c}
                            onClick={() => router.push(`/dashboard/campaigns/leads?campaignId=${encodeURIComponent(String(c.campaignId))}`)}
                        />
                    ))}
                    {(stats?.campaigns || []).length === 0 && !loading && (
                        <p className="text-sm text-slate-400 py-10 text-center col-span-full">No campaigns found.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, subtitle, icon, iconBg, onClick }: {
    title: string; value: number | string; subtitle?: string;
    icon: React.ReactNode; iconBg: string; onClick?: () => void;
}) {
    return (
        <Card
            className={cn("border-border bg-white shadow-sm transition-all", onClick && "cursor-pointer hover:shadow-md")}
            onClick={onClick}
        >
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900">{value}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{title}</p>
                    {subtitle && <p className="text-[11px] text-slate-500 mt-1 truncate">{subtitle}</p>}
                </div>
                <div className={cn("p-2.5 rounded-xl shrink-0", iconBg)}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}

function ChannelBox({ label, value, total, icon: Icon, color }: {
    label: string; value: number; total: number; icon: any; color: 'blue' | 'emerald' | 'violet';
}) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const colorMap = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
    }[color];

    return (
        <div className="p-4 rounded-xl border border-border bg-slate-50/50">
            <div className="flex items-center justify-between mb-3">
                <div className={cn("p-2 rounded-lg", colorMap.bg, colorMap.text)}>
                    <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-500">{label}</span>
            </div>
            <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400">{pct.toFixed(1)}% of leads</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500", colorMap.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
        </div>
    );
}

function CampaignCard({ campaign, onClick }: { campaign: CampaignSummary; onClick: () => void }) {
    const replyRate = campaign.emailSent > 0 ? ((campaign.emailReplied / campaign.emailSent) * 100).toFixed(1) : "0.0";

    return (
        <Card
            className={cn("border shadow-sm cursor-pointer hover:shadow-md transition-all overflow-hidden", campaignColorClasses(campaign.color))}
            onClick={onClick}
        >
            <CardContent className="p-5 bg-white">
                <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                        <CampaignBadge campaignId={campaign.campaignId} campaignName={campaign.campaignName} className="mb-1.5" />
                        <p className="text-xl font-bold text-slate-900 truncate">{campaign.campaignName}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{campaign.totalLeads.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Leads</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{campaign.emailSent.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Sent</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{replyRate}%</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Reply Rate</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{campaign.contacted} Contacted</span>
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{campaign.newLeads} New</span>
                    {campaign.unsubscribed > 0 && <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">{campaign.unsubscribed} Unsub</span>}
                    {campaign.bounced > 0 && <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{campaign.bounced} Bounced</span>}
                </div>
            </CardContent>
        </Card>
    );
}
