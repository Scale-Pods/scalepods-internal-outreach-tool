"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Phone, Clock, DollarSign, CheckCircle, PhoneIncoming, TrendingUp, Snowflake, Flame } from "lucide-react";
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

const COLD_ACCOUNT = "scalepods internal outreach - cold leads";
const HUBSPOT_ACCOUNT = "hubspot leads";

function getAccountType(vapiAccount: string | null | undefined): 'cold' | 'hubspot' | 'other' {
    const val = (vapiAccount || '').toLowerCase().trim();
    if (val === COLD_ACCOUNT) return 'cold';
    if (val === HUBSPOT_ACCOUNT) return 'hubspot';
    return 'other';
}

export default function VoiceAnalyticsPage() {
    const { calls: globalCalls, loadingCalls, voiceBalance, refreshCalls } = useData();
    const [calls, setCalls] = useState<any[]>([]);
    const [coldCalls, setColdCalls] = useState<any[]>([]);
    const [hubspotCalls, setHubspotCalls] = useState<any[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const loading = loadingCalls || loadingAnalytics;
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [coldVolumeData, setColdVolumeData] = useState<any[]>([]);
    const [hubspotVolumeData, setHubspotVolumeData] = useState<any[]>([]);

    const [stats, setStats] = useState<any>({
        totalCalls: 0, avgDuration: 0, totalCost: 0,
        inboundDuration: 0, outboundDuration: 0,
        lifetimeVapiUsed: 0, vapiBalance: 0
    });

    const [coldStats, setColdStats] = useState<any>({ totalCalls: 0, avgDuration: 0, totalCost: 0 });
    const [hubspotStats, setHubspotStats] = useState<any>({ totalCalls: 0, avgDuration: 0, totalCost: 0 });

    // Analytics from server (pickup/completion/positive rates)
    const [coldAnalytics, setColdAnalytics] = useState({ pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
    const [hubspotAnalytics, setHubspotAnalytics] = useState({ pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });

    useEffect(() => {
        if (voiceBalance) {
            setStats((prev: any) => ({ ...prev, vapiBalance: voiceBalance.vapi?.balance || 0 }));
        }
    }, [voiceBalance]);

    useEffect(() => {
        if (loadingCalls) return;

        const filtered = globalCalls.filter((call: any) => {
            if (!dateRange?.from) return true;
            const dateStr = call.createdAt || call.startedAt;
            if (!dateStr) return false;
            const callDate = new Date(dateStr);
            const from = startOfDay(new Date(dateRange.from));
            const to = startOfDay(new Date(dateRange.to || dateRange.from));
            to.setHours(23, 59, 59, 999);
            return callDate >= from && callDate <= to;
        });

        const cold = filtered.filter((c: any) => (c.accountType || getAccountType(c.vapi_account)) === 'cold');
        const hubspot = filtered.filter((c: any) => (c.accountType || getAccountType(c.vapi_account)) === 'hubspot');

        setCalls(filtered);
        setColdCalls(cold);
        setHubspotCalls(hubspot);

        processAllStats(filtered);
        processColdStats(cold);
        processHubspotStats(hubspot);
    }, [globalCalls, loadingCalls, dateRange]);

    useEffect(() => {
        const fetchServerAnalytics = async () => {
            if (!dateRange?.from) return;
            setLoadingAnalytics(true);
            try {
                const params = new URLSearchParams();
                params.append('from', new Date(dateRange.from).toISOString());
                const toDate = dateRange.to || dateRange.from;
                params.append('to', new Date(toDate).toISOString());

                const res = await fetch(`/api/voice/analytics?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setColdAnalytics(data.coldStats || { pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
                    setHubspotAnalytics(data.hubspotStats || { pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 });
                }
            } catch (err) {
                console.error("Error fetching voice analytics:", err);
            } finally {
                setLoadingAnalytics(false);
            }
        };

        fetchServerAnalytics();
    }, [dateRange]);

    function buildDayMap(data: any[]) {
        const dayMap = new Map<string, number>();
        data.forEach(call => {
            const dateStr = call.createdAt || call.startedAt || null;
            const time = dateStr ? format(new Date(dateStr), 'MMM dd') : null;
            if (!time) return;
            dayMap.set(time, (dayMap.get(time) || 0) + 1);
        });
        return Array.from(dayMap.entries())
            .sort((a, b) => new Date(`${a[0]} ${new Date().getFullYear()}`).getTime() - new Date(`${b[0]} ${new Date().getFullYear()}`).getTime())
            .map(([name, value]) => ({ name, value }));
    }

    const processAllStats = (data: any[]) => {
        let totalDuration = 0, totalCredits = 0;
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
            const dur = calculateDuration(call);
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;
            totalDuration += dur;
            totalCredits += cost;
            const isInbound = call.isInbound === true || (call.type || "").toLowerCase().includes('inbound');
            if (isInbound) inboundSum += dur; else outboundSum += dur;
        });

        setStats((prev: any) => ({
            ...prev,
            totalCalls: data.length,
            avgDuration: data.length > 0 ? totalDuration / data.length : 0,
            totalCost: totalCredits,
            inboundDuration: inboundSum,
            outboundDuration: outboundSum,
            lifetimeVapiUsed: lifetimeVapiUsedSum,
        }));
        setVolumeData(buildDayMap(data));
    };

    const processColdStats = (data: any[]) => {
        let totalDuration = 0, totalCredits = 0;
        data.forEach(call => {
            const dur = calculateDuration(call);
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;
            totalDuration += dur;
            totalCredits += cost;
        });
        setColdStats({ totalCalls: data.length, avgDuration: data.length > 0 ? totalDuration / data.length : 0, totalCost: totalCredits });
        setColdVolumeData(buildDayMap(data));
    };

    const processHubspotStats = (data: any[]) => {
        let totalDuration = 0, totalCredits = 0;
        data.forEach(call => {
            const dur = calculateDuration(call);
            let cost = 0;
            if (typeof call.cost === 'string') cost = parseFloat(call.cost.replace(/[^\d.]/g, '')) || 0;
            else if (typeof call.cost === 'number') cost = call.cost;
            totalDuration += dur;
            totalCredits += cost;
        });
        setHubspotStats({ totalCalls: data.length, avgDuration: data.length > 0 ? totalDuration / data.length : 0, totalCost: totalCredits });
        setHubspotVolumeData(buildDayMap(data));
    };

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
                    change="All accounts"
                    icon={<Phone className="h-5 w-5" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard title="Total Duration" value={formatDuration(stats.inboundDuration + stats.outboundDuration)} change="Talk Time" icon={<Clock className="h-5 w-5" />} color="text-slate-600" bg="bg-slate-50" />
                <StatCard title="Avg Duration" value={`${Math.round(stats.avgDuration)}s`} change="Per Call" icon={<Clock className="h-5 w-5" />} color="text-purple-600" bg="bg-purple-50" />
                <StatCard title="Credits Used" value={`$${stats.lifetimeVapiUsed?.toFixed(2)}`} change="Estimated spend" icon={<DollarSign className="h-5 w-5" />} color="text-emerald-600" bg="bg-emerald-50" />
            </div>

            {/* Bifurcated Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* ── COLD LEADS Panel ── */}
                <div className="space-y-4 border border-blue-100 rounded-2xl p-5 bg-blue-50/30">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Snowflake className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-800">Cold Outreach Bot</h2>
                                <p className="text-[11px] text-slate-500">Scalepods Internal outreach - cold leads</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                            {coldCalls.length} calls
                        </span>
                    </div>

                    {/* Cold KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                        <MiniStatCard title="Total Calls" value={coldStats.totalCalls} color="text-blue-700" bg="bg-blue-100" icon={<Phone className="h-4 w-4" />} />
                        <MiniStatCard title="Avg Duration" value={`${Math.round(coldStats.avgDuration || 0)}s`} color="text-blue-700" bg="bg-blue-100" icon={<Clock className="h-4 w-4" />} />
                        <MiniStatCard title="Cost" value={`$${(coldStats.totalCost || 0).toFixed(2)}`} color="text-blue-700" bg="bg-blue-100" icon={<DollarSign className="h-4 w-4" />} />
                    </div>

                    {/* Cold Rates */}
                    <div className="grid grid-cols-3 gap-3">
                        <RateCard
                            title="Pick-up Rate"
                            value={`${coldAnalytics.pickUpRate.toFixed(1)}%`}
                            sub="Duration > 18s"
                            icon={<PhoneIncoming className="h-4 w-4" />}
                            color="text-blue-600"
                            bg="bg-white"
                        />
                        <RateCard
                            title="Completion Rate"
                            value={`${coldAnalytics.completionRate.toFixed(1)}%`}
                            sub="Ended by User/AI"
                            icon={<CheckCircle className="h-4 w-4" />}
                            color="text-blue-600"
                            bg="bg-white"
                        />
                        <RateCard
                            title="Positive Response"
                            value={`${coldAnalytics.positiveRate.toFixed(1)}%`}
                            sub="From ENRICHED_LEADS"
                            icon={<TrendingUp className="h-4 w-4" />}
                            color="text-blue-600"
                            bg="bg-white"
                            highlight
                        />
                    </div>

                    {/* Cold Volume Chart */}
                    {coldVolumeData.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-blue-100">
                            <p className="text-xs font-bold text-slate-600 mb-3">Daily Call Volume</p>
                            <div style={{ height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={coldVolumeData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eff6ff" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} width={25} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: 11 }} />
                                        <Bar dataKey="value" name="Calls" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── HUBSPOT LEADS Panel ── */}
                <div className="space-y-4 border border-orange-100 rounded-2xl p-5 bg-orange-50/30">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Flame className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-800">Hot CRM Bot</h2>
                                <p className="text-[11px] text-slate-500">hubspot leads</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                            {hubspotCalls.length} calls
                        </span>
                    </div>

                    {/* HubSpot KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                        <MiniStatCard title="Total Calls" value={hubspotStats.totalCalls} color="text-orange-700" bg="bg-orange-100" icon={<Phone className="h-4 w-4" />} />
                        <MiniStatCard title="Avg Duration" value={`${Math.round(hubspotStats.avgDuration || 0)}s`} color="text-orange-700" bg="bg-orange-100" icon={<Clock className="h-4 w-4" />} />
                        <MiniStatCard title="Cost" value={`$${(hubspotStats.totalCost || 0).toFixed(2)}`} color="text-orange-700" bg="bg-orange-100" icon={<DollarSign className="h-4 w-4" />} />
                    </div>

                    {/* HubSpot Rates */}
                    <div className="grid grid-cols-3 gap-3">
                        <RateCard
                            title="Pick-up Rate"
                            value={`${hubspotAnalytics.pickUpRate.toFixed(1)}%`}
                            sub="Duration > 18s"
                            icon={<PhoneIncoming className="h-4 w-4" />}
                            color="text-orange-600"
                            bg="bg-white"
                        />
                        <RateCard
                            title="Completion Rate"
                            value={`${hubspotAnalytics.completionRate.toFixed(1)}%`}
                            sub="Ended by User/AI"
                            icon={<CheckCircle className="h-4 w-4" />}
                            color="text-orange-600"
                            bg="bg-white"
                        />
                        <RateCard
                            title="Positive Response"
                            value={`${hubspotAnalytics.positiveRate.toFixed(1)}%`}
                            sub="From hubspot_lead"
                            icon={<TrendingUp className="h-4 w-4" />}
                            color="text-orange-600"
                            bg="bg-white"
                            highlight
                        />
                    </div>

                    {/* HubSpot Volume Chart */}
                    {hubspotVolumeData.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-orange-100">
                            <p className="text-xs font-bold text-slate-600 mb-3">Daily Call Volume</p>
                            <div style={{ height: 160 }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <BarChart data={hubspotVolumeData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fff7ed" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={6} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} width={25} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #fed7aa', fontSize: 11 }} />
                                        <Bar dataKey="value" name="Calls" fill="#f97316" radius={[3, 3, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, change, icon, color, bg }: any) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
            <div className="p-5">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-950 mt-1">{value}</h3>
                        <span className="text-xs font-medium text-slate-500">{change}</span>
                    </div>
                    <div className={cn("p-3 rounded-xl transition-colors shrink-0", bg, color)}>
                        {icon}
                    </div>
                </div>
            </div>
        </Card>
    );
}

function MiniStatCard({ title, value, icon, color, bg }: any) {
    return (
        <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <div className={cn("p-1.5 rounded-lg", bg, color)}>{icon}</div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
            </div>
            <p className="text-lg font-bold text-slate-900">{value}</p>
        </div>
    );
}

function RateCard({ title, value, sub, icon, color, bg, highlight }: any) {
    return (
        <div className={cn(
            "rounded-xl p-3 border shadow-sm",
            highlight ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100 bg-white"
        )}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className={cn(color)}>{icon}</span>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{title}</p>
            </div>
            <p className={cn("text-xl font-bold", highlight ? "text-emerald-700" : "text-slate-900")}>{value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
        </div>
    );
}
