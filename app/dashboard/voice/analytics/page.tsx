"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, DollarSign, CheckCircle, PhoneIncoming, TrendingUp } from "lucide-react";
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
    const { calls: globalCalls, loadingCalls, voiceBalance, refreshCalls } = useData();
    const [statusFilter, setStatusFilter] = useState("all");
    const [providerFilter, setProviderFilter] = useState("all");
    const [calls, setCalls] = useState<any[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const loading = loadingLocal || loadingCalls || loadingAnalytics;
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [durationData, setDurationData] = useState<any[]>([]);
    const [icpStats, setIcpStats] = useState<any>({ pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
    const [enrichedStats, setEnrichedStats] = useState<any>({ pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
    const [stats, setStats] = useState<any>({
        totalCalls: 0, avgDuration: 0, totalCost: 0,
        inboundDuration: 0, outboundDuration: 0,
        lifetimeVapiUsed: 0, vapiBalance: 0
    });

    useEffect(() => {
        if (voiceBalance) {
            setStats((prev: any) => ({ ...prev, vapiBalance: voiceBalance.vapi?.balance || 0 }));
        }
    }, [voiceBalance]);

    useEffect(() => {
        if (loadingCalls) return;

        const filteredCalls = globalCalls.filter((call: any) => {
            if (providerFilter !== "all" && call.source !== providerFilter) return false;
            if (!dateRange?.from) return true;
            const dateStr = call.createdAt || call.startedAt;
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

    useEffect(() => {
        const fetchServerStats = async () => {
            if (!dateRange?.from) return;
            setLoadingAnalytics(true);
            try {
                const params = new URLSearchParams();
                params.append('from', new Date(dateRange.from).toISOString());
                const toDate = dateRange.to || dateRange.from;
                params.append('to', new Date(toDate).toISOString());
                if (providerFilter !== 'all') {
                    params.append('provider', providerFilter);
                }
                const res = await fetch(`/api/voice/analytics?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setIcpStats(data.icpStats || { pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
                    setEnrichedStats(data.enrichedStats || { pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
                }
            } catch (err) {
                console.error("Error fetching voice analytics:", err);
            } finally {
                setLoadingAnalytics(false);
            }
        };

        fetchServerStats();
    }, [dateRange, providerFilter]);

    const processAnalytics = (data: any[]) => {
        const totalCallsArchive = data.length;
        let totalDuration = 0, totalCredits = 0;
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
            const dateStr = call.createdAt || call.startedAt || null;
            const time = dateStr ? format(new Date(dateStr), 'MMM dd') : 'N/A';
            const dur = calculateDuration(call);
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;

            totalDuration += dur;
            totalCredits += cost;

            const isInbound = call.isInbound === true || (call.type || "").toLowerCase().includes('inbound');
            if (isInbound) inboundSum += dur; else outboundSum += dur;

            const dayObj = dayMap.get(time) || { calls: 0, credits: 0 };
            dayMap.set(time, { calls: dayObj.calls + 1, credits: dayObj.credits + cost });

            if (dur < 30) durationBuckets['0-30s']++;
            else if (dur < 60) durationBuckets['30s-1m']++;
            else if (dur < 120) durationBuckets['1-2m']++;
            else if (dur < 300) durationBuckets['2-5m']++;
            else durationBuckets['5m+']++;
        });

        const newStats = {
            totalCalls: totalCallsArchive,
            avgDuration: totalCallsArchive > 0 ? totalDuration / totalCallsArchive : 0,
            totalCost: totalCredits,
            inboundDuration: inboundSum,
            outboundDuration: outboundSum,
            lifetimeVapiUsed: lifetimeVapiUsedSum,
        };

        setStats((prev: any) => ({
            ...prev,
            ...newStats
        }));

        const sortedDays = Array.from(dayMap.entries()).sort((a, b) => {
            return new Date(`${a[0]} ${new Date().getFullYear()}`).getTime() - new Date(`${b[0]} ${new Date().getFullYear()}`).getTime();
        });

        setVolumeData(sortedDays.length ? sortedDays.map(([name, obj]) => ({ name, value: obj.calls })) : [{ name: 'No data', value: 0 }]);
        setDurationData(Object.entries(durationBuckets).map(([name, value]) => ({ name, value })));
    };

    const earliestCallDate = calls.length > 0 
        ? new Date(Math.min(...calls.map(c => new Date(c.createdAt || c.startedAt).getTime())))
        : null;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-white p-6 space-y-6">
            {loading && <SPLoader />}
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Comparative performance across lead sources</p>
                </div>
                <div className="flex items-center gap-3">
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

            {/* Global Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Calls" 
                    value={stats.totalCalls} 
                    change={earliestCallDate ? `Since ${format(earliestCallDate, 'MMM dd')}` : "Total logged interactions"} 
                    icon={<Phone className="h-5 w-5" />} 
                    color="text-blue-600" 
                    bg="bg-blue-50" 
                />
                <StatCard title="Total Duration" value={formatDuration(stats.inboundDuration + stats.outboundDuration)} change="Talk Time" icon={<Clock className="h-5 w-5" />} color="text-slate-600" bg="bg-slate-50" />
                <StatCard title="Avg Duration" value={`${Math.round(stats.avgDuration)}s`} change="Per Call" icon={<Clock className="h-5 w-5" />} color="text-purple-600" bg="bg-purple-50" />
                <StatCard title="Credits Used" value={`$${stats.lifetimeVapiUsed?.toFixed(2)}`} change="Estimated spend" icon={<DollarSign className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            {/* Split Panels for ICP_TRACKER and ENRICHED_LEADS - Stacked into 2 rows */}
            <div className="grid grid-cols-1 gap-8">
                {/* ICP Tracker Panel */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Source: icp_tracker</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Call Pick-up Rate" value={`${icpStats.pickUpRate.toFixed(1)}%`} change="Duration > 18s" icon={<PhoneIncoming className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
                        <StatCard title="Call Completion Rate" value={`${icpStats.completionRate.toFixed(1)}%`} change="Ended by User/AI" icon={<CheckCircle className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
                        <StatCard title="Positive Response Rate" value={`${icpStats.positiveRate.toFixed(1)}%`} change="Interested Leads" icon={<TrendingUp className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
                    </div>
                </div>

                {/* ENRICHED_LEADS Panel */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Source: ENRICHED_LEADS</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Call Pick-up Rate" value={`${enrichedStats.pickUpRate.toFixed(1)}%`} change="Duration > 18s" icon={<PhoneIncoming className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
                        <StatCard title="Call Completion Rate" value={`${enrichedStats.completionRate.toFixed(1)}%`} change="Ended by User/AI" icon={<CheckCircle className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
                        <StatCard title="Positive Response Rate" value={`${enrichedStats.positiveRate.toFixed(1)}%`} change="Interested Leads" icon={<TrendingUp className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
                    </div>
                </div>
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
