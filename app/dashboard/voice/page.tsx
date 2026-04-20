"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, DollarSign, Timer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import React, { useEffect, useState } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from "recharts";
import { format, startOfDay, getHours, subDays } from "date-fns";
import { calculateDuration, formatDuration, cn } from "@/lib/utils";
import { useData } from "@/context/DataContext";

export default function VoiceDashboardPage() {
    const [providerFilter, setProviderFilter] = useState("vapi");
    const [stats, setStats] = useState({
        totalCalls: 0, totalDuration: 0, avgDuration: 0, totalCost: 0, avgCost: 0,
        successRate: 0, completedCalls: 0, vapiBalance: 0, lifetimeCostVapi: 0
    });
    const [dailyVolume, setDailyVolume] = useState<any[]>([]);
    const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7), to: new Date(),
    });

    const { calls: globalCalls, loadingCalls, voiceBalance, refreshAll } = useData();

    useEffect(() => {
        if (voiceBalance) {
            setStats(prev => ({ ...prev, vapiBalance: voiceBalance.vapi?.balance || 0 }));
            setLoadingLocal(false);
        }
    }, [voiceBalance]);

    const loading = loadingLocal || loadingCalls;

    useEffect(() => {
        if (loading) return;

        let totalDuration = 0, totalCost = 0, successCount = 0;
        const dayMap = new Map();
        const hourMap = new Array(24).fill(0);
        let lifetimeCostVapiSum = 0;

        globalCalls.forEach((call: any) => {
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;
            if (call.source === 'vapi') lifetimeCostVapiSum += (call.breakdown?.agent !== undefined) ? call.breakdown.agent : cost;
        });

        const filteredCalls = globalCalls.filter((call: any) => {
            if (providerFilter !== "all" && call.source !== providerFilter) return false;
            if (!dateRange?.from) return true;
            const dateStr = call.startedAt || (call.start_time_unix_secs ? new Date(call.start_time_unix_secs * 1000).toISOString() : null);
            if (!dateStr) return false;
            const callDate = new Date(dateStr);
            return callDate >= startOfDay(new Date(dateRange.from)) && callDate <= endOfDay(new Date(dateRange.to || dateRange.from));
        });

        filteredCalls.forEach((call: any) => {
            const status = call.status;
            const startedAtDate = call.startedAt ? new Date(call.startedAt) : (call.start_time_unix_secs ? new Date(call.start_time_unix_secs * 1000) : null);
            const duration = call.durationSeconds || calculateDuration(call) || 0;

            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;

            if (['done', 'ended', 'completed', 'success', 'answered'].includes(status)) successCount++;
            totalDuration += duration;
            totalCost += cost;

            if (startedAtDate) {
                const dayKey = format(startedAtDate, 'yyyy-MM-dd');
                const displayKey = format(startedAtDate, 'MMM dd');
                if (!dayMap.has(dayKey)) dayMap.set(dayKey, { count: 0, display: displayKey });
                dayMap.get(dayKey).count++;
                hourMap[getHours(startedAtDate)]++;
            }
        });

        setStats(prev => ({
            ...prev, totalCalls: filteredCalls.length, totalDuration, avgDuration: filteredCalls.length > 0 ? totalDuration / filteredCalls.length : 0,
            totalCost, avgCost: filteredCalls.length > 0 ? totalCost / filteredCalls.length : 0,
            successRate: filteredCalls.length > 0 ? (successCount / filteredCalls.length) * 100 : 0,
            lifetimeCostVapi: lifetimeCostVapiSum
        }));

        setDailyVolume(Array.from(dayMap.entries()).map(([dayKey, data]) => ({ dayKey, name: data.display, calls: data.count })).sort((a, b) => a.dayKey.localeCompare(b.dayKey)));
        setHourlyDistribution(hourMap.map((calls, hour) => ({ name: `${hour.toString().padStart(2, '0')}:00`, calls })).filter((_, i) => i % 3 === 0));
    }, [globalCalls, dateRange, providerFilter, loading]);

    return (
        <div className="flex flex-col min-h-full bg-white p-6 space-y-6">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex items-center justify-between shrink-0 mb-1">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Agent Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">Monitor and analyze AI voice agent performance</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    
                    <Button
                        variant="outline"
                        className="flex items-center gap-2 border-border text-slate-600 hover:bg-slate-50 transition-colors h-10 px-4"
                        onClick={refreshAll}
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                <DenseMetricCard title="Total Executions" value={`${stats.totalCalls} calls`} icon={<Phone className="h-5 w-5" />} color="text-indigo-600" bg="bg-indigo-50" />
                <DenseMetricCard title="Total Duration" value={formatDuration(stats.totalDuration)} icon={<Clock className="h-5 w-5" />} color="text-slate-600" bg="bg-slate-50" />
                <DenseMetricCard title="Avg Duration" value={`${Math.round(stats.avgDuration)}s`} icon={<Timer className="h-5 w-5" />} color="text-violet-600" bg="bg-violet-50" />
                <DenseMetricCard title="Vapi Utilization" value={`$${stats.lifetimeCostVapi.toFixed(2)}`} icon={<DollarSign className="h-5 w-5" />} color="text-blue-600" bg="bg-blue-50" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6">Daily Call Volume</h3>
                        <div className="w-full" style={{ height: 300, minHeight: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyVolume.length > 0 ? dailyVolume : [{ name: 'No Data', calls: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                    <Bar dataKey="calls" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-6">Hourly Call Distribution</h3>
                        <div className="w-full" style={{ height: 300, minHeight: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={hourlyDistribution.length > 0 ? hourlyDistribution : [{ name: '00:00', calls: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                    <Area type="monotone" dataKey="calls" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function DenseMetricCard({ title, value, icon, color, bg }: any) {
    return (
        <Card className="border-slate-50 shadow-none bg-slate-50/50">
            <CardContent className="p-5 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-xl font-bold text-slate-900 leading-none">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl shadow-sm ${bg} ${color}`}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}
function endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
