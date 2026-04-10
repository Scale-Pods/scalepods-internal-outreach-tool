"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Send, Inbox, LayoutDashboard, RefreshCw, BarChart2, UserMinus, ChevronDown, ChevronUp } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { useData } from "@/context/DataContext";

import { SPLoader } from "@/components/sp-loader";

export default function EmailDashboardPage() {
    const router = useRouter();
    const [dateSubtitle, setDateSubtitle] = useState("all time");

    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>(undefined);
    const loading = loadingLeads;
    const [data, setData] = useState({
        totalEmails: 0,
        responseRate: "0%",
        totalReplies: 0,
        totalUnsubscribed: 0,
        emailCounts: [0, 0, 0, 0, 0, 0], // Email 1-6
    });
    const [dbData, setDbData] = useState<{campaignAnalytics: any[], leadReplies: any[]}>({
        campaignAnalytics: [],
        leadReplies: []
    });
    const [dbStats, setDbStats] = useState({
        totalLeads: 0,
        totalSent: 0,
        totalOpens: 0,
        totalReplies: 0,
        openRate: "0%",
        replyRate: "0%"
    });

    useEffect(() => {
        const calculateStats = async () => {
            if (loadingLeads) return;

            try {
                // Apply Date Filtering if dateRange is set
                const filteredLeads = allLeads.filter((lead: any) => {
                    if (!dateRange?.from) return true;
                    if (!lead.created_at) return false;

                    const leadDate = new Date(lead.created_at);
                    const from = new Date(dateRange.from);
                    from.setHours(0, 0, 0, 0);
                    const to = dateRange.to ? new Date(dateRange.to) : from;
                    to.setHours(23, 59, 59, 999);

                    return leadDate >= from && leadDate <= to;
                });

                let totalEmailsCount = 0;
                let replyCount = 0;
                let unsubscribedCount = 0;

                const counts = [0, 0, 0, 0, 0, 0];

                filteredLeads.forEach((lead: any) => {
                    const stages = lead.stages_passed || [];

                    stages.forEach((stage: string) => {
                        const s = stage.toLowerCase().trim();
                        if (!s.startsWith("email_")) return;

                        const num = parseInt(s.split("_")[1]);
                        if (num >= 1 && num <= 6) {
                            counts[num - 1]++;
                            totalEmailsCount++;
                        }
                    });

                    if (lead.replied && lead.replied !== "No" && String(lead.replied).trim() !== "") {
                        replyCount++;
                    }

                    if (lead.unsubscribed && String(lead.unsubscribed).toLowerCase().includes("yes")) {
                        unsubscribedCount++;
                    }
                });

                setData({
                    totalEmails: totalEmailsCount,
                    responseRate: filteredLeads.length > 0 ? ((replyCount / filteredLeads.length) * 100).toFixed(1) + "%" : "0%",
                    totalReplies: replyCount,
                    totalUnsubscribed: unsubscribedCount,
                    emailCounts: counts,
                });

                // 2. Fetch DB Stats
                const dbRes = await fetch('/api/email/db-data');
                if (dbRes.ok) {
                    const json = await dbRes.json();
                    setDbData(json);
                    
                    const campaigns = json.campaignAnalytics || [];
                    if (campaigns.length > 1) {
                        // Skip first row (definitions)
                        const dataRows = campaigns.slice(1);
                        let leads = 0, sent = 0, opens = 0, replies = 0;
                        
                        // Try to find columns dynamically by common names
                        dataRows.forEach((row: any) => {
                            Object.entries(row).forEach(([key, val]) => {
                                const k = key.toLowerCase();
                                const v = Number(val) || 0;
                                if (k === 'total_leads' || k === 'leads') leads += v;
                                else if (k === 'sent' || k === 'total_sent') sent += v;
                                else if (k === 'opens' || k === 'total_opens') opens += v;
                                else if (k === 'replies' || k === 'total_replies') replies += v;
                            });
                        });

                        setDbStats({
                            totalLeads: leads,
                            totalSent: sent,
                            totalOpens: opens,
                            totalReplies: replies,
                            openRate: sent > 0 ? ((opens / sent) * 100).toFixed(1) + "%" : "0%",
                            replyRate: leads > 0 ? ((replies / leads) * 100).toFixed(1) + "%" : "0%"
                        });
                    }
                }

            } catch (e) {
                console.error("Dashboard calculation error", e);
            }
        };

        calculateStats();
    }, [dateRange, allLeads, loadingLeads]);

    const handleDateUpdate = (range: any) => {
        setDateRange(range.range);
        if (range.label) {
            setDateSubtitle(range.label.toLowerCase() === "today" ? "sent today" : `sent ${range.label.toLowerCase()}`);
        } else {
            setDateSubtitle("sent in selected range");
        }
    };

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Outreach Center</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitor your email sequence performance</p>
                </div>
                <DateRangePicker onUpdate={handleDateUpdate} />
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Emails Sent"
                    subtitle="Official Instantly Data"
                    value={dbStats.totalSent || data.totalEmails}
                    icon={<Mail className="h-6 w-6 text-indigo-600" />}
                    bg="bg-indigo-50"
                    onClick={() => router.push('/dashboard/email/analytics')}
                />
                <MetricCard
                    title="Open Rate"
                    subtitle={`${dbStats.totalOpens} Total Opens`}
                    value={dbStats.openRate}
                    icon={<BarChart2 className="h-6 w-6 text-emerald-600" />}
                    bg="bg-emerald-50"
                    onClick={() => router.push('/dashboard/email/analytics')}
                />
                <MetricCard
                    title="Reply Rate"
                    subtitle={`${dbStats.totalReplies || data.totalReplies} Total Replies`}
                    value={dbStats.replyRate}
                    icon={<Inbox className="h-6 w-6 text-sky-600" />}
                    bg="bg-sky-50"
                    onClick={() => router.push('/dashboard/email/received')}
                />
                <MetricCard
                    title="Total Leads"
                    subtitle="Campaign Universe"
                    value={dbStats.totalLeads || allLeads.length}
                    icon={<UserMinus className="h-6 w-6 text-rose-600" />}
                    bg="bg-rose-50"
                />
            </div>

            {/* Recent Replies Preview */}
            {dbData.leadReplies.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Recent Replies</h2>
                        <Button 
                            variant="link" 
                            className="text-indigo-600"
                            onClick={() => router.push('/dashboard/email/received')}
                        >
                            View All
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dbData.leadReplies.slice(0, 3).map((reply, idx) => (
                            <Card key={idx} className="bg-white border-border shadow-sm hover:shadow-md transition-all">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                            {reply.sender_name?.charAt(0) || reply.sender_email_id?.charAt(0) || "L"}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold truncate text-slate-900">{reply.sender_name || "Lead"}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{reply.sender_email_id}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-600 line-clamp-2 italic">
                                        "{reply.reply || "Interested in your pods..."}"
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Campaign Breakdown */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider">Sequence Performance</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                        <BreakdownCard
                            key={`email-${num}`}
                            title={`Email ${num}`}
                            count={data.emailCounts[num - 1]}
                            total={data.totalEmails}
                            color={num <= 3 ? "#3b82f6" : "#8b5cf6"}
                            trackColor={num <= 3 ? "#eff6ff" : "#f3e8ff"}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, subtitle, value, icon, bg, onClick, extra }: any) {
    return (
        <Card
            className="border-border hover:shadow-md transition-all cursor-pointer bg-white"
            onClick={onClick}
        >
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex-1">
                    <div className="flex items-center">
                        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                        {extra}
                    </div>
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${bg}`}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}

function BreakdownCard({ title, count, total, color, trackColor }: any) {
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    const chartData = [{ value: parseFloat(percentage) }, { value: 100 - parseFloat(percentage) }];

    return (
        <Card className="border-border bg-white shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="h-32 w-full mb-2 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={50}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                            >
                                <Cell key="cell-0" fill={color} />
                                <Cell key="cell-1" fill={trackColor} />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-lg font-bold text-slate-900">{percentage}%</span>
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-1">{count}</h3>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <p className="text-xs text-slate-400 mt-1">Emails Sent</p>
            </CardContent>
        </Card>
    );
}
