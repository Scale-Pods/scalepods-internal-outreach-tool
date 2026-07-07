"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Phone, Clock, DollarSign, Timer, RefreshCw, Snowflake, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import React, { useState } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from "recharts";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

function fmt(seconds: number) {
    if (!seconds) return "0s";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

type AccountTab = 'all' | 'cold' | 'hubspot';

export default function VoiceDashboard({
    stats,
    dailyVolume,
    hourlyDistribution,
    coldStats,
    coldDailyVolume,
    hubspotStats,
    hubspotDailyVolume,
}: {
    stats: any;
    dailyVolume: any[];
    hourlyDistribution: any[];
    statusBreakdown: Record<string, number>;
    coldStats: any;
    coldDailyVolume: any[];
    hubspotStats: any;
    hubspotDailyVolume: any[];
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<AccountTab>('all');

    const handleDateUpdate = (values: any) => {
        if (values.range?.from) {
            setLoading(true);
            const from = new Date(values.range.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(values.range.to || values.range.from);
            to.setHours(23, 59, 59, 999);
            const params = new URLSearchParams(searchParams.toString());
            params.set('from', from.toISOString());
            params.set('to', to.toISOString());
            router.push(`?${params.toString()}`);
            setLoading(false);
        }
    };

    // Resolve displayed data based on active tab
    const displayStats = activeTab === 'cold' ? coldStats : activeTab === 'hubspot' ? hubspotStats : stats;
    const displayDailyVolume = activeTab === 'cold' ? coldDailyVolume : activeTab === 'hubspot' ? hubspotDailyVolume : dailyVolume;

    const tabs: { id: AccountTab; label: string; icon: React.ReactNode; color: string; activeBg: string; activeBorder: string; activeText: string; count: number }[] = [
        {
            id: 'all',
            label: 'All Calls',
            icon: <Phone className="h-4 w-4" />,
            color: 'text-slate-600',
            activeBg: 'bg-slate-900',
            activeBorder: 'border-slate-900',
            activeText: 'text-white',
            count: stats?.totalCalls || 0
        },
        {
            id: 'cold',
            label: 'Cold Leads',
            icon: <Snowflake className="h-4 w-4" />,
            color: 'text-blue-600',
            activeBg: 'bg-blue-600',
            activeBorder: 'border-blue-600',
            activeText: 'text-white',
            count: stats?.coldCallsCount || 0
        },
        {
            id: 'hubspot',
            label: 'HubSpot Leads',
            icon: <Flame className="h-4 w-4" />,
            color: 'text-orange-600',
            activeBg: 'bg-orange-500',
            activeBorder: 'border-orange-500',
            activeText: 'text-white',
            count: stats?.hubspotCallsCount || 0
        },
    ];

    const activeTabConfig = tabs.find(t => t.id === activeTab)!;

    return (
        <div className="flex flex-col min-h-full bg-slate-50/40 p-6 space-y-6">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Voice Agent Overview</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Monitor and analyze AI voice agent performance</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline"
                        className="flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-4 bg-white"
                        onClick={() => router.refresh()} disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <DateRangePicker onUpdate={handleDateUpdate} />
                </div>
            </div>

            {/* Account Type Tabs */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeTab === tab.id
                                ? `${tab.activeBg} ${tab.activeText} shadow-sm`
                                : `${tab.color} hover:bg-slate-50`
                        )}
                    >
                        {tab.icon}
                        {tab.label}
                        <span className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                            activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        )}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

           

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    title="TOTAL EXECUTIONS"
                    value={`${displayStats?.totalCalls ?? 0} calls`}
                    icon={<Phone className="h-5 w-5" />}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                />
                <MetricCard
                    title="TOTAL DURATION"
                    value={fmt(displayStats?.totalDuration ?? 0)}
                    icon={<Clock className="h-5 w-5" />}
                    color="text-slate-600"
                    bg="bg-slate-100/60"
                />
                <MetricCard
                    title="AVG DURATION"
                    value={fmt(Math.round(displayStats?.avgDuration ?? 0))}
                    icon={<Timer className="h-5 w-5" />}
                    color="text-purple-600"
                    bg="bg-purple-50"
                />
                <MetricCard
                    title="VAPI UTILIZATION"
                    value={`$${(displayStats?.totalCost ?? 0).toFixed(2)}`}
                    icon={<DollarSign className="h-5 w-5" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Call Volume */}
                <Card className="border-slate-200/60 shadow-sm bg-white rounded-xl">
                    <CardContent className="p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-6">Daily Call Volume</h3>
                        <div style={{ height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={displayDailyVolume.length > 0 ? displayDailyVolume : [{ name: 'No Data', calls: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                                    <Bar dataKey="calls" fill={activeTab === 'cold' ? '#3b82f6' : activeTab === 'hubspot' ? '#f97316' : '#10b981'} radius={[4, 4, 0, 0]} barSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Hourly Call Distribution */}
                <Card className="border-slate-200/60 shadow-sm bg-white rounded-xl">
                    <CardContent className="p-6">
                        <h3 className="text-base font-bold text-slate-900 mb-6">Hourly Call Distribution</h3>
                        <div style={{ height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <AreaChart data={hourlyDistribution.length > 0 ? hourlyDistribution : [{ name: '00:00', calls: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={activeTab === 'cold' ? '#3b82f6' : activeTab === 'hubspot' ? '#f97316' : '#10b981'} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={activeTab === 'cold' ? '#3b82f6' : activeTab === 'hubspot' ? '#f97316' : '#10b981'} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                                    <Area type="monotone" dataKey="calls" stroke={activeTab === 'cold' ? '#3b82f6' : activeTab === 'hubspot' ? '#f97316' : '#10b981'} strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ title, value, icon, color, bg }: any) {
    return (
        <Card className="border-slate-200/60 shadow-sm bg-white rounded-xl">
            <CardContent className="p-5 flex items-start justify-between">
                <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{title}</p>
                    <h3 className="text-2xl font-bold text-slate-900 leading-none">{value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl ${bg} ${color} flex items-center justify-center`}>{icon}</div>
            </CardContent>
        </Card>
    );
}
