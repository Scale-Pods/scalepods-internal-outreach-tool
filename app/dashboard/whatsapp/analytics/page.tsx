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
import { TrendingUp, Users, MessageSquare, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { startOfDay, endOfDay } from "date-fns";

// Helper: check if lead has replied
const hasLeadReplied = (lead: any) => {
    for (let i = 1; i <= 25; i++) {
        const r = lead[`User_Replied_${i}`];
        if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') return true;
    }
    if (lead.whatsapp_replied && String(lead.whatsapp_replied).toLowerCase() !== "no" && String(lead.whatsapp_replied).toLowerCase() !== "none") return true;
    if (lead.Replied && String(lead.Replied).toLowerCase() !== "no" && String(lead.Replied).toLowerCase() !== "none") return true;
    return false;
};

// Helper: count sent messages
const countSentMessages = (lead: any) => {
    let count = 0;
    for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`]) count++; }
    for (let i = 1; i <= 25; i++) { if (lead[`Bot_Replied_${i}`]) count++; }
    return count;
};

export default function WhatsappAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [metaLeads, setMetaLeads] = useState<any[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    // Fetch meta_lead_tracker
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/leads/meta');
                if (res.ok) {
                    const data = await res.json();
                    setMetaLeads(data.leads || []);
                }
            } catch (err) {
                console.error('Failed to fetch meta_lead_tracker:', err);
            } finally {
                setLoadingMeta(false);
            }
        })();
    }, []);

    const loading = loadingLeads || loadingMeta;

    // Combine leads from both tables with WhatsApp activity
    const combinedLeads = useMemo(() => {
        const icpTagged = allLeads
            .filter((l: any) => {
                const hasWLC = l["Whatsapp Last Contacted"] && String(l["Whatsapp Last Contacted"]).trim() !== "";
                const hasDrips = [1, 2, 3, 4, 5].some(i => l[`Whatsapp_${i}`]);
                return hasWLC || hasDrips;
            })
            .map((l: any) => ({ ...l, _source: 'icp_tracker' }));

        const metaTagged = metaLeads
            .filter((l: any) => {
                const hasWLC = l["Whatsapp Last Contacted"] && String(l["Whatsapp Last Contacted"]).trim() !== "";
                const hasDrips = [1, 2, 3, 4, 5].some(i => l[`Whatsapp_${i}`]);
                return hasWLC || hasDrips;
            })
            .map((l: any) => ({ ...l, _source: 'meta_lead_tracker' }));

        return [...icpTagged, ...metaTagged];
    }, [allLeads, metaLeads]);

    // Date-filtered leads
    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            if (!dateRange.from) return true;
            const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
            if (!wlc) return false;
            const contactDate = new Date(wlc);
            const from = startOfDay(new Date(dateRange.from));
            const to = endOfDay(new Date(dateRange.to || dateRange.from));
            return contactDate >= from && contactDate <= to;
        });
    }, [combinedLeads, dateRange]);

    const stats = useMemo(() => {
        let totalSent = 0;
        let repliedCount = 0;
        const campaigns: Record<string, { value: number }> = {
            "ICP Tracker": { value: 0 },
            "Meta Lead": { value: 0 }
        };

        filteredLeads.forEach(lead => {
            const sentCount = countSentMessages(lead);
            totalSent += sentCount;

            const replied = hasLeadReplied(lead);
            if (replied) {
                repliedCount++;
                const campaignName = lead._source === 'icp_tracker' ? "ICP Tracker" : "Meta Lead";
                if (campaigns[campaignName]) campaigns[campaignName].value++;
            }
        });

        const replyRate = filteredLeads.length > 0 ? (repliedCount / filteredLeads.length) * 100 : 0;

        return {
            totalSent,
            repliedCount,
            totalLeads: filteredLeads.length,
            replyRate: replyRate.toFixed(1) + "%",
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

            if (hasLeadReplied(lead)) {
                groups[dStr].replied += 1;
            }
        });
        return Object.values(groups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);
    }, [filteredLeads]);

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            {/* Header */}
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
                        <CardTitle className="text-sm font-bold text-slate-900">Campaign Breakdown</CardTitle>
                        <CardDescription className="text-xs">Replies distribution by source table</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.campaignData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={5} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30}>
                                        {stats.campaignData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={['#8b5cf6', '#3b82f6'][index % 2]} />
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
