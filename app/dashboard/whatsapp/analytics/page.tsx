"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    Cell
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, BarChart3 } from "lucide-react";
import { ConsolidatedLead } from "@/lib/leads-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";

export default function WhatsappAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const loading = loadingLeads;
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    useEffect(() => {
        if (!loadingLeads) {
            setLeads(allLeads);
        }
    }, [allLeads, loadingLeads]);

    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            // First, identify if it's a WhatsApp lead
            let hasWP = l.stages_passed.some((s: string) => s.toLowerCase().includes("whatsapp")) ||
                (l.whatsapp_replied && l.whatsapp_replied !== "No" && l.whatsapp_replied !== "none") ||
                [1, 2, 3, 4, 5, 6].some(i => l[`W.P_${i}`] || l.stage_data?.[`WhatsApp ${i}`]) ||
                l["W.P_FollowUp"] || l.stage_data?.["WhatsApp FollowUp"];

            if (!hasWP) {
                // Check extended history
                for (let i = 1; i <= 10; i++) {
                    if (l[`W.P_Replied_${i}`] || l[`W.P_FollowUp_${i}`]) {
                        hasWP = true;
                        break;
                    }
                }
            }

            if (!hasWP) return false;

            // If date range is active, respect it
            if (dateRange.from || dateRange.to) {
                // Should fallback to created_at if last_contacted is missing? 
                // Analytics usually relies on accurate timestamps, but let's stick to last_contacted for now to match strict logic or fallback if needed?
                // The original code returned false if !l.last_contacted. Let's keep it safe but maybe expanded leads don't have last_contacted set?
                // Ideally, we should check created_at or updated_at if last_contacted is missing, similar to Dashboard. 
                const dateRef = l.last_contacted || l.updated_at || l.created_at;
                if (!dateRef) return false;

                const contactDate = new Date(dateRef);
                if (dateRange.from && contactDate < dateRange.from) return false;
                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    toDate.setHours(23, 59, 59, 999);
                    if (contactDate > toDate) return false;
                }
            }
            return true;
        });
    }, [leads, dateRange]);

    const stats = useMemo(() => {
        let totalSent = 0;
        let repliedCount = 0;
        const loops: Record<string, { value: number }> = {
            "Intro": { value: 0 },
            "Follow Up": { value: 0 },
            "Nurture": { value: 0 }
        };

        filteredLeads.forEach(l => {
            const lead = l as any;
            const loopName = lead.source_loop?.toLowerCase().includes("follow up") ? "Follow Up" :
                lead.source_loop?.toLowerCase().includes("nurture") ? "Nurture" : "Intro";

            // Count total outgoing messages from this lead
            let leadSentCount = 0;
            for (let i = 1; i <= 6; i++) {
                if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) leadSentCount++;
            }
            if (lead["W.P_FollowUp"] || lead.stage_data?.["WhatsApp FollowUp"]) leadSentCount++;

            // Extended FollowUps
            for (let i = 1; i <= 10; i++) {
                if (lead[`W.P_FollowUp_${i}`]) leadSentCount++;
            }

            totalSent += leadSentCount;

            // Count replies based on rules
            let hasReplied = false;
            if (lead.whatsapp_replied &&
                lead.whatsapp_replied !== "No" &&
                lead.whatsapp_replied !== "none" &&
                String(lead.whatsapp_replied).trim() !== "") {
                hasReplied = true;
            } else {
                for (let i = 1; i <= 10; i++) {
                    const r = lead[`W.P_Replied_${i}`];
                    if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                        hasReplied = true;
                        break;
                    }
                }
            }

            if (hasReplied) {
                repliedCount++;
                if (loops[loopName]) loops[loopName].value++;
            }
        });

        const replyRate = filteredLeads.length > 0 ? (repliedCount / filteredLeads.length) * 100 : 0;

        return {
            totalSent,
            repliedCount,
            totalLeads: filteredLeads.length,
            replyRate: replyRate.toFixed(1) + "%",
            loopData: Object.entries(loops).map(([name, data]) => ({ name, value: data.value }))
        };
    }, [filteredLeads]);

    const trendData = useMemo(() => {
        const groups: Record<string, { date: string, sent: number, replied: number }> = {};
        filteredLeads.forEach(l => {
            const lead = l as any;
            const dateRef = lead.last_contacted || lead.updated_at || lead.created_at;
            if (!dateRef) return;

            const d = new Date(dateRef).toLocaleDateString([], { month: 'short', day: 'numeric' });
            if (!groups[d]) groups[d] = { date: d, sent: 0, replied: 0 };

            let leadSent = 0;
            for (let i = 1; i <= 6; i++) {
                if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) leadSent++;
            }
            if (lead["W.P_FollowUp"] || lead.stage_data?.["WhatsApp FollowUp"]) leadSent++;

            // Extended FollowUps
            for (let i = 1; i <= 10; i++) {
                if (lead[`W.P_FollowUp_${i}`]) leadSent++;
            }

            groups[d].sent += leadSent;

            let hasReplied = false;
            if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
                hasReplied = true;
            } else {
                for (let i = 1; i <= 10; i++) {
                    const r = lead[`W.P_Replied_${i}`];
                    if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                        hasReplied = true;
                        break;
                    }
                }
            }

            if (hasReplied) {
                groups[d].replied += 1;
            }
        });
        return Object.values(groups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);
    }, [filteredLeads]);

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            {/* Header section with refined spacing */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Track campaign performance and lead engagement</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-10 px-4">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Core Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Messages Sent"
                    value={stats.totalSent.toLocaleString()}
                    icon={Send}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard
                    title="Total Replies"
                    value={stats.repliedCount.toLocaleString()}
                    icon={MessageSquare}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                />
                <StatCard
                    title="Response Rate"
                    value={stats.replyRate}
                    icon={TrendingUp}
                    color="text-purple-600"
                    bg="bg-purple-50"
                />
                <StatCard
                    title="Unique Contacted Leads"
                    value={stats.totalLeads.toLocaleString()}
                    icon={Users}
                    color="text-slate-600"
                    bg="bg-slate-50"
                />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-900">Engagement Trend</CardTitle>
                        <CardDescription className="text-xs">Outbound messages vs Incoming replies</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fill="url(#colorSent)" />
                                    <Area type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2} fill="url(#colorReplied)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-900">Loop Breakdown</CardTitle>
                        <CardDescription className="text-xs">Replies distribution by campaign</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.loopData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30}>
                                        {stats.loopData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#8b5cf6'][index % 3]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${bg} ${color}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                    <h3 className="text-xl font-bold text-slate-900">{value}</h3>
                </div>
            </CardContent>
        </Card>
    );
}
