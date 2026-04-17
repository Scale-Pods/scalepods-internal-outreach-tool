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
    LineChart, Line, Area, ComposedChart
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
        icpLeadsContacted: 0,
        metaLeadsContacted: 0,
        messagesSent: 0,
        icpMessagesSent: 0,
        metaMessagesSent: 0,
        botMessages: 0,
        totalReplies: 0,
        icpRepliedCount: 0,
        metaRepliedCount: 0,
        replyRate: 0,
        readRate: 0,
        deliveredCount: 0,
        readCount: 0,
        waitingCount: 0,
        failedCount: 0,
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

    // Helper: check if lead has replied — matches chat page logic
    const hasLeadReplied = (lead: any) => {
        // New schema: User_Replied_1-25
        for (let i = 1; i <= 25; i++) {
            const r = lead[`User_Replied_${i}`];
            if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') {
                return true;
            }
        }
        // whatsapp_replied field
        if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
            return true;
        }
        // WTS_Reply_Track field (used by meta)
        const wtsTrack = lead["WTS_Reply_Track"];
        if (wtsTrack && String(wtsTrack).trim() !== "" && String(wtsTrack).toLowerCase() !== "no" && String(wtsTrack).toLowerCase() !== "none" && String(wtsTrack).toLowerCase() !== "false") {
            return true;
        }
        // Legacy: W.P_Replied_1-10
        for (let i = 1; i <= 10; i++) {
            const r = lead[`W.P_Replied_${i}`];
            if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                return true;
            }
        }
        return false;
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
            // Filter ICP leads — same criteria as chat page (actual message content)
            const icpWhatsapp = allLeads
                .filter((l: any) => {
                    // Strictly filter by table source
                    if (l._table && l._table !== 'icp_tracker') return false;
                    // Check Whatsapp_1-5 fields
                    for (let i = 1; i <= 5; i++) {
                        if (l[`Whatsapp_${i}`]) return true;
                    }
                    // Check User_Replied / Bot_Replied chain
                    for (let i = 1; i <= 25; i++) {
                        if (l[`User_Replied_${i}`] && String(l[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
                        if (l[`Bot_Replied_${i}`]) return true;
                    }
                    // Legacy W.P_ fields
                    if (l.stages_passed?.some?.((s: string) => s.toLowerCase().includes("whatsapp"))) return true;
                    for (let i = 1; i <= 12; i++) {
                        if (l[`W.P_${i}`] || l.stage_data?.[`WhatsApp ${i}`]) return true;
                    }
                    return false;
                })
                .map((l: any) => ({ ...l, _source: 'icp' }));

            // Filter Meta leads — same criteria as chat page (actual message content)
            const metaWhatsapp = metaLeads
                .filter((l: any) => {
                    if (l._table && l._table !== 'meta_lead_tracker') return false;
                    for (let i = 1; i <= 5; i++) {
                        if (l[`Whatsapp_${i}`]) return true;
                    }
                    for (let i = 1; i <= 25; i++) {
                        if (l[`User_Replied_${i}`] && String(l[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
                        if (l[`Bot_Replied_${i}`]) return true;
                    }
                    return false;
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
            let icpMessagesSent = 0;
            let metaMessagesSent = 0;
            let botMessages = 0;
            let leadsContacted = 0;
            let icpLeadsContacted = 0;
            let metaLeadsContacted = 0;
            let totalReplies = 0;
            let readCount = 0;
            let deliveredCount = 0;
            let waitingCount = 0;
            let icpRepliedCount = 0;
            let metaRepliedCount = 0;
            let failedCount = 0;

            filteredLeads.forEach((lead: any) => {
                let leadSentCount = 0;
                let leadBotCount = 0;

                // --- Count Sent ---
                // New schema: Whatsapp_1-5
                for (let i = 1; i <= 5; i++) {
                    if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) {
                        leadSentCount++;
                        stageCounts[i - 1]++;
                    }
                    // Track message status
                    const status = String(lead[`Whatsapp_${i}_status`] || "").toLowerCase();
                    const ts = String(lead[`W.P_${i} TS`] || "").toLowerCase();
                    const isFailed = status.includes("failed") || ts.includes("failed");
                    const isRead = status.includes("read") || ts.includes("read");
                    const isDelivered = status.includes("delivered") || ts.includes("delivered");

                    if (isFailed) { statuses.failed++; failedCount++; }
                    else if (isRead) { statuses.read++; readCount++; }
                    else if (isDelivered) { statuses.delivered++; deliveredCount++; }
                    else if (status.includes("sent") || ts.includes("sent")) { statuses.sent++; }
                }

                // New schema: Bot_Replied_1-25
                for (let i = 1; i <= 25; i++) {
                    if (lead[`Bot_Replied_${i}`] && String(lead[`Bot_Replied_${i}`]).trim()) { 
                        leadBotCount++; 
                        leadSentCount++; 
                    }
                    // Status for Bot Replies (if available)
                    const bStatus = String(lead[`Bot_Replied_Status_${i}`] || "").toLowerCase();
                    if (bStatus.includes("failed")) { statuses.failed++; failedCount++; }
                }

                // Legacy: W.P_ fields (only if no modern sent yet to avoid double counting same message)
                if (leadSentCount === 0) {
                    for (let i = 1; i <= 12; i++) {
                        if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) {
                            leadSentCount++;
                        }
                        const ts = String(lead[`W.P_${i} TS`] || "").toLowerCase();
                        if (ts.includes("failed")) { statuses.failed++; failedCount++; }
                    }
                }

                if (leadSentCount > 0) {
                    leadsContacted++;
                    if (lead._source === 'icp') icpLeadsContacted++;
                    else if (lead._source === 'meta') metaLeadsContacted++;
                }
                messagesSent += leadSentCount;
                if (lead._source === 'icp') icpMessagesSent += leadSentCount;
                else if (lead._source === 'meta') metaMessagesSent += leadSentCount;
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
                icpLeadsContacted,
                metaLeadsContacted,
                messagesSent,
                icpMessagesSent,
                metaMessagesSent,
                botMessages,
                totalReplies,
                icpRepliedCount,
                metaRepliedCount,
                replyRate: leadsContacted > 0 ? (totalReplies / leadsContacted) * 100 : 0,
                readRate: totalStatusMessages > 0 ? (statuses.read / totalStatusMessages) * 100 : 0,
                deliveredCount,
                readCount,
                waitingCount,
                failedCount,
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
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50 p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">WhatsApp Dashboard</h1>
                    <p className="text-sm font-medium text-slate-500">Real-time engagement & health analytics</p>
                </div>
                <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
            </header>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 shrink-0">
                <TopCard
                    title="Total Reachouts"
                    value={loading ? "..." : stats.leadsContacted}
                    subtitle={`ICP: ${stats.icpLeadsContacted} + Meta: ${stats.metaLeadsContacted}`}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/whatsapp/leads')}
                />
                <TopCard
                    title="Messages Sent"
                    value={loading ? "..." : stats.messagesSent}
                    subtitle={`ICP: ${stats.icpMessagesSent} + Meta: ${stats.metaMessagesSent}`}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/whatsapp/sent')}
                />
                <TopCard
                    title="Total Replies"
                    value={loading ? "..." : stats.totalReplies}
                    subtitle={`ICP: ${stats.icpRepliedCount} + Meta: ${stats.metaRepliedCount}`}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                />
                <TopCard
                    title="Reply Rate"
                    value={loading ? "..." : `${stats.replyRate.toFixed(1)}%`}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                />
                <DeliveryStatusDetailedCard allLeads={leads} />
            </div>

            {/* Main Dashboard Grid - Force to fill remaining space */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Campaign Performance - Takes more width */}
                <Card className="lg:col-span-2 bg-white border-border shadow-sm flex flex-col overflow-hidden">
                    <CardContent className="p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Activity Trend</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Reach vs Engagement volume over time</p>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Sent</div>
                                <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Replies</div>
                            </div>
                        </div>
                        {trendData.length > 0 ? (
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                                        <Tooltip
                                            contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" name="Messages Sent" />
                                        <Line type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} name="Replies Received" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                                No activity data for the selected period
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Source Performance - ICP vs Meta Comparison */}
                <Card className="bg-white border-border shadow-sm flex flex-col overflow-hidden">
                    <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900">Source Performance</h2>
                                <p className="text-[10px] text-slate-500 mt-0.5">ICP vs Meta channel comparison</p>
                            </div>
                            <div className="p-1.5 bg-slate-50 rounded-lg"><BarChart3 className="h-4 w-4 text-slate-400" /></div>
                        </div>

                        <div className="space-y-3 flex-1 flex flex-col justify-center">
                            {[
                                { label: 'Contacted', icp: stats.icpLeadsContacted, meta: stats.metaLeadsContacted, icpColor: '#6366f1', metaColor: '#3b82f6' },
                                { label: 'Messages', icp: stats.icpMessagesSent, meta: stats.metaMessagesSent, icpColor: '#6366f1', metaColor: '#3b82f6' },
                                { label: 'Replies', icp: stats.icpRepliedCount, meta: stats.metaRepliedCount, icpColor: '#6366f1', metaColor: '#3b82f6' },
                                { label: 'Reply Rate', icp: stats.icpLeadsContacted > 0 ? Math.round((stats.icpRepliedCount / stats.icpLeadsContacted) * 100) : 0, meta: stats.metaLeadsContacted > 0 ? Math.round((stats.metaRepliedCount / stats.metaLeadsContacted) * 100) : 0, icpColor: '#6366f1', metaColor: '#3b82f6', isPercent: true },
                            ].map((row, idx) => {
                                const max = Math.max(row.icp, row.meta, 1);
                                return (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">{row.label}</span>
                                            <div className="flex items-center gap-2.5 text-[9px] font-bold">
                                                <span className="text-indigo-600">ICP: {row.icp}{(row as any).isPercent ? '%' : ''}</span>
                                                <span className="text-blue-500">Meta: {row.meta}{(row as any).isPercent ? '%' : ''}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(row.icp / max) * 100}%`, backgroundColor: row.icpColor }} />
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(row.meta / max) * 100}%`, backgroundColor: row.metaColor }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-slate-100 shrink-0">
                            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-indigo-500" /><span className="text-[9px] font-bold text-slate-500 uppercase">ICP</span></div>
                            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /><span className="text-[9px] font-bold text-slate-500 uppercase">Meta</span></div>
                        </div>
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
                "border-border bg-white shadow-sm transition-all h-full flex flex-col justify-center",
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

function StatusBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-900">{value}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={cn("h-full transition-all duration-1000", color)} 
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

function DeliveryStatusDetailedCard({ allLeads }: { allLeads: any[] }) {
    const [localSource, setLocalSource] = useState<"icp" | "meta">("icp");
    
    const cardStats = useMemo(() => {
        const filtered = allLeads.filter(l => {
                            const table = (l._table || "").toLowerCase();
                            if (localSource === 'icp') return table === 'icp_tracker';
                            if (localSource === 'meta') return table === 'meta_lead_tracker';
                            return false;
                        });

        let sent = 0;
        let replied = 0;
        let failed = 0;
        
        filtered.forEach(lead => {
            let leadSentCount = 0;
            const l = lead as any;
            
            // --- Count Sent ---
            for (let i = 1; i <= 5; i++) { if (l[`Whatsapp_${i}`] && String(l[`Whatsapp_${i}`]).trim()) leadSentCount++; }
            for (let i = 1; i <= 25; i++) { if (l[`Bot_Replied_${i}`] && String(l[`Bot_Replied_${i}`]).trim()) leadSentCount++; }
            if (leadSentCount === 0) {
                for (let i = 1; i <= 12; i++) { if (l[`W.P_${i}`] && String(l[`W.P_${i}`]).trim()) leadSentCount++; }
            }
            sent += leadSentCount;

            // --- Count Failures ---
            for (let i = 1; i <= 5; i++) {
                const status = String(l[`Whatsapp_${i}_status`] || "").toLowerCase();
                if (status.includes('failed')) failed++;
            }
            for (let i = 1; i <= 25; i++) {
                const status = String(l[`Bot_Replied_Status_${i}`] || "").toLowerCase();
                if (status.includes('failed')) failed++;
            }
            for (let i = 1; i <= 12; i++) {
                const ts = String(l[`W.P_${i} TS`] || "").toLowerCase();
                if (ts.includes('failed')) failed++;
            }

            // --- Count Replied ---
            let hasReplied = false;
            for (let i = 1; i <= 25; i++) {
                if (l[`User_Replied_${i}`] && String(l[`User_Replied_${i}`]).trim() && String(l[`User_Replied_${i}`]).toLowerCase() !== 'no') {
                    hasReplied = true; break;
                }
            }
            if (!hasReplied && l.whatsapp_replied && l.whatsapp_replied !== "No") hasReplied = true;
            if (!hasReplied) {
                for (let i = 1; i <= 10; i++) {
                    if (l[`W.P_Replied_${i}`] && String(l[`W.P_Replied_${i}`]).toLowerCase() !== "no") {
                        hasReplied = true; break;
                    }
                }
            }
            if (hasReplied) replied++;
        });
        
        return { sent, replied, failed };
    }, [allLeads, localSource]);

    return (
        <Card className="border-border bg-white shadow-sm overflow-hidden h-full">
            <CardContent className="p-4 space-y-4 h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="min-w-0">
                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tighter truncate">Delivery Status</h3>
                            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-tight">Outbound Health</p>
                        </div>
                        <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 shrink-0">
                            <button 
                                onClick={() => setLocalSource("icp")}
                                className={cn("px-1.5 py-0.5 rounded-sm text-[8px] font-black transition-all uppercase", localSource === 'icp' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-indigo-600")}
                            >
                                ICP
                            </button>
                            <button 
                                onClick={() => setLocalSource("meta")}
                                className={cn("px-1.5 py-0.5 rounded-sm text-[8px] font-black transition-all uppercase", localSource === 'meta' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-blue-600")}
                            >
                                Meta
                            </button>
                        </div>
                    </div>
                </div>
                <div className="space-y-3 pt-1">
                    <StatusBar label="Sent" value={cardStats.sent} total={cardStats.sent || 1} color="bg-blue-400" />
                    <StatusBar label="Replied" value={cardStats.replied} total={cardStats.sent || 1} color="bg-emerald-500" />
                    <StatusBar label="Failed" value={cardStats.failed} total={cardStats.sent || 1} color="bg-rose-500" />
                    {cardStats.failed === 0 && cardStats.sent > 0 && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-full mt-1">
                            <CheckCheck className="h-2.5 w-2.5" />
                            <span>CLEAN DELIVERY</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

