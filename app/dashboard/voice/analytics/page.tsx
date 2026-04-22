"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, DollarSign, CheckCircle, PhoneIncoming } from "lucide-react";
import { calculateDuration, formatDuration, cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { useData } from "@/context/DataContext";

export default function VoiceAnalyticsPage() {
    const { calls: globalCalls, loadingCalls, voiceBalance, leads, refreshCalls } = useData();
    const [statusFilter, setStatusFilter] = useState("all");
    const [providerFilter, setProviderFilter] = useState("vapi");
    const [calls, setCalls] = useState<any[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const loading = loadingLocal || loadingCalls;
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [durationData, setDurationData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalCalls: 0, avgDuration: 0, totalCost: 0, successRate: 0,
        typesData: [], vapiBalance: 0, inboundDuration: 0, outboundDuration: 0,
        pickUpRate: 0, completionRate: 0, positiveRate: 0, lifetimeVapiUsed: 0,
    });

    useEffect(() => {
        if (voiceBalance) {
            setStats(prev => ({ ...prev, vapiBalance: voiceBalance.vapi?.balance || 0 }));
        }
    }, [voiceBalance]);

    useEffect(() => {
        if (loadingCalls) return;

        const filteredCalls = globalCalls.filter((call: any) => {
            if (providerFilter !== "all" && call.source !== providerFilter) return false;
            if (!dateRange?.from) return true;
            const dateStr = call.startedAt || (call.start_time_unix_secs ? new Date(call.start_time_unix_secs * 1000).toISOString() : null);
            if (!dateStr) return false;
            const callDate = new Date(dateStr);
            const from = startOfDay(new Date(dateRange.from));
            const to = startOfDay(new Date(dateRange.to || dateRange.from));
            to.setHours(23, 59, 59, 999);
            return callDate >= from && callDate <= to;
        });

        setCalls(filteredCalls);
        processAnalytics(filteredCalls);
    }, [globalCalls, loadingCalls, dateRange, providerFilter]);

    const processAnalytics = (data: any[]) => {
        const totalCalls = data.length;
        let totalDuration = 0, totalCredits = 0, successCount = 0;
        const dayMap = new Map();
        const durationBuckets = { '0-30s': 0, '30s-1m': 0, '1-2m': 0, '2-5m': 0, '5m+': 0 };
        let inboundSum = 0, outboundSum = 0;

        let lifetimeVapiUsedSum = 0;
        globalCalls.forEach((call: any) => {
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;
            if (call.source === 'vapi') {
                lifetimeVapiUsedSum += (call.breakdown?.agent !== undefined) ? call.breakdown.agent : cost;
            }
        });

        data.forEach(call => {
            const dateStr = call.startedAt || null;
            const time = dateStr ? format(new Date(dateStr), 'MMM dd') : 'N/A';
            const dur = calculateDuration(call);

            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;

            if (['done', 'ended', 'completed', 'success', 'answered'].includes(call.status)) successCount++;
            totalDuration += dur;
            totalCredits += cost;

            const raw = call.raw || call;
            const directionProp = (raw.telephony?.direction || raw.direction || "").toLowerCase();
            const isInbound = call.isInbound === true || directionProp.includes('inbound') || directionProp.includes('incoming');
            if (isInbound) inboundSum += dur; else outboundSum += dur;

            const dayObj = dayMap.get(time) || { calls: 0, credits: 0 };
            dayMap.set(time, { calls: dayObj.calls + 1, credits: dayObj.credits + cost });

            if (dur < 30) durationBuckets['0-30s']++;
            else if (dur < 60) durationBuckets['30s-1m']++;
            else if (dur < 120) durationBuckets['1-2m']++;
            else if (dur < 300) durationBuckets['2-5m']++;
            else durationBuckets['5m+']++;
        });

        setStats(prev => ({
            ...prev,
            totalCalls, avgDuration: totalCalls > 0 ? totalDuration / totalCalls : 0,
            totalCost: totalCredits,
            successRate: totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0,
            inboundDuration: inboundSum, outboundDuration: outboundSum,
            lifetimeVapiUsed: lifetimeVapiUsedSum,
            pickUpRate: totalCalls > 0 ? (data.filter((c: any) => calculateDuration(c) > 18).length / totalCalls) * 100 : 0,
            completionRate: totalCalls > 0 ? (data.filter((c: any) => {
                const reason = c.endedReason || c.raw?.endedReason;
                return reason === 'customer-ended-call' || reason === 'assistant-ended-call';
            }).length / totalCalls) * 100 : 0,
            positiveRate: (() => {
                if (totalCalls === 0 || !leads || leads.length === 0) return 0;
                const positiveCount = leads.filter((l: any) =>
                    l.voice_sentiment === 'Expression of Interest' ||
                    l.voice_sentiment === 'Callback- Plan Postponed' ||
                    l.voice2_sentiment === 'Expression of Interest' ||
                    l.voice2_sentiment === 'Callback- Plan Postponed'
                ).length;
                return (positiveCount / totalCalls) * 100;
            })()
        }));

        const sortedDays = Array.from(dayMap.entries()).sort((a, b) => {
            return new Date(`${a[0]} ${new Date().getFullYear()}`).getTime() - new Date(`${b[0]} ${new Date().getFullYear()}`).getTime();
        });

        setVolumeData(sortedDays.map(([name, obj]) => ({ name, value: obj.calls })));
        setDurationData(Object.entries(durationBuckets).map(([name, value]) => ({ name, value })));
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white p-6 space-y-6">
            {loading && <SPLoader />}
            {/* Header section with refined spacing */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Comprehensive insights into voice agent performance</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-white text-sm font-medium text-slate-700 shadow-sm">
                        <Phone className="h-4 w-4 text-blue-600" />
                        <span>Vapi AI</span>
                    </div>
                    <DateRangePicker onUpdate={(values) => {
                        setDateRange(values.range);
                        if (values.range?.from) {
                            const from = new Date(values.range.from);
                            from.setHours(0, 0, 0, 0);
                            const to = new Date(values.range.to || values.range.from);
                            to.setHours(23, 59, 59, 999);
                            refreshCalls(from, to);
                        }
                    }} />
                </div>
            </div>

            {/* Key Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Calls" value={stats.totalCalls} change="Historical" icon={<Phone className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
                <StatCard title="Total Call Duration" value={formatDuration(stats.inboundDuration + stats.outboundDuration)} change="All Inbound + Outbound" icon={<Clock className="h-5 w-5" />} color="text-slate-600" bg="bg-slate-50" />
                <StatCard title="Avg Duration" value={`${Math.round(stats.avgDuration)}s`} change="All Time" icon={<Clock className="h-5 w-5" />} color="text-purple-600" bg="bg-purple-50" />
                <StatCard
                    title="Vapi Credits Used"
                    value={`$${(stats as any).lifetimeVapiUsed?.toFixed(2) || '0.00'}`}
                    change="All Time Count"
                    icon={<DollarSign className="h-5 w-5" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
            </div>

            {/* Performance Conversion Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Call Pick-up Rate" 
                    value={`${stats.pickUpRate.toFixed(1)}%`} 
                    change="Duration > 18s" 
                    icon={<PhoneIncoming className="h-5 w-5" />} 
                    color="text-emerald-600" 
                    bg="bg-emerald-50" 
                />
                <StatCard 
                    title="Call Completion Rate" 
                    value={`${stats.completionRate.toFixed(1)}%`} 
                    change="Ended by User/AI" 
                    icon={<CheckCircle className="h-5 w-5" />} 
                    color="text-cyan-600" 
                    bg="bg-cyan-50" 
                />
                <StatCard 
                    title="Positive Response Rate" 
                    value={`${stats.positiveRate.toFixed(1)}%`} 
                    change="Interested Leads( EOI & Callback )" 
                    icon={<DollarSign className="h-5 w-5" />} 
                    color="text-amber-600" 
                    bg="bg-amber-50" 
                />
            </div>

            {/* Charts Section - Fixed to fit screen */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
                {/* Call Volume Trends */}
                <Card className="border-border flex flex-col overflow-hidden">
                    <CardHeader className="py-2 shrink-0">
                        <CardTitle className="text-base">Call Volume Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-4 pt-0">
                        <div className="w-full h-full min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={volumeData.length ? volumeData : [{ name: 'No data', value: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Call Duration Distribution */}
                <Card className="border-border flex flex-col overflow-hidden">
                    <CardHeader className="py-2 shrink-0">
                        <CardTitle className="text-base">Duration Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-4 pt-0">
                        <div className="w-full h-full min-h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={durationData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, change, isNegative, icon, color, bg }: any) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-950 mt-1">{value}</h3>
                        <span className={`text-xs font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {change} {isNegative ? '↓' : '↑'}
                        </span>
                    </div>
                    <div className={cn("p-3 rounded-xl transition-colors shrink-0", bg, color)}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
