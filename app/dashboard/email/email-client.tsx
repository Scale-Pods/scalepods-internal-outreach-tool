"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Mail, Send, RefreshCw, BarChart2, Users,
    Reply, Sparkles,
    ArrowUpRight, TrendingUp, Percent, Info,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import { format } from "date-fns";
import type { CampaignMetrics, AggregatedMetrics } from "@/lib/services/email";

export default function EmailDashboardClient({
    campaigns,
    metrics,
    recentReplies,
    dbReplyCount,
    localData
}: {
    campaigns: CampaignMetrics[];
    metrics: AggregatedMetrics;
    recentReplies: any[];
    dbReplyCount: number;
    localData: any;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setLoading(true);
            const from = new Date(range.range.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(range.range.to || range.range.from);
            to.setHours(23, 59, 59, 999);

            const params = new URLSearchParams(searchParams.toString());
            params.set('from', from.toISOString());
            params.set('to', to.toISOString());
            router.push(`?${params.toString()}`);
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        router.refresh();
        setTimeout(() => setLoading(false), 500);
    };

    const hasCampaignData = campaigns.length > 0;

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Outreach Center</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-slate-500">
                            Monitor your email campaign performance
                            {hasCampaignData && (
                                <span className="ml-2 text-emerald-600 font-medium">• {campaigns.length} campaign{campaigns.length > 1 ? 's' : ''} active</span>
                            )}
                        </p>
                        {hasCampaignData && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                                            <Info className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-800">
                                        <p className="text-xs font-bold mb-1 uppercase tracking-wider opacity-70">Active Campaign IDs</p>
                                        <div className="flex flex-col gap-1">
                                            {campaigns.map((c, i) => (
                                                <span key={i} className="font-mono text-[10px]">{c.campaignId || 'N/A'} - {c.campaignName}</span>
                                            ))}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
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

            {/* 4 Top Metric Cards — all from date-filtered localData (ICP tracker) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Contacted Leads"
                    value={localData.leadsContacted}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Emails Sent"
                    value={localData.totalEmails}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Replies"
                    value={localData.repliedLeads}
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
                {/* Delivery Status Card */}
                <Card className="bg-white border-border shadow-sm flex flex-col overflow-hidden">
                    <CardContent className="p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Delivery Status</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Outbound health & engagement metrics</p>
                            </div>
                            <div className="p-1.5 bg-slate-50 rounded-lg"><TrendingUp className="h-4 w-4 text-slate-400" /></div>
                        </div>

                        <div className="space-y-4 flex-1 flex flex-col justify-center">
                            <StatusBar 
                                label="Sent" 
                                value={metrics.totalEmailsSent} 
                                total={metrics.totalEmailsSent} 
                                color="bg-blue-400" 
                            />
                            <StatusBar 
                                label="Delivered" 
                                value={metrics.totalEmailsSent - metrics.totalBounced} 
                                total={metrics.totalEmailsSent} 
                                color="bg-indigo-500" 
                            />
                            <StatusBar 
                                label="Failed" 
                                value={metrics.totalBounced} 
                                total={metrics.totalEmailsSent} 
                                color="bg-rose-500" 
                            />
                            <StatusBar 
                                label="Replied" 
                                value={dbReplyCount} 
                                total={metrics.totalEmailsSent} 
                                color="bg-emerald-500" 
                            />
                        </div>

                        {metrics.totalBounced === 0 && metrics.totalEmailsSent > 0 && (
                            <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                                <TrendingUp className="h-3 w-3" />
                                <span>PERFECT DELIVERY RATE</span>
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

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-900">{value}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-1000", color)} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
