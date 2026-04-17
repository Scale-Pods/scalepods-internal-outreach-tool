"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Mail, Send, RefreshCw, BarChart2, Users,
    Reply, Sparkles,
    ArrowUpRight, TrendingUp, Percent,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import { format } from "date-fns";

interface CampaignMetrics {
    campaignId: string;
    campaignName: string;
    status: string;
    leadsCount: number;
    contactedCount: number;
    emailsSentCount: number;
    newLeadsContacted: number;
    uniqueOpens: number;
    uniqueReplies: number;
    uniqueClicks: number;
    bouncedCount: number;
    unsubscribedCount: number;
    completedCount: number;
    totalOpportunities: number;
    totalOpportunityValue: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    clickRate: number;
}

interface AggregatedMetrics {
    totalLeads: number;
    totalContacted: number;
    totalEmailsSent: number;
    totalUniqueOpens: number;
    totalUniqueReplies: number;
    totalUniqueClicks: number;
    totalBounced: number;
    totalUnsubscribed: number;
    totalCompleted: number;
    totalOpportunities: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    clickRate: number;
}

const EMPTY_METRICS: AggregatedMetrics = {
    totalLeads: 0, totalContacted: 0, totalEmailsSent: 0,
    totalUniqueOpens: 0, totalUniqueReplies: 0, totalUniqueClicks: 0,
    totalBounced: 0, totalUnsubscribed: 0, totalCompleted: 0,
    totalOpportunities: 0, openRate: 0, replyRate: 0, bounceRate: 0, clickRate: 0,
};

