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
import { format, startOfDay, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";

interface RepliedLead {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    repliedViaWhatsapp: boolean;
    repliedViaEmail: boolean;
}

interface DashboardStats {
    totalLeads: number; totalICP: number; totalMeta: number; totalEnriched: number;
    totalEmails: number; totalWhatsApp: number; totalVoice: number;
    totalEmailReplies: number; totalWhatsappReplies: number;
    whatsappIcpReplied: number; whatsappMetaReplied: number; enrichedRepliedCount: number;
    totalReplies: number; totalVoiceSeconds: number;
    repliedLeadsCold?: RepliedLead[];
    voiceMinutesString: string; totalVoiceCalls: number;
    totalHubspotLeads: number;
    // Bifurcated voice call counts from vapi_account column
    coldVoiceCallsCount: number;
    hubspotVoiceCallsCount: number;
    hubspot?: {
        leads: number;
        emails: number;
        whatsapp: number;
        voice: number;
        replies: number;
        repliedLeads?: RepliedLead[];
    }
}

export default function MasterDashboard({ stats, acquisitionChartData }: { stats: DashboardStats, acquisitionChartData: any[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [repliesModal, setRepliesModal] = useState<{ open: boolean; scope: 'cold' | 'hot' }>({ open: false, scope: 'cold' });
    const [dateLabel, setDateLabel] = useState("Last 7 days");
    const handleDateUpdate = (values: any) => {
        if (values.range?.from) {
            const from = new Date(values.range.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(values.range.to || values.range.from);
            to.setHours(23, 59, 59, 999);
            
            const params = new URLSearchParams(searchParams.toString());
            params.set('from', from.toISOString());
            params.set('to', to.toISOString());
            router.push(`?${params.toString()}`);
        }
    };

    const loading = false;



    // Derived Pie Chart Data
    const realServiceDistribution = [
        { name: 'Email', value: stats.totalEmails, color: '#3b82f6' },
        { name: 'WhatsApp', value: stats.totalWhatsApp, color: '#10b981' },
        { name: 'Voice', value: stats.totalVoice, color: '#8b5cf6' },
    ];

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <SPLoader />}
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

            {/* Cold Outreach Section */}
            <div className="mt-8 mb-4">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Cold Outreach bot</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <MetricCard
                        title="Total Leads"
                        value={loading ? "..." : stats.totalLeads.toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Users className="h-6 w-6" />}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        border="border-blue-100"
                        onClick={() => router.push('/dashboard/leads')}
                        subtitle={`Meta: ${stats.totalMeta} | Enriched: ${(stats as any).totalEnriched || 0}`}
                    />
                    <MetricCard
                        title="Emails Sent"
                        value={loading ? "..." : stats.totalEmails.toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Mail className="h-6 w-6" />}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                        border="border-emerald-100"
                        onClick={() => router.push('/dashboard/email/sent')}
                    />
                    <MetricCard
                        title="WhatsApp Chats"
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
                        title="Voice Calls"
                        value={loading ? "..." : ((stats as any).coldVoiceCallsCount ?? (stats as any).totalVoiceCalls ?? 0).toLocaleString()}
                        change={`${(stats as any).voiceMinutesString || "0m 0s"}`}
                        isUp={true}
                        icon={<Activity className="h-6 w-6" />}
                        color="text-orange-600"
                        bg="bg-orange-50"
                        border="border-orange-100"
                        onClick={() => router.push('/dashboard/voice')}
                        subtitle="Cold Leads bot calls (vapi_account: cold leads)"
                    />
                    <MetricCard
                        title="Total Replies"
                        value={loading ? "..." : (stats.totalReplies).toLocaleString()}
                        change={`${stats.totalLeads > 0 ? ((stats.totalReplies / stats.totalLeads) * 100).toFixed(1) : 0}% Rate`}
                        isUp={true}
                        icon={<Expand className="h-6 w-6" />}
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                        border="border-indigo-100"
                        onClick={() => setRepliesModal({ open: true, scope: 'cold' })}
                        subtitle="ENRICHED_LEADS: WTS_Reply_Track / Email_Reply_Track"
                    />
                </div>
            </div>

            {/* Hot CRM Outreach Section */}
            <div className="mb-8 mt-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Hot CRM outreach bot</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    <MetricCard
                        title="Total Leads"
                        value={loading ? "..." : (stats.hubspot?.leads || 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Users className="h-6 w-6" />}
                        color="text-cyan-600"
                        bg="bg-cyan-50"
                        border="border-cyan-100"
                    />
                    <MetricCard
                        title="Emails Sent"
                        value={loading ? "..." : (stats.hubspot?.emails || 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Mail className="h-6 w-6" />}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                        border="border-emerald-100"
                    />
                    <MetricCard
                        title="WhatsApp Chats"
                        value={loading ? "..." : (stats.hubspot?.whatsapp || 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<MessageCircle className="h-6 w-6" />}
                        color="text-purple-600"
                        bg="bg-purple-50"
                        border="border-purple-100"
                    />
                    <MetricCard
                        title="Voice Calls"
                        value={loading ? "..." : (stats.hubspot?.voice || 0).toLocaleString()}
                        change="HubSpot bot calls"
                        isUp={true}
                        icon={<Activity className="h-6 w-6" />}
                        color="text-orange-600"
                        bg="bg-orange-50"
                        border="border-orange-100"
                        subtitle="HubSpot leads bot calls (vapi_account: hubspot leads)"
                    />
                    <MetricCard
                        title="Total Replies"
                        value={loading ? "..." : (stats.hubspot?.replies || 0).toLocaleString()}
                        change={`${(stats.hubspot?.leads || 0) > 0 ? (((stats.hubspot?.replies || 0) / (stats.hubspot?.leads || 1)) * 100).toFixed(1) : 0}% Rate`}
                        isUp={true}
                        icon={<Expand className="h-6 w-6" />}
                        color="text-indigo-600"
                        bg="bg-indigo-50"
                        border="border-indigo-100"
                        onClick={() => setRepliesModal({ open: true, scope: 'hot' })}
                        subtitle="hubspot_lead: WTS_Reply_Track / Email_Reply_Track"
                    />
                </div>
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
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

            <RepliesModal
                open={repliesModal.open}
                onOpenChange={(open) => setRepliesModal(prev => ({ ...prev, open }))}
                scope={repliesModal.scope}
                leads={repliesModal.scope === 'cold' ? (stats.repliedLeadsCold || []) : (stats.hubspot?.repliedLeads || [])}
            />
        </div >
    );
}

function RepliesModal({ open, onOpenChange, scope, leads }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scope: 'cold' | 'hot';
    leads: RepliedLead[];
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {scope === 'cold' ? 'Cold Outreach — Total Replies' : 'Hot CRM Outreach — Total Replies'}
                    </DialogTitle>
                    <p className="text-xs text-slate-500 mt-1">
                        Source: {scope === 'cold' ? 'ENRICHED_LEADS' : 'hubspot_lead'} — WTS_Reply_Track / Email_Reply_Track
                    </p>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
                    {leads.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-10">No replies in this range.</p>
                    ) : (
                        leads.map((lead) => (
                            <div key={lead.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                                    <p className="text-xs text-slate-500 truncate">
                                        {lead.email || lead.phone || 'No contact info'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {lead.repliedViaEmail && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                            <Mail className="h-2.5 w-2.5" /> Email
                                        </span>
                                    )}
                                    {lead.repliedViaWhatsapp && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
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
