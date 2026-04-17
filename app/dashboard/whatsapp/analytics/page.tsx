"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

// Helper: check if lead has replied — matches chat page logic
const hasLeadReplied = (lead: any) => {
    for (let i = 1; i <= 25; i++) {
        const r = lead[`User_Replied_${i}`];
        if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') return true;
    }
    if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") return true;
    const wtsTrack = lead["WTS_Reply_Track"];
    if (wtsTrack && String(wtsTrack).trim() !== "" && String(wtsTrack).toLowerCase() !== "no" && String(wtsTrack).toLowerCase() !== "none" && String(wtsTrack).toLowerCase() !== "false") return true;
    for (let i = 1; i <= 10; i++) {
        const r = lead[`W.P_Replied_${i}`];
        if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") return true;
    }
    return false;
};

// Helper: count sent messages — matches chat page logic
const countSentMessages = (lead: any) => {
    let count = 0;
    for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) count++; }
    for (let i = 1; i <= 25; i++) { if (lead[`Bot_Replied_${i}`] && String(lead[`Bot_Replied_${i}`]).trim()) count++; }
    if (count === 0) {
        for (let i = 1; i <= 12; i++) { if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) count++; }
    }
    return count;
};

// Helper: check if lead has WhatsApp activity
const hasWhatsappActivity = (lead: any) => {
    for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`]) return true; }
    for (let i = 1; i <= 25; i++) {
        if (lead[`User_Replied_${i}`] && String(lead[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
        if (lead[`Bot_Replied_${i}`]) return true;
    }
    if (lead.stages_passed?.some?.((s: string) => s.toLowerCase().includes("whatsapp"))) return true;
    for (let i = 1; i <= 12; i++) {
        if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) return true;
    }
    return false;
};

export default function WhatsappAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined, to: undefined
    });

    const loading = loadingLeads;
    const hasActiveFilters = !!dateRange.from;

    const combinedLeads = useMemo(() => {
        return allLeads
            .filter((l: any) => hasWhatsappActivity(l))
            .map((l: any) => ({ ...l, _source: l._table === 'meta_lead_tracker' ? 'meta' : 'icp' }));
    }, [allLeads]);

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            if (!dateRange.from) return true;
            const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
            if (!wlc) return false;
            const contactDate = new Date(wlc);
            return contactDate >= startOfDay(new Date(dateRange.from)) && contactDate <= endOfDay(new Date(dateRange.to || dateRange.from));
        });
    }, [combinedLeads, dateRange]);

    const stats = useMemo(() => {
        let totalSent = 0, repliedCount = 0, leadsContacted = 0;
        const campaigns: Record<string, { value: number }> = { "ICP Tracker": { value: 0 }, "Meta Lead": { value: 0 } };

        filteredLeads.forEach(lead => {
            const sentCount = countSentMessages(lead);
            totalSent += sentCount;
            if (sentCount > 0) leadsContacted++;
            if (hasLeadReplied(lead)) {
                repliedCount++;
                campaigns[lead._source === 'icp' ? "ICP Tracker" : "Meta Lead"].value++;
            }
        });

        return {
            totalSent, repliedCount, totalLeads: leadsContacted,
            replyRate: leadsContacted > 0 ? ((repliedCount / leadsContacted) * 100).toFixed(1) + "%" : "0%",
            campaignData: Object.entries(campaigns).map(([name, data]) => ({ name, value: data.value }))
        };
    }, [filteredLeads]);

    const trendData = useMemo(() => {
        const groups: Record<string, { date: string, sent: number, replied: number }> = {};
        filteredLeads.forEach(lead => {
            const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
            if (!wlc) return;
            const d = new Date(wlc);
            if (isNaN(d.getTime())) return;
            const dStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            if (!groups[dStr]) groups[dStr] = { date: dStr, sent: 0, replied: 0 };
            groups[dStr].sent += countSentMessages(lead);
            if (hasLeadReplied(lead)) groups[dStr].replied++;
        });
        return Object.values(groups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10);
    }, [filteredLeads]);

    const resetFilters = () => {
        setDateRange({ from: undefined, to: undefined });
    };

    return (
        <div className="space-y-6 p-6 lg:p-8 bg-slate-50/30 min-h-screen">
            {loading && <SPLoader />}

            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Analytics</h1>
                    <p className="text-slate-500 text-sm">Campaign performance & lead engagement</p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 border border-rose-100">
                            <X className="h-3.5 w-3.5" /> Reset
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-9 w-9 p-0 border-slate-200">
                        <RefreshCw className="h-4 w-4 text-slate-600" />
                    </Button>
                </div>
            </div>

            {/* Metric Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EnhancedAnalyticCard title="Outbound Pulses" value={stats.totalSent.toLocaleString()} label="Total Messages" icon={Send} color="text-blue-600" bg="bg-blue-50" />
                <EnhancedAnalyticCard title="Direct Responses" value={stats.repliedCount.toLocaleString()} label="Total Replies" icon={MessageSquare} color="text-emerald-600" bg="bg-emerald-50" />
                <EnhancedAnalyticCard title="Efficiency Score" value={stats.replyRate} label="Response Rate" icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50" />
                <EnhancedAnalyticCard title="Audience Reach" value={stats.totalLeads.toLocaleString()} label="Unique Leads" icon={Users} color="text-slate-600" bg="bg-slate-100" />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200/60 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b border-slate-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-sm font-bold text-slate-800">Engagement Trends</CardTitle>
                                <CardDescription className="text-[11px]">Messages sent vs. replies received</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', padding: '8px 12px' }}
                                        itemStyle={{ padding: '2px 0' }}
                                    />
                                    <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorSent)" name="Sent" animationDuration={1000} />
                                    <Area type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2.5} fill="url(#colorReplied)" name="Replied" animationDuration={1000} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/60 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b border-slate-50">
                        <CardTitle className="text-sm font-bold text-slate-800">Channel Distribution</CardTitle>
                        <CardDescription className="text-[11px]">Replies by lead source</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.campaignData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', padding: '8px 12px' }}
                                    />
                                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40}>
                                        {stats.campaignData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6'][index % 2]} />
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

function EnhancedAnalyticCard({ title, value, label, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-slate-200/60 shadow-sm bg-white hover:border-blue-200 transition-all duration-200 group">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                        <p className="text-xs font-medium text-slate-400">{label}</p>
                    </div>
                    <div className={cn("p-3 rounded-xl transition-colors group-hover:scale-110 duration-200", bg, color)}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