export default function EmailDashboardPage() {
    const router = useRouter();
    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>(undefined);
    const [loadingDB, setLoadingDB] = useState(true);
    const [campaigns, setCampaigns] = useState<CampaignMetrics[]>([]);
    const [recentReplies, setRecentReplies] = useState<any[]>([]);
    const [dbReplyCount, setDbReplyCount] = useState(0);
    const [localData, setLocalData] = useState({
        totalEmails: 0, emailCounts: [0, 0, 0, 0, 0, 0],
        leadsContacted: 0, repliedLeads: 0,
    });

    const loading = loadingLeads || loadingDB;

    // Fetch DB data
    useEffect(() => {
        const fetchData = async () => {
            setLoadingDB(true);
            try {
                const res = await fetch('/api/email/db-data');
                if (!res.ok) throw new Error('Failed to fetch');
                const json = await res.json();

                // Process campaign analytics — skip header row (idx=0)
                const rawCampaigns = json.campaignAnalytics || [];
                const dataRows = rawCampaigns.filter((r: any) =>
                    r.record_id !== 1 && r.campaign_id !== '000_HEADER'
                );

                const parsed: CampaignMetrics[] = dataRows.map((row: any) => {
                    const leadsCount = Number(row.leads_count) || 0;
                    const contacted = Number(row.contacted_count) || 0;
                    const sent = Number(row.emails_sent_count) || 0;
                    const uniqueOpens = Number(row.open_count_unique) || 0;
                    const uniqueReplies = Number(row.reply_count_unique) || 0;
                    const uniqueClicks = Number(row.link_click_count_unique) || 0;
                    const bounced = Number(row.bounced_count) || 0;

                    return {
                        campaignId: row.campaign_id || '',
                        campaignName: row.campaign_name || 'Unnamed Campaign',
                        status: row.campaign_status === '1' || row.campaign_status === 1 ? 'Active'
                            : row.campaign_status === '2' || row.campaign_status === 2 ? 'Paused'
                                : row.campaign_status === '3' || row.campaign_status === 3 ? 'Completed' : 'Unknown',
                        leadsCount,
                        contactedCount: contacted,
                        emailsSentCount: sent,
                        newLeadsContacted: Number(row.new_leads_contacted_count) || 0,
                        uniqueOpens,
                        uniqueReplies,
                        uniqueClicks,
                        bouncedCount: bounced,
                        unsubscribedCount: Number(row.unsubscribed_count) || 0,
                        completedCount: Number(row.completed_count) || 0,
                        totalOpportunities: Number(row.total_opportunities) || 0,
                        totalOpportunityValue: Number(row.total_opportunity_value) || 0,
                        openRate: contacted > 0 ? (uniqueOpens / contacted) * 100 : 0,
                        replyRate: contacted > 0 ? (uniqueReplies / contacted) * 100 : 0,
                        bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
                        clickRate: contacted > 0 ? (uniqueClicks / contacted) * 100 : 0,
                    };
                });

                setCampaigns(parsed);

                // Recent replies + count
                const allReplies = json.leadReplies || [];
                setRecentReplies(allReplies.slice(0, 4));
                setDbReplyCount(allReplies.length);
            } catch (e) {
                console.error('Dashboard fetch error:', e);
            } finally {
                setLoadingDB(false);
            }
        };

        fetchData();
    }, []);

    // Process local lead data for sequence breakdown
    useEffect(() => {
        if (loadingLeads) return;

        const filteredLeads = allLeads.filter((lead: any) => {
            if (!dateRange?.from) return true;
            const lc = lead.last_contacted || lead["Email Last Contacted"] || lead.created_at;
            if (!lc) return false;
            const d = new Date(lc);
            const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
            const to = dateRange.to ? new Date(dateRange.to) : new Date(from); to.setHours(23, 59, 59, 999);
            return d >= from && d <= to;
        });

        let total = 0;
        let contacted = 0;
        let replied = 0;
        const counts = [0, 0, 0, 0, 0, 0];
        filteredLeads.forEach((lead: any) => {
            let hasEmailStage = false;
            (lead.stages_passed || []).forEach((stage: string) => {
                if (!stage.toLowerCase().startsWith("email_")) return;
                hasEmailStage = true;
                const num = parseInt(stage.split("_")[1]);
                if (num >= 1 && num <= 6) { counts[num - 1]++; total++; }
            });
            if (hasEmailStage) contacted++;
            const rep = lead.replied || lead.email_replied || "No";
            if (String(rep).toLowerCase() === "yes") replied++;
        });

        setLocalData({ totalEmails: total, emailCounts: counts, leadsContacted: contacted, repliedLeads: replied });
    }, [allLeads, loadingLeads, dateRange]);

    // Aggregate metrics across all campaigns
    const metrics: AggregatedMetrics = useMemo(() => {
        if (campaigns.length === 0) return EMPTY_METRICS;

        const agg = campaigns.reduce((acc, c) => ({
            totalLeads: acc.totalLeads + c.leadsCount,
            totalContacted: acc.totalContacted + c.contactedCount,
            totalEmailsSent: acc.totalEmailsSent + c.emailsSentCount,
            totalUniqueOpens: acc.totalUniqueOpens + c.uniqueOpens,
            totalUniqueReplies: acc.totalUniqueReplies + c.uniqueReplies,
            totalUniqueClicks: acc.totalUniqueClicks + c.uniqueClicks,
            totalBounced: acc.totalBounced + c.bouncedCount,
            totalUnsubscribed: acc.totalUnsubscribed + c.unsubscribedCount,
            totalCompleted: acc.totalCompleted + c.completedCount,
            totalOpportunities: acc.totalOpportunities + c.totalOpportunities,
            openRate: 0, replyRate: 0, bounceRate: 0, clickRate: 0,
        }), { ...EMPTY_METRICS });

        agg.openRate = agg.totalContacted > 0 ? (agg.totalUniqueOpens / agg.totalContacted) * 100 : 0;
        agg.replyRate = agg.totalContacted > 0 ? (agg.totalUniqueReplies / agg.totalContacted) * 100 : 0;
        agg.bounceRate = agg.totalEmailsSent > 0 ? (agg.totalBounced / agg.totalEmailsSent) * 100 : 0;
        agg.clickRate = agg.totalContacted > 0 ? (agg.totalUniqueClicks / agg.totalContacted) * 100 : 0;

        return agg;
    }, [campaigns]);

    // For the funnel bar chart
    const funnelData = useMemo(() => [
        { name: 'Leads', value: metrics.totalLeads, fill: '#6366f1' },
        { name: 'Contacted', value: metrics.totalContacted, fill: '#3b82f6' },
        { name: 'Opened', value: metrics.totalUniqueOpens, fill: '#10b981' },
        { name: 'Clicked', value: metrics.totalUniqueClicks, fill: '#f59e0b' },
        { name: 'Replied', value: metrics.totalUniqueReplies, fill: '#8b5cf6' },
        { name: 'Opportunities', value: metrics.totalOpportunities, fill: '#ec4899' },
    ], [metrics]);

    const handleDateUpdate = (range: any) => {
        setDateRange(range.range);
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    // Use DB data if available, otherwise fallback to local icp_tracker data
    const hasCampaignData = campaigns.length > 0;

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Outreach Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Monitor your email campaign performance
                        {hasCampaignData && (
                            <span className="ml-2 text-emerald-600 font-medium">• {campaigns.length} campaign{campaigns.length > 1 ? 's' : ''} active</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-10"
                        onClick={handleRefresh}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* 4 Top Metric Cards — Real data from ICP Tracker + instantly_lead_replies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Leads"
                    value={metrics.totalLeads}
                    subtitle={campaigns.length > 0 ? `Campaign ID: ${campaigns.map(c => c.campaignId).filter(Boolean).join(', ')}` : "No Campaigns"}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Emails Sent"
                    value={localData.totalEmails}
                    subtitle={`Across ${localData.leadsContacted} leads`}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : dbReplyCount}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/email/received')}
                />
                <MetricCard
                    title="Reply Rate"
                    value={localData.leadsContacted > 0 ? `${((localData.repliedLeads / localData.leadsContacted) * 100).toFixed(1)}%` : "0%"}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                    onClick={() => router.push('/dashboard/email/received')}
                />
            </div>

            {/* Outreach Funnel + Sequence Breakdown side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Outreach Funnel */}
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Outreach Funnel</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Lead progression from contact to opportunity</p>
                            </div>
                            <TrendingUp className="h-4 w-4 text-slate-400" />
                        </div>
                        {hasCampaignData ? (
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={90} />
                                        <Tooltip
                                            contentStyle={{
                                                background: '#fff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                                            {funnelData.map((entry, idx) => (
                                                <Cell key={idx} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                                No campaign data yet — connect Instantly to see the funnel
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sequence Breakdown (from ICP Tracker) */}
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Sequence Breakdown</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Email stage distribution from ICP Tracker</p>
                            </div>
                            <BarChart2 className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5, 6].map((num) => {
                                const count = localData.emailCounts[num - 1];
                                const pct = localData.totalEmails > 0 ? (count / localData.totalEmails) * 100 : 0;
                                return (
                                    <div key={num} className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-slate-500 w-16">Email {num}</span>
                                        <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-500",
                                                    num <= 2 ? "bg-blue-500" : num <= 4 ? "bg-violet-500" : "bg-indigo-500"
                                                )}
                                                style={{ width: `${Math.max(pct, 0)}%` }}
                                            />
                                            {count > 0 && (
                                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                                                    {count} ({pct.toFixed(0)}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Campaign-Level Breakdown (if multiple campaigns) */}
            {campaigns.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">Campaign Performance</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {campaigns.map((c, idx) => (
                            <CampaignRow key={idx} campaign={c} />
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Replies */}
            {recentReplies.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">Recent Replies</h2>
                        <Button
                            variant="link"
                            className="text-indigo-600 gap-1 text-sm"
                            onClick={() => router.push('/dashboard/email/received')}
                        >
                            View All <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recentReplies.map((reply, idx) => {
                            const score = reply.ai_interest_score;
                            const scoreBg = score >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : score >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : score ? 'bg-red-50 text-red-600 border-red-200' : '';

                            return (
                                <Card key={idx} className="bg-white border-border shadow-sm hover:shadow-md transition-all cursor-pointer"
                                    onClick={() => router.push('/dashboard/email/received')}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                {(reply.lead_email_id || "L")[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold truncate text-slate-900">{reply.lead_email_id || "Lead"}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{reply.reply_subject || "Email Reply"}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={reply.clean_reply_text ? reply.clean_reply_text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() : "(No content)"}>
                                            {reply.clean_reply_text ? reply.clean_reply_text.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() : "(No content)"}
                                        </p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {score !== null && score !== undefined && (
                                                <Badge variant="outline" className={cn("text-[9px] font-bold", scoreBg)}>
                                                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                                                    {score}%
                                                </Badge>
                                            )}
                                            {reply.reply_timestamp && (
                                                <span className="text-[10px] text-slate-400">
                                                    {format(new Date(reply.reply_timestamp), "MMM dd, p")}
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Metric Card (Primary) ─── */
function MetricCard({ title, value, subtitle, icon, iconBg, highlight, onClick }: {
    title: string; value: number | string; subtitle?: string;
    icon: React.ReactNode; iconBg: string; highlight?: boolean; onClick?: () => void;
}) {
    return (
        <Card
            className={cn(
                "border-border bg-white shadow-sm transition-all",
                onClick && "cursor-pointer hover:shadow-md"
            )}
            onClick={onClick}
        >
            <CardContent className="p-5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{title}</p>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className={cn("p-3 rounded-xl shrink-0", iconBg)}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}



/* ─── Campaign Row ─── */
function CampaignRow({ campaign }: { campaign: CampaignMetrics }) {
    const statusConfig: Record<string, { bg: string; text: string }> = {
        Active: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
        Paused: { bg: 'bg-amber-50', text: 'text-amber-700' },
        Completed: { bg: 'bg-slate-100', text: 'text-slate-600' },
        Unknown: { bg: 'bg-slate-100', text: 'text-slate-500' },
    };
    const sc = statusConfig[campaign.status] || statusConfig.Unknown;

    return (
        <Card className="bg-white border-border shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Mail className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{campaign.campaignName}</h4>
                            <Badge variant="outline" className={cn("text-[9px] font-bold mt-1", sc.bg, sc.text)}>
                                {campaign.status}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-2 text-center">
                        <CampaignStat label="Leads" value={campaign.leadsCount} />
                        <CampaignStat label="Sent" value={campaign.emailsSentCount} />
                        <CampaignStat label="Opens" value={campaign.uniqueOpens} rate={`${campaign.openRate.toFixed(1)}%`} />
                        <CampaignStat label="Replies" value={campaign.uniqueReplies} rate={`${campaign.replyRate.toFixed(1)}%`} />
                        <CampaignStat label="Bounced" value={campaign.bouncedCount} rate={`${campaign.bounceRate.toFixed(1)}%`} alert={campaign.bounceRate > 5} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CampaignStat({ label, value, rate, alert }: { label: string; value: number; rate?: string; alert?: boolean }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-slate-900">{value}</span>
            <span className="text-[10px] font-medium text-slate-500">{label}</span>
            {rate && (
                <span className={cn("text-[10px] font-bold", alert ? "text-red-500" : "text-slate-400")}>{rate}</span>
            )}
        </div>
    );
}
