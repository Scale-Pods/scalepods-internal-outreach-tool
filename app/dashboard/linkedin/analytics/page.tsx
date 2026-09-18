"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { cn } from "@/lib/utils";
import type { LinkedInQuota, LinkedInLead, LinkedInMessage } from "@/lib/services/linkedin-sheets";

export default function LinkedInAnalyticsPage() {
    const [quota, setQuota] = useState<LinkedInQuota[]>([]);
    const [leads, setLeads] = useState<LinkedInLead[]>([]);
    const [messages, setMessages] = useState<LinkedInMessage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [quotaRes, convRes] = await Promise.all([
                fetch("/api/linkedin/quota"),
                fetch("/api/linkedin/conversations"),
            ]);
            const quotaJson = await quotaRes.json();
            const convJson = await convRes.json();
            setQuota(quotaJson.data || []);
            setLeads(convJson.leads || []);
            setMessages(convJson.messages || []);
        } catch (e) {
            console.error("LinkedIn analytics fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const totalSent = quota.reduce((sum, q) => sum + q.sentCount, 0);
        const totalCap = quota.reduce((sum, q) => sum + q.dailyCap, 0);
        const totalRemaining = quota.reduce((sum, q) => sum + q.remainingQuota, 0);
        const connected = leads.filter(l => l.connectionStatus.toLowerCase().includes('connect')).length;
        const connectionRate = leads.length > 0 ? ((connected / leads.length) * 100).toFixed(1) + "%" : "0%";

        const statusCounts: Record<string, number> = {};
        leads.forEach(l => {
            const key = (l.connectionStatus || 'Unknown').trim() || 'Unknown';
            statusCounts[key] = (statusCounts[key] || 0) + 1;
        });

        return {
            totalSent, totalCap, totalRemaining, connected, connectionRate,
            totalMessages: messages.length,
            statusData: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
        };
    }, [quota, leads, messages]);

    const quotaTrend = useMemo(() => {
        const groups: Record<string, { date: string; sent: number; cap: number }> = {};
        quota.forEach(q => {
            if (!q.date) return;
            if (!groups[q.date]) groups[q.date] = { date: q.date, sent: 0, cap: 0 };
            groups[q.date].sent += q.sentCount;
            groups[q.date].cap += q.dailyCap;
        });
        return Object.values(groups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-14);
    }, [quota]);

    return (
        <div className="space-y-6 p-6 lg:p-8 bg-slate-50/30 min-h-screen">
            {loading && <SPLoader />}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LinkedIn Analytics</h1>
                    <p className="text-slate-500 text-sm">Quota usage, connections and messaging performance from Google Sheets</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="h-9 w-9 p-0 border-slate-200">
                    <RefreshCw className="h-4 w-4 text-slate-600" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <EnhancedAnalyticCard title="Outbound Pulses" value={stats.totalSent.toLocaleString()} label="Total Invites/Msgs Sent" icon={Send} color="text-blue-600" bg="bg-blue-50" />
                <EnhancedAnalyticCard title="Quota Remaining" value={stats.totalRemaining.toLocaleString()} label={`Of ${stats.totalCap.toLocaleString()} daily cap`} icon={Gauge} color="text-amber-600" bg="bg-amber-50" />
                <EnhancedAnalyticCard title="Connection Rate" value={stats.connectionRate} label={`${stats.connected} connected leads`} icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50" />
                <EnhancedAnalyticCard title="Total Messages" value={stats.totalMessages.toLocaleString()} label="Across all conversations" icon={MessageSquare} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-slate-200/60 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b border-slate-50">
                        <div>
                            <CardTitle className="text-sm font-bold text-slate-800">Quota Trend</CardTitle>
                            <CardDescription className="text-[11px]">Sent count vs. daily cap by date</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={quotaTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', padding: '8px 12px' }}
                                        itemStyle={{ padding: '2px 0' }}
                                    />
                                    <Area type="monotone" dataKey="cap" stroke="#f59e0b" strokeWidth={2.5} fill="url(#colorCap)" name="Daily Cap" animationDuration={1000} />
                                    <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorSent)" name="Sent" animationDuration={1000} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/60 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="px-6 py-4 border-b border-slate-50">
                        <CardTitle className="text-sm font-bold text-slate-800">Connection Status</CardTitle>
                        <CardDescription className="text-[11px]">Leads by connection status</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.statusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} dy={10} interval={0} angle={-20} textAnchor="end" height={50} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={35} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', padding: '8px 12px' }}
                                    />
                                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30}>
                                        {stats.statusData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#f97316', '#10b981', '#a855f7', '#0ea5e9'][index % 5]} />
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
