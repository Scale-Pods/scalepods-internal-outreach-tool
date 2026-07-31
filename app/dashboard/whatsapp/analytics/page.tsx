"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { NormalizedWaLead } from "@/lib/services/whatsapp-outreach";
import { getWaLastContacted, countSentMessages, hasReplied } from "@/lib/services/whatsapp-outreach";

export default function WhatsappAnalyticsPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedWaLead[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedWaLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 7), to: new Date()
    });

    const hasActiveFilters = !!dateRange.from;

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/whatsapp/outreach`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
        } catch (e) {
            console.error("WhatsApp analytics fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const combinedLeads = useMemo(() => [...coldLeads, ...hotLeads], [coldLeads, hotLeads]);

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            if (!dateRange.from) return true;
            const wlc = getWaLastContacted(lead);
            if (!wlc) return false;
            const contactDate = new Date(wlc);
            return contactDate >= startOfDay(new Date(dateRange.from)) && contactDate <= endOfDay(new Date(dateRange.to || dateRange.from));
        });
    }, [combinedLeads, dateRange]);

    const stats = useMemo(() => {
        let totalSent = 0, repliedCount = 0, leadsContacted = 0;
        const campaigns: Record<string, { value: number }> = { "Hot Leads": { value: 0 }, "Cold Leads": { value: 0 } };

        filteredLeads.forEach(lead => {
            const sentCount = countSentMessages(lead);
            totalSent += sentCount;
            if (sentCount > 0) leadsContacted++;
            if (hasReplied(lead)) {
                repliedCount++;
                if (lead.leadType === 'hot') campaigns["Hot Leads"].value++;
                else campaigns["Cold Leads"].value++;
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
            const wlc = getWaLastContacted(lead);
            if (!wlc) return;
            const d = new Date(wlc);
            if (isNaN(d.getTime())) return;
            const dStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
            if (!groups[dStr]) groups[dStr] = { date: dStr, sent: 0, replied: 0 };
            groups[dStr].sent += countSentMessages(lead);
            if (hasReplied(lead)) groups[dStr].replied++;
        });
        return Object.values(groups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10);
    }, [filteredLeads]);

    const resetFilters = () => {
        setDateRange({ from: undefined, to: undefined });
    };

    return (
        <div className="space-y-6 p-6 lg:p-8 bg-slate-50/30 min-h-screen">
            {loading && <SPLoader />}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Analytics</h1>
                    <p className="text-slate-500 text-sm">Cold (ENRICHED_LEADS) & Hot (hubspot_lead) engagement performance</p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 border border-rose-100">
                            <X className="h-3.5 w-3.5" /> Reset
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchData} className="h-9 w-9 p-0 border-slate-200">
                        <RefreshCw className="h-4 w-4 text-slate-600" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EnhancedAnalyticCard title="Outbound Pulses" value={stats.totalSent.toLocaleString()} label="Total Messages" icon={Send} color="text-blue-600" bg="bg-blue-50" />
                <EnhancedAnalyticCard title="Direct Responses" value={stats.repliedCount.toLocaleString()} label="Total Replies" icon={MessageSquare} color="text-emerald-600" bg="bg-emerald-50" />
                <EnhancedAnalyticCard title="Efficiency Score" value={stats.replyRate} label="Response Rate" icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50" />
                <EnhancedAnalyticCard title="Audience Reach" value={stats.totalLeads.toLocaleString()} label="Unique Leads" icon={Users} color="text-slate-600" bg="bg-slate-100" />
            </div>

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
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#f97316'][index % 2]} />
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
