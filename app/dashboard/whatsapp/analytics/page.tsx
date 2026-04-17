"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { startOfDay, endOfDay } from "date-fns";

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
    const hasDateFilter = !!dateRange.from;

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

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">WhatsApp Analytics</h1>
                    <p className="text-slate-500 text-xs">Campaign performance & lead engagement</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    {hasDateFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setDateRange({ from: undefined, to: undefined })} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                            <X className="h-3 w-3" /> Reset
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8 w-8 p-0">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                <CompactStat title="Messages Sent" value={stats.totalSent.toLocaleString()} icon={Send} color="text-blue-600" bg="bg-blue-50" />
                <CompactStat title="Total Replies" value={stats.repliedCount.toLocaleString()} icon={MessageSquare} color="text-emerald-600" bg="bg-emerald-50" />
                <CompactStat title="Response Rate" value={stats.replyRate} icon={TrendingUp} color="text-purple-600" bg="bg-purple-50" />
                <CompactStat title="Leads Contacted" value={stats.totalLeads.toLocaleString()} icon={Users} color="text-slate-600" bg="bg-slate-100" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
                <Card className="lg:col-span-2 border-border shadow-sm bg-white flex flex-col overflow-hidden">
                    <CardHeader className="p-3 pb-0 shrink-0">
                        <CardTitle className="text-xs font-bold text-slate-900">Engagement Trend</CardTitle>
                        <CardDescription className="text-[10px]">Messages sent vs replies received</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 flex-1 min-h-0">
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
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={30} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fill="url(#colorSent)" name="Sent" />
                                <Area type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2} fill="url(#colorReplied)" name="Replied" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-border shadow-sm bg-white flex flex-col overflow-hidden">
                    <CardHeader className="p-3 pb-0 shrink-0">
                        <CardTitle className="text-xs font-bold text-slate-900">Source Breakdown</CardTitle>
                        <CardDescription className="text-[10px]">Replies by campaign source</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.campaignData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} width={30} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28}>
                                    {stats.campaignData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={['#6366f1', '#3b82f6'][index % 2]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function CompactStat({ title, value, icon: Icon, color, bg }: any) {
    return (
        <Card className="border-border shadow-sm bg-white">
            <CardContent className="p-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg} ${color}`}><Icon className="h-4 w-4" /></div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{value}</h3>
                </div>
            </CardContent>
        </Card>
    );
}
