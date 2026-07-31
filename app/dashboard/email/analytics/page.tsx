"use client";

import { SPLoader } from "@/components/sp-loader";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Send,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    ShieldCheck,
    AlertCircle,
    Activity,
    Users,
    Info
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import type { OutreachMetrics } from "@/lib/services/email-outreach";

interface HistoryData {
    date: string;
    sent: number;
    inbox: number;
    spam: number;
}

const EMPTY_METRICS: OutreachMetrics = {
    totalLeads: 0, contactedLeads: 0, emailsSent: 0, stageSentCounts: [0, 0, 0, 0, 0, 0],
    repliedLeads: 0, totalReplies: 0, bouncedLeads: 0, unsubscribedLeads: 0, replyRate: 0,
};

function sumMetrics(a: OutreachMetrics, b: OutreachMetrics): OutreachMetrics {
    const totalLeads = a.totalLeads + b.totalLeads;
    const contactedLeads = a.contactedLeads + b.contactedLeads;
    const repliedLeads = a.repliedLeads + b.repliedLeads;
    return {
        totalLeads,
        contactedLeads,
        emailsSent: a.emailsSent + b.emailsSent,
        stageSentCounts: a.stageSentCounts.map((v, i) => v + b.stageSentCounts[i]),
        repliedLeads,
        totalReplies: a.totalReplies + b.totalReplies,
        bouncedLeads: a.bouncedLeads + b.bouncedLeads,
        unsubscribedLeads: a.unsubscribedLeads + b.unsubscribedLeads,
        replyRate: contactedLeads > 0 ? (repliedLeads / contactedLeads) * 100 : 0,
    };
}

