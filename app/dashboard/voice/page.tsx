"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Phone, Clock, DollarSign, TrendingUp, Calendar as CalendarIcon, Timer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import React, { useEffect, useState } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, startOfDay, getHours, subDays } from "date-fns";
import { calculateDuration, formatDuration } from "@/lib/utils";
import { useData } from "@/context/DataContext";

export default function VoiceDashboardPage() {
    const [providerFilter, setProviderFilter] = useState("vapi");
    const [stats, setStats] = useState({
        totalCalls: 0,
        totalDuration: 0,
        avgDuration: 0,
        totalCost: 0,
        avgCost: 0,
        successRate: 0,
        completedCalls: 0,
        vapiBalance: 0,
        lifetimeCostVapi: 0
    });
    const [dailyVolume, setDailyVolume] = useState<any[]>([]);
    const [hourlyDistribution, setHourlyDistribution] = useState<any[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const { calls: globalCalls, loadingCalls, voiceBalance, refreshAll } = useData();

    useEffect(() => {
        if (voiceBalance) {
            setStats(prev => ({
                ...prev,
                vapiBalance: voiceBalance.vapi?.balance || 0
            }));
            setLoadingLocal(false);
        }
    }, [voiceBalance]);

    const loading = loadingLocal || loadingCalls;

    useEffect(() => {
        if (loading) return;

        let totalDuration = 0;
        let totalCost = 0;
        let completed = 0;
        let successCount = 0;

        const dayMap = new Map();
        const hourMap = new Array(24).fill(0);

        // Filter by date range and provider
        const filteredCalls = globalCalls.filter((call: any) => {
            if (providerFilter !== "all" && call.source !== providerFilter) return false;
            if (!dateRange?.from) return true;

            // Get date from Vapi or ElevenLabs
            const dateStr = call.startedAt || (call.start_time_unix_secs ? new Date(call.start_time_unix_secs * 1000).toISOString() : null);
            if (!dateStr) return false;

            const callDate = new Date(dateStr);
            const from = startOfDay(new Date(dateRange.from));
            const to = new Date(dateRange.to || dateRange.from);
            to.setHours(23, 59, 59, 999);

            const isMatch = callDate >= from && callDate <= to;
            return isMatch;
        });

        // Debug log to confirm counts
        // console.log(`Global Calls: ${globalCalls.length}, Filtered: ${filteredCalls.length} (Range: ${dateRange.from.toLocaleDateString()} - ${dateRange.to?.toLocaleDateString()})`);


        let lifetimeCostVapiSum = 0;

        // Separate calculation for lifetime totals (ignoring date filter)
        globalCalls.forEach((call: any) => {
            let cost = 0;
            if (typeof call.cost === 'string') {
                cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            } else if (typeof call.cost === 'number') {
                cost = call.cost;
            }

            if (call.source === 'vapi') {
                // Sum the specific agent part for credits
                lifetimeCostVapiSum += (call.breakdown?.agent !== undefined) ? call.breakdown.agent : cost;
            }
        });

        filteredCalls.forEach((call: any) => {
            const status = call.status;
            const startedAtDate = call.startedAt ? new Date(call.startedAt) : null;
            const duration = call.durationSeconds || 0;

            let cost = 0;
            if (typeof call.cost === 'string') {
                const numericStr = call.cost.replace(/[^\d.]/g, '');
                cost = parseFloat(numericStr) || 0;
            } else if (typeof call.cost === 'number') {
                cost = call.cost;
            }

            if (status === 'done' || status === 'ended' || status === 'completed' || status === 'success' || status === 'answered') {
                completed++;
                successCount++;
            }

            totalDuration += duration;
            totalCost += cost;

            if (startedAtDate) {
                const dayKey = format(startedAtDate, 'yyyy-MM-dd');
                const displayKey = format(startedAtDate, 'MMM dd');

                if (!dayMap.has(dayKey)) {
                    dayMap.set(dayKey, { count: 0, display: displayKey });
                }
                dayMap.get(dayKey).count++;

                const hour = getHours(startedAtDate);
                hourMap[hour]++;
            }
        });

        const totalCalls = filteredCalls.length;
        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;
        const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;

        setStats(prev => ({
            ...prev,
            totalCalls,
            totalDuration,
            avgDuration,
            totalCost,
            avgCost,
            successRate,
            completedCalls: completed,
            lifetimeCostVapi: lifetimeCostVapiSum
        }));

        const dailyData = Array.from(dayMap.entries())
            .map(([dayKey, data]) => ({ dayKey, name: data.display, calls: data.count }))
            .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

        setDailyVolume(dailyData);

        const hourlyData = hourMap.map((calls, hour) => ({
            name: `${hour.toString().padStart(2, '0')}:00`,
            calls
        })).filter((_, i) => i % 3 === 0);

        setHourlyDistribution(hourlyData);
    }, [globalCalls, dateRange, providerFilter, loading]);
    // Added providerFilter here

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <SPLoader />}
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Voice Agent Dashboard</h1>
                    <div className="flex items-center gap-2 text-slate-500">
                        <p>Monitor your AI voice agent performance.</p>

                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 h-10 border border-border rounded-md bg-white text-sm font-medium text-slate-700">
                        <Phone className="h-4 w-4 text-blue-600" />
                        <span>Vapi AI</span>
                    </div>
                    <Button
                        variant="outline"
                        className="flex items-center gap-2 border-border text-slate-600 hover:bg-slate-50 transition-colors h-10"
                        onClick={refreshAll}
                        disabled={loading}
                    >
                        <TrendingUp className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Executions"
                    value={`${stats.totalCalls} calls`}
                    icon={<Phone className="h-5 w-5 text-slate-600" />}
                />
                <MetricCard
                    title="Total Duration"
                    value={formatDuration(stats.totalDuration)}
                    icon={<Clock className="h-5 w-5 text-slate-600" />}
                />
                <MetricCard
                    title="Average Duration"
                    value={`${Math.round(stats.avgDuration)}s`}
                    icon={<Timer className="h-5 w-5 text-slate-600" />}
                />
                <MetricCard
                    title="Vapi Credits Used"
                    value={`$${(stats as any).lifetimeCostVapi.toFixed(2)}`}
                    badge="Total Used"
                    icon={<DollarSign className="h-5 w-5 text-blue-600" />}
                />
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

function MetricCard({ title, value, badge, icon }: any) {
    return (
        <Card className="bg-white border-border text-slate-900 shadow-sm relative group hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                        {badge && (
                            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded textxs font-medium bg-emerald-50 text-emerald-600 border border-bordermerald-100">
                                {badge}
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-border group-hover:bg-slate-100 transition-colors">
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
