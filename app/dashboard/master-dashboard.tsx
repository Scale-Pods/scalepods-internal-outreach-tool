"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Users,
    Mail,
    MessageCircle,
    Phone,
    TrendingUp,
    Zap,
    BarChart3,
    PieChart as PieChartIcon,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Maximize2,
    Minimize2,
    X,
    Expand,
    Wallet,
    Info
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { calculateDuration, formatDuration } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";



export default function MasterDashboard() {
    const [isRepliesModalOpen, setIsRepliesModalOpen] = useState(false);
    const [dateLabel, setDateLabel] = useState("Last 7 days");
    const [dateRange, setDateRange] = useState<any>(undefined);

    const { leads: allLeads, calls: allCalls, loadingLeads, loadingCalls, refreshAll, maqsamBalance, loadingBalances } = useData();
    const [leads, setLeads] = useState<any[]>([]);
    const [metaLeads, setMetaLeads] = useState<any[]>([]);
    const [acquisitionChartData, setAcquisitionChartData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalEmails: 0,
        totalWhatsApp: 0,
        totalVoice: 0,
        totalReplies: 0,
        voiceMinutes: 0,
        totalVoiceCalls: 0
    });
    const loading = loadingLeads || loadingCalls;

    // Fetch meta_lead_tracker leads
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
            }
        })();
    }, []);

    const handleDateUpdate = ({ range, label }: { range: any, label?: string }) => {
        if (label) {
            setDateLabel(label);
        }
        setDateRange(range);
    };

    useEffect(() => {
        const calculateStats = async () => {
            if (loadingLeads) return;

            try {
                // Apply Date Filtering for Leads
                const filteredLeads = allLeads.filter((lead: any) => {
                    if (!dateRange?.from) return true;

                    // Extract best available date (created_at, last_contacted, or embedded reply timestamp)
                    let leadDateStr = lead.last_contacted || lead.created_at;

                    // Detect timestamp from email_replied (matches Received Emails page logic)
                    if (lead.email_replied && lead.email_replied !== "No" && lead.email_replied !== "none") {
                        const lines = String(lead.email_replied).trim().split('\n');
                        const lastLine = lines[lines.length - 1].trim();
                        const possibleDate = new Date(lastLine);
                        if (!isNaN(possibleDate.getTime()) && lastLine.includes('-') && lastLine.includes(':')) {
                            leadDateStr = possibleDate.toISOString();
                        }
                    }

                    // Apply same logic for WhatsApp interaction if needed
                    let hasWPReply = false;
                    if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") hasWPReply = true;
                    else {
                        for (let i = 1; i <= 10; i++) {
                            const r = lead[`W.P_Replied_${i}`];
                            if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                                hasWPReply = true;
                                break;
                            }
                        }
                    }

                    if (hasWPReply) {
                        // Try to find a timestamp in any reply
                        let foundDate = false;
                        if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
                            const lines = String(lead.whatsapp_replied).trim().split('\n');
                            const lastLine = lines[lines.length - 1].trim();
                            const possibleDate = new Date(lastLine);
                            if (!isNaN(possibleDate.getTime()) && lastLine.includes('-') && lastLine.includes(':')) {
                                leadDateStr = possibleDate.toISOString();
                                foundDate = true;
                            }
                        }
                    }

                    if (!leadDateStr) return false;

                    const leadDate = new Date(leadDateStr);
                    const from = new Date(dateRange.from);
                    from.setHours(0, 0, 0, 0);
                    const to = dateRange.to ? new Date(dateRange.to) : from;
                    to.setHours(23, 59, 59, 999);

                    return leadDate >= from && leadDate <= to;
                });

                setLeads(filteredLeads);

                // Calculate Acquisition Data for the chart
                const acquisitionMap: { [key: string]: number } = {};

                // Determine graph timeframe: use dateRange or last 7 days of data
                let startDate = dateRange?.from ? new Date(dateRange.from) : null;
                let endDate = dateRange?.to ? new Date(dateRange.to) : new Date();

                if (!startDate && filteredLeads.length > 0) {
                    const oldest = new Date(Math.min(...filteredLeads.map(l => new Date(l.created_at || Date.now()).getTime())));
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    startDate = oldest > thirtyDaysAgo ? oldest : thirtyDaysAgo;
                } else if (!startDate) {
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - 7);
                }

                const current = new Date(startDate);
                current.setHours(0, 0, 0, 0);
                const end = new Date(endDate);
                end.setHours(0, 0, 0, 0);

                while (current <= end) {
                    const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    acquisitionMap[dateStr] = 0;
                    current.setDate(current.getDate() + 1);
                }

                filteredLeads.forEach((lead: any) => {
                    const date = new Date(lead.created_at || Date.now());
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (acquisitionMap[dateStr] !== undefined) {
                        acquisitionMap[dateStr]++;
                    }
                });

                const chartData = Object.entries(acquisitionMap).map(([name, leads]) => ({
                    name,
                    leads
                })).sort((a, b) => 0);

                setAcquisitionChartData(chartData);

                // Process Vapi Calls from Global Data
                let totalVoiceSeconds = 0;
                let totalVoiceCallsCount = 0;

                if (!loadingCalls && Array.isArray(allCalls)) {
                    const filteredCalls = allCalls.filter((call: any) => {
                        if (!dateRange?.from) return true;
                        if (!call.startedAt) return false;

                        const callDate = new Date(call.startedAt);
                        const from = new Date(dateRange.from);
                        from.setHours(0, 0, 0, 0);
                        const to = dateRange.to ? new Date(dateRange.to) : from;
                        to.setHours(23, 59, 59, 999);

                        return callDate >= from && callDate <= to;
                    });
                    totalVoiceSeconds = filteredCalls.reduce((acc, call) => acc + calculateDuration(call), 0);
                    totalVoiceCallsCount = filteredCalls.length;
                }

                let emailCount = 0;
                let whatsappCount = 0;
                let voiceCount = 0;
                let replyCount = 0;

                filteredLeads.forEach((lead: any) => {
                    const stages = lead.stages_passed || [];
                    let hasEmail = false;
                    stages.forEach((stage: string) => {
                        if (stage.toLowerCase().includes("email")) hasEmail = true;
                    });
                    if (hasEmail) emailCount++;

                    let hasWhatsApp = false;
                    stages.forEach((stage: string) => {
                        if (stage.toLowerCase().includes("whatsapp")) hasWhatsApp = true;
                    });
                    if (!hasWhatsApp) {
                        if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") hasWhatsApp = true;
                        for (let i = 1; i <= 10; i++) {
                            if (lead[`W.P_Replied_${i}`] || lead[`W.P_FollowUp_${i}`]) {
                                hasWhatsApp = true;
                                break;
                            }
                        }
                        if (!hasWhatsApp) {
                            for (let i = 1; i <= 6; i++) {
                                if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) {
                                    hasWhatsApp = true;
                                    break;
                                }
                            }
                            if (lead["W.P_FollowUp"] || lead.stage_data?.["WhatsApp FollowUp"]) hasWhatsApp = true;
                        }
                    }
                    if (hasWhatsApp) whatsappCount++;

                    let hasVoice = false;
                    stages.forEach((stage: string) => {
                        if (stage.toLowerCase().includes("voice")) hasVoice = true;
                    });
                    if (hasVoice) voiceCount++;

                    const hasEmailReply = lead.email_replied && lead.email_replied !== "No" && lead.email_replied !== "none";
                    const hasTrack = lead["WTS_Reply_Track"] && lead["WTS_Reply_Track"] !== "No" && lead["WTS_Reply_Track"] !== "none";
                    let hasWPReply = hasTrack || (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none");
                    if (!hasWPReply) {
                        for (let i = 1; i <= 10; i++) {
                            const r = lead[`W.P_Replied_${i}`];
                            if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                                hasWPReply = true;
                                break;
                            }
                        }
                    }

                    if (hasEmailReply) replyCount++;
                    if (hasWPReply) replyCount++;
                    if (!hasEmailReply && !hasWPReply && lead.replied === "Yes") replyCount++;
                });

                setStats({
                    totalLeads: filteredLeads.length,
                    totalEmails: emailCount,
                    totalWhatsApp: whatsappCount,
                    totalVoice: voiceCount,
                    voiceMinutesString: formatDuration(totalVoiceSeconds),
                    totalVoiceSeconds: totalVoiceSeconds,
                    totalVoiceCalls: totalVoiceCallsCount,
                    totalReplies: replyCount
                } as any);

            } catch (e) {
                console.error("Dashboard calculation error", e);
            }
        };

        calculateStats();
    }, [dateRange, allLeads, allCalls, loadingLeads, loadingCalls]);

    const router = useRouter();

    // Derived Pie Chart Data
    const realServiceDistribution = [
        { name: 'Email', value: stats.totalEmails, color: '#3b82f6' },
        { name: 'WhatsApp', value: stats.totalWhatsApp, color: '#10b981' },
        { name: 'Voice', value: stats.totalVoice, color: '#8b5cf6' },
    ];

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && leads.length === 0 && <SPLoader />}
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Master Overview</h1>
                    <p className="text-sm text-slate-500">Holistic view of all your marketing channels performance.</p>
                </div>
                <div className="shrink-0">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">

                <MetricCard
                    title="Total Leads"
                    value={loading ? "..." : (stats.totalLeads + metaLeads.length).toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Users className="h-6 w-6" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    border="border-borderlue-100"
                    onClick={() => router.push('/dashboard/leads')}
                    subtitle={`ICP: ${stats.totalLeads} + Meta: ${metaLeads.length}`}
                />
                <MetricCard
                    title="Total Emails Sent"
                    value={loading ? "..." : stats.totalEmails.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Mail className="h-6 w-6" />}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    border="border-bordermerald-100"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total WhatsApp Chats"
                    value={loading ? "..." : stats.totalWhatsApp.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<MessageCircle className="h-6 w-6" />}
                    color="text-purple-600"
                    bg="bg-purple-50"
                    border="border-purple-100"
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricCard
                    title="Total Voice Calls"
                    value={loading ? "..." : (stats as any).totalVoiceCalls?.toLocaleString() || "0"}
                    change={`${(stats as any).voiceMinutesString || "0m 0s"}`}
                    isUp={true}
                    icon={<Activity className="h-6 w-6" />}
                    color="text-orange-600"
                    bg="bg-orange-50"
                    border="border-orange-100"
                    onClick={() => router.push('/dashboard/voice')}
                />
                
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : stats.totalReplies.toLocaleString()}
                    change={`${stats.totalLeads > 0 ? ((stats.totalReplies / stats.totalLeads) * 100).toFixed(1) : 0}% Rate`}
                    isUp={true}
                    icon={<Expand className="h-6 w-6" />}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    border="border-indigo-100"
                />
            </div>



            {/* Charts Row 1: Lead Acquisition & Service Distribution */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Lead Acquisition Area Chart */}
                <Card className="lg:col-span-2 border-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-lg">Lead Acquisition</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="w-full" style={{ height: 240, minHeight: 240 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={acquisitionChartData}>
                                    <defs>
                                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <ChartTooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Service Distribution Pie Chart */}
                <Card className="border-border shadow-sm bg-white overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <PieChartIcon className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-lg">Response Performance!</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2 flex flex-col items-center justify-center">
                        <div className="w-full" style={{ height: 220, minHeight: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={realServiceDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {realServiceDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <ChartTooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}

function MetricCard({ title, value, change, isUp, icon, color, bg, border, onClick, action, subtitle }: {
    title: string,
    value: string,
    change: string,
    isUp: boolean,
    icon: React.ReactNode,
    color: string,
    bg: string,
    border: string,
    onClick?: () => void,
    action?: React.ReactNode,
    subtitle?: string
}) {
    return (
        <Card
            className={`bg-white border ${border} shadow-sm overflow-hidden relative group hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <CardContent className="p-4">
                <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mr-2 mb-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                            {subtitle && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="p-1 hover:bg-slate-50 rounded-full cursor-help">
                                                <Info className="h-3.5 w-3.5 text-slate-300" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs font-medium">{subtitle}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            {action && <div className="z-20">{action}</div>}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
                        <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {change}
                        </div>
                    </div>
                    <div className={`p-3 rounded-xl ${bg} ${color} shadow-sm`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