export default function EmailAnalyticsPage() {
    const [loadingLocal, setLoadingLocal] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [outreachMetrics, setOutreachMetrics] = useState<OutreachMetrics>(EMPTY_METRICS);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [dbCampaigns, setDbCampaigns] = useState<any[]>([]);

    const loading = loadingLocal;

    const fetchData = async (start?: Date, end?: Date) => {
        setLoadingLocal(true);
        setError(null);
        try {
            const startDate = start ? start.toISOString().split('T')[0] : '';
            const endDate = end ? end.toISOString().split('T')[0] : '';

            // Fetch DB Analytics with date range — sourced from instantly_campaign_analytics
            const dbParams = new URLSearchParams();
            if (startDate) dbParams.append('from', start ? start.toISOString() : '');
            if (endDate) dbParams.append('to', end ? end.toISOString() : '');
            const dbRes = await fetch(`/api/email/db-data?${dbParams.toString()}`);
            if (dbRes.ok) {
                const dbJson = await dbRes.json();
                setDbCampaigns(dbJson.campaignAnalytics || []);
            }

            // Campaign Performance row — sourced from ENRICHED_LEADS + master_cold_leads + hubspot_lead
            const outreachParams = new URLSearchParams();
            if (start) outreachParams.append('from', start.toISOString());
            if (end) outreachParams.append('to', end.toISOString());
            const outreachRes = await fetch(`/api/email/outreach?${outreachParams.toString()}`);
            if (outreachRes.ok) {
                const outreachJson = await outreachRes.json();
                const cold: OutreachMetrics = outreachJson.cold?.metrics || EMPTY_METRICS;
                const hot: OutreachMetrics = outreachJson.hot?.metrics || EMPTY_METRICS;
                setOutreachMetrics(sumMetrics(cold, hot));
            } else {
                console.error("Outreach metrics fetch failed");
            }

        } catch (e: any) {
            console.error("Analytics fetch error", e);
            setError(e.message);
        } finally {
            setLoadingLocal(false);
        }
    };

    const handleDateUpdate = React.useCallback(({ range }: { range: DateRange | undefined }) => {
        setDateRange(range);
        if (range?.from) {
            const start = new Date(range.from);
            start.setHours(0, 0, 0, 0);
            const end = new Date(range.to || range.from);
            end.setHours(23, 59, 59, 999);

            fetchData(start, end);
        }
    }, []);

    useEffect(() => {
        handleDateUpdate({ range: dateRange });
    }, []);

    const totalSent = outreachMetrics.emailsSent;
    const totalReplies = outreachMetrics.repliedLeads;
    const totalUnsubscribed = outreachMetrics.unsubscribedLeads;
    const totalLeads = outreachMetrics.totalLeads;
    const replyRate = outreachMetrics.replyRate.toFixed(2);

    // Calculate total leads from Campaign DB
    const totalCampaignLeads = dbCampaigns.slice(1).reduce((acc: number, campaign: any) => {
        // Try common field names for leads in Instantly
        const count = Number(campaign.leads_count) || Number(campaign.leads) || Number(campaign.total_leads) || Number(campaign.leads_contacted) || Number(campaign.contacted) || 0;
        return acc + count;
    }, 0);

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Analytics</h1>
                    <p className="text-sm text-slate-500 mt-1">Comprehensive campaign and warm-up performance</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                    <Button
                        onClick={() => fetchData(dateRange?.from, dateRange?.to)}
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 hover:bg-slate-50 transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Database Campaigns Section */}
            {dbCampaigns.length > 1 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Instantly Campaign Analytics</h2>
                    <div className="flex flex-col gap-6 w-full">
                        {dbCampaigns.slice(1).map((campaign, idx) => {
                            const name = campaign.campaign_name || `Campaign #${idx + 1}`;
                            
                            return (
                                <Card key={idx} className="bg-white border-border shadow-sm flex flex-col hover:shadow-md transition-shadow w-full">
                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-xl">
                                        <h3 className="font-bold text-slate-900 truncate text-sm" title={name}>{name}</h3>
                                        <Badge variant="outline" className="text-[10px] bg-white">Campaign</Badge>
                                    </div>
                                    <CardContent className="p-4 flex-1 bg-white">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                                            {Object.entries(campaign)
                                                .filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'campaign_name' && k !== 'campaign_id' && k !== 'workspace_id' && k !== 'account_id')
                                                .map(([key, val]: any) => (
                                                <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-slate-50/70 relative group hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-start justify-between gap-1">
                                                        <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider leading-snug">
                                                            {key.replace(/_/g, ' ')}
                                                        </span>
                                                        {dbCampaigns[0][key] && (
                                                            <div className="flex-shrink-0 mt-0.5">
                                                                <Info className="h-3 w-3 text-slate-400 cursor-help" />
                                                                <div className="absolute hidden group-hover:block z-50 w-48 p-2 mt-2 -right-2 bg-slate-900 text-white text-[10px] normal-case rounded shadow-xl border border-slate-700 font-medium pointer-events-none">
                                                                    {dbCampaigns[0][key]}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-base font-black text-slate-800 truncate" title={String(val)}>
                                                        {typeof val === 'boolean' || val === 'true' || val === 'false' ? (String(val) === 'true' ? 'Yes' : 'No') : (typeof val === 'number' ? val.toLocaleString() : (val || '---'))}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Campaign Performance Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-900">Campaign Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                    <MetricCard
                        label="Total Sent"
                        value={totalSent.toLocaleString()}
                        icon={Send}
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                    />

                    <MetricCard
                        label="Replies"
                        value={totalReplies.toLocaleString()}
                        subtext={`${replyRate}% Rate`}
                        icon={TrendingUp}
                        iconBg="bg-slate-50"
                        iconColor="text-slate-600"
                    />
                    <MetricCard
                        label="Unsubscribed"
                        value={totalUnsubscribed.toLocaleString()}
                        icon={AlertTriangle}
                        iconBg="bg-orange-50"
                        iconColor="text-orange-600"
                    />
                    <MetricCard
                        label="Total Leads"
                        value={totalLeads.toLocaleString()}
                        subtext="Date Filtered"
                        icon={Users}
                        iconBg="bg-slate-50"
                        iconColor="text-slate-600"
                    />
                </div>
            </div>



            {loading && (
                <SPLoader fullScreen={false} />
            )}
        </div>
    );
}



function MetricCard({ label, value, subtext, icon: Icon, color, iconBg, iconColor }: any) {
    return (
        <Card className="bg-white border-border shadow-sm">
            <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                    <div className={cn("p-1.5 rounded-lg", iconBg, iconColor)}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                    {subtext && <p className="text-xs font-medium text-slate-500 mt-1">{subtext}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
