"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users, MessageCircle, TrendingUp, BarChart3, Send,
    Reply, ArrowUpRight, CheckCheck,
    Clock, Percent, Bot,
} from "lucide-react";
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    XAxis, YAxis, CartesianGrid, Tooltip,
    LineChart, Line,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";
import { cn } from "@/lib/utils";
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { SPLoader } from "@/components/sp-loader";

export default function WhatsappDashboardPage() {
    const router = useRouter();
    const { leads: allLeads, loadingLeads } = useData();
    const [leads, setLeads] = useState<any[]>([]);
    const [isRepliesOpen, setIsRepliesOpen] = useState(false);
    const [metaLeads, setMetaLeads] = useState<any[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [dateRange, setDateRange] = useState<any>(undefined);
    const loading = loadingLeads || loadingMeta;

    const [stats, setStats] = useState({
        totalLeads: 0,
        icpLeadCount: 0,
        metaLeadCount: 0,
        leadsContacted: 0,
        messagesSent: 0,
        botMessages: 0,
        totalReplies: 0,
        icpRepliedCount: 0,
        metaRepliedCount: 0,
        replyRate: 0,
        readRate: 0,
        deliveredCount: 0,
        readCount: 0,
        waitingCount: 0,
        avgMessagesPerLead: 0,
    });
    const [trendData, setTrendData] = useState<any[]>([]);
    const [stageData, setStageData] = useState<any[]>([]);
    const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

    // Fetch meta leads
    useEffect(() => {
        (async () => {
            setLoadingMeta(true);
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

    // Helper: check if lead has replied
    // ICP tracker → whatsapp_replied | Meta tracker → WTS_Reply_Track
    const hasLeadReplied = (lead: any) => {
        const isValid = (v: any) =>
            v && String(v).trim() !== "" &&
            String(v).toLowerCase() !== "no" &&
            String(v).toLowerCase() !== "none" &&
            String(v).toLowerCase() !== "false";

        if (lead._source === 'meta') {
            return isValid(lead["WTS_Reply_Track"]);
        }
        // ICP (default)
        return isValid(lead.whatsapp_replied);
    };

    // Count user replies for a lead
    const countUserReplies = (lead: any) => {
        let count = 0;
        for (let i = 1; i <= 25; i++) {
            const r = lead[`User_Replied_${i}`];
            if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') count++;
        }
        return count;
    };

    useEffect(() => {
        if (loadingLeads || loadingMeta) return;

        try {
            // Filter ICP leads with WhatsApp activity OR a WTS_Reply_Track value
            const icpWhatsapp = allLeads
                .filter((l: any) => {
                    const hasWLC = l["Whatsapp Last Contacted"] && String(l["Whatsapp Last Contacted"]).trim() !== "";
                    const hasDrips = [1, 2, 3, 4, 5].some(i => l[`Whatsapp_${i}`]);
                    const hasTrack = l["WTS_Reply_Track"] && String(l["WTS_Reply_Track"]).trim() !== "" &&
                        String(l["WTS_Reply_Track"]).toLowerCase() !== "no";
                    return hasWLC || hasDrips || hasTrack;
                })
                .map((l: any) => ({ ...l, _source: 'icp' }));

            // Filter Meta leads with WhatsApp activity OR a WTS_Reply_Track value
            const metaWhatsapp = metaLeads
                .filter((l: any) => {
                    const hasWLC = l["Whatsapp Last Contacted"] && String(l["Whatsapp Last Contacted"]).trim() !== "";
                    const hasDrips = [1, 2, 3, 4, 5].some(i => l[`Whatsapp_${i}`]);
                    const hasTrack = l["WTS_Reply_Track"] && String(l["WTS_Reply_Track"]).trim() !== "" &&
                        String(l["WTS_Reply_Track"]).toLowerCase() !== "no";
                    return hasWLC || hasDrips || hasTrack;
                })
                .map((l: any) => ({ ...l, _source: 'meta' }));
            
            const allWhatsappLeads = [...icpWhatsapp, ...metaWhatsapp];
            const icpCount = icpWhatsapp.length;
            const metaCount = metaWhatsapp.length;
            setLeads(allWhatsappLeads);

            // Date filtering
            const fromD = dateRange?.from ? new Date(dateRange.from) : null;
            const toD = dateRange?.to ? new Date(dateRange.to) : fromD;
            if (fromD) fromD.setHours(0, 0, 0, 0);
            if (toD) toD.setHours(23, 59, 59, 999);

            const filteredLeads = allWhatsappLeads.filter((lead: any) => {
                if (!fromD || !toD) return true;
                const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                if (!wlc) return false;
                const contactDate = new Date(wlc);
                return contactDate >= fromD && contactDate <= toD;
            });

            // Compute stats
            const dailyGroups: Record<string, { date: string; sent: number; replied: number; bot: number }> = {};
            const stageCounts = [0, 0, 0, 0, 0]; // Whatsapp_1 to 5
            const statuses: Record<string, number> = { read: 0, delivered: 0, sent: 0, failed: 0 };

            let messagesSent = 0;
            let botMessages = 0;
            let leadsContacted = 0;
            let totalReplies = 0;
            let readCount = 0;
            let deliveredCount = 0;
            let waitingCount = 0;
            let icpRepliedCount = 0;
            let metaRepliedCount = 0;

            filteredLeads.forEach((lead: any) => {
                let leadSentCount = 0;
                let leadBotCount = 0;

                // Whatsapp_1-5 stage messages
                for (let i = 1; i <= 5; i++) {
                    if (lead[`Whatsapp_${i}`]) {
                        leadSentCount++;
                        stageCounts[i - 1]++;
                    }
                    // Track message status
                    const status = String(lead[`Whatsapp_${i}_status`] || "").toLowerCase();
                    if (status === "read") { statuses.read++; readCount++; }
                    else if (status === "delivered") { statuses.delivered++; deliveredCount++; }
                    else if (status === "sent") { statuses.sent++; }
                    else if (status === "failed") { statuses.failed++; }
                }

                // Bot_Replied_1-25
                for (let i = 1; i <= 25; i++) {
                    if (lead[`Bot_Replied_${i}`]) { leadBotCount++; leadSentCount++; }
                }

                if (leadSentCount > 0) leadsContacted++;
                messagesSent += leadSentCount;
                botMessages += leadBotCount;

                const isReplied = hasLeadReplied(lead);
                if (isReplied) {
                    totalReplies++;
                    if (lead._source === 'icp') icpRepliedCount++;
                    else if (lead._source === 'meta') metaRepliedCount++;
                } else if (leadSentCount > 0) {
                    waitingCount++;
                }

                // Daily trend
                const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                if (wlc) {
                    const d = new Date(wlc);
                    if (!isNaN(d.getTime())) {
                        const dStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        if (!dailyGroups[dStr]) dailyGroups[dStr] = { date: dStr, sent: 0, replied: 0, bot: 0 };
                        dailyGroups[dStr].sent += leadSentCount;
                        dailyGroups[dStr].bot += leadBotCount;
                        if (isReplied) dailyGroups[dStr].replied += 1;
                    }
                }
            });

            const totalStatusMessages = statuses.read + statuses.delivered + statuses.sent;

            setStats({
                totalLeads: filteredLeads.length,
                icpLeadCount: icpCount,
                metaLeadCount: metaCount,
                leadsContacted,
                messagesSent,
                botMessages,
                totalReplies,
                icpRepliedCount,
                metaRepliedCount,
                replyRate: leadsContacted > 0 ? (totalReplies / leadsContacted) * 100 : 0,
                readRate: totalStatusMessages > 0 ? (statuses.read / totalStatusMessages) * 100 : 0,
                deliveredCount,
                readCount,
                waitingCount,
                avgMessagesPerLead: leadsContacted > 0 ? Math.round((messagesSent / leadsContacted) * 10) / 10 : 0,
            });

            setTrendData(
                Object.values(dailyGroups)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(-14)
            );

            setStageData([
                { stage: 'Drip 1', count: stageCounts[0], fill: '#6366f1' },
                { stage: 'Drip 2', count: stageCounts[1], fill: '#3b82f6' },
                { stage: 'Drip 3', count: stageCounts[2], fill: '#8b5cf6' },
                { stage: 'Drip 4', count: stageCounts[3], fill: '#a855f7' },
                { stage: 'Drip 5', count: stageCounts[4], fill: '#c084fc' },
            ]);

            setStatusDistribution([
                { name: 'Read', value: statuses.read, color: '#10b981' },
                { name: 'Delivered', value: statuses.delivered, color: '#3b82f6' },
                { name: 'Sent', value: statuses.sent, color: '#94a3b8' },
                { name: 'Failed', value: statuses.failed, color: '#ef4444' },
            ].filter(d => d.value > 0));

        } catch (e) {
            console.error("Dashboard calculation error", e);
        }
    }, [dateRange, allLeads, loadingLeads, metaLeads]);

    const repliedLeads = useMemo(() => leads.filter(l => hasLeadReplied(l)), [leads]);

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Overview</h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time engagement insights across all campaigns</p>
                </div>
                <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
            </div>

            {/* Top 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <TopCard
                    title="Total Whatsapp Reachouts"
                    value={loading ? "..." : stats.totalLeads}
                    subtitle={`ICP: ${stats.icpLeadCount} + Meta: ${stats.metaLeadCount}`}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/whatsapp/leads')}
                />
                <TopCard
                    title="Messages Sent"
                    value={loading ? "..." : stats.messagesSent}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/whatsapp/sent')}
                />
                <TopCard
                    title="Total Replies"
                    value={loading ? "..." : stats.totalReplies}
                    subtitle={`ICP: ${stats.icpRepliedCount} + Meta: ${stats.metaRepliedCount}`}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                />
                <TopCard
                    title="Reply Rate"
                    value={loading ? "..." : `${stats.replyRate.toFixed(1)}%`}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                />
            </div>

            

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Activity Trend */}
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Activity Trend</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Messages sent vs replies over time</p>
                            </div>
                            <TrendingUp className="h-4 w-4 text-slate-400" />
                        </div>
                        {trendData.length > 0 ? (
                            <div className="h-[240px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <Tooltip
                                            contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                                        />
                                        <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} name="Sent" />
                                        <Line type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} name="Replied" />
                                        <Line type="monotone" dataKey="bot" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Bot" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">
                                No activity data for the selected period
                            </div>
                        )}
                        <div className="flex justify-center gap-6 mt-3">
                            <ChartLegend color="bg-blue-500" label="Sent" />
                            <ChartLegend color="bg-emerald-500" label="Replied" />
                            <ChartLegend color="bg-violet-500" label="Bot" dashed />
                        </div>
                    </CardContent>
                </Card>

                {/* Message Status Distribution */}
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Message Delivery</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Read, delivered &amp; sent status breakdown</p>
                            </div>
                            <BarChart3 className="h-4 w-4 text-slate-400" />
                        </div>
                        {statusDistribution.length > 0 ? (
                            <>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={80}
                                                paddingAngle={4}
                                                dataKey="value"
                                            >
                                                {statusDistribution.map((entry, index) => (
                                                    <Cell key={index} fill={entry.color} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    {statusDistribution.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg">
                                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700">{item.value}</p>
                                                <p className="text-[10px] text-slate-500">{item.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-[240px] flex items-center justify-center text-sm text-slate-400">
                                No message status data available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            


        </div>
    );
}

/* ─── Top Metric Card ─── */
function TopCard({ title, value, subtitle, icon, iconBg, onClick }: {
    title: string; value: number | string; subtitle?: string;
    icon: React.ReactNode; iconBg: string; onClick?: () => void;
}) {
    return (
        <Card
            className={cn(
                "border-border bg-white shadow-sm transition-all",
                onClick && "cursor-pointer hover:shadow-md"
            )}
            onClick={onClick}
        >
            <CardContent className="p-5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{title}</p>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                <div className={cn("p-3 rounded-xl shrink-0", iconBg)}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Smaller Insight Card ─── */
function InsightCard({ label, value, icon, color, bg }: {
    label: string; value: number | string; icon: React.ReactNode; color: string; bg: string;
}) {
    return (
        <Card className="border-border bg-white shadow-sm">
            <CardContent className="p-4 flex flex-col gap-1.5">
                <div className={cn("p-1.5 rounded-lg w-fit", bg, color)}>{icon}</div>
                <h4 className="text-xl font-bold text-slate-900">{value}</h4>
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
            </CardContent>
        </Card>
    );
}

/* ─── Quick Action Card ─── */
function ActionCard({ title, description, icon, onClick, color }: {
    title: string; description: string; icon: React.ReactNode; onClick: () => void; color: string;
}) {
    const colorMap: Record<string, { bg: string; iconBg: string; text: string; hover: string }> = {
        indigo: { bg: 'bg-white', iconBg: 'bg-indigo-50', text: 'text-indigo-600', hover: 'hover:border-indigo-200' },
        emerald: { bg: 'bg-white', iconBg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'hover:border-emerald-200' },
        violet: { bg: 'bg-white', iconBg: 'bg-violet-50', text: 'text-violet-600', hover: 'hover:border-violet-200' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <Card
            className={cn("border-border shadow-sm cursor-pointer transition-all hover:shadow-md", c.bg, c.hover)}
            onClick={onClick}
        >
            <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("p-3 rounded-xl shrink-0", c.iconBg, c.text)}>{icon}</div>
                <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">{title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400 shrink-0 ml-auto" />
            </CardContent>
        </Card>
    );
}

/* ─── Chart Legend ─── */
function ChartLegend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className={cn("h-[3px] w-4 rounded-full", color, dashed && "opacity-60")}
                style={dashed ? { background: `repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)` } : {}}
            />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
    );
}
