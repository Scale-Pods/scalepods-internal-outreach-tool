"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Users, MessageCircle, Send, Percent, Gauge, RefreshCw, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import { LinkedInAccountBadge, accountColorClasses } from "@/components/dashboard/linkedin-account-badge";

interface AccountBreakdown {
    accountId: string;
    name: string;
    color: string;
    totalLeads: number;
    connectedLeads: number;
    notConnectedLeads: number;
    conversations: number;
    messages: number;
    quota: {
        dailyCap: number;
        sentCount: number;
        remaining: number;
    };
}

interface DashboardStats {
    totalLeads: number;
    connectedLeads: number;
    notConnectedLeads: number;
    totalMessages: number;
    uniqueConversations: number;
    quota: {
        dailyCap: number;
        sentCount: number;
        remaining: number;
    };
    accountBreakdown: AccountBreakdown[];
}

export default function LinkedInDashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/linkedin/dashboard");
            const json = await res.json();
            setStats(json);
        } catch (err) {
            console.error("Failed to fetch LinkedIn dashboard stats:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const connectionRate = stats && stats.totalLeads > 0
        ? ((stats.connectedLeads / stats.totalLeads) * 100).toFixed(1)
        : "0.0";

    const quotaUsedPct = stats && stats.quota.dailyCap > 0
        ? Math.min((stats.quota.sentCount / stats.quota.dailyCap) * 100, 100)
        : 0;

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px] px-6">
            {loading && <SPLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LinkedIn Outreach Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Connection requests, conversations and daily quota synced from Google Sheets
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 h-10 px-4">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                    title="Total Leads"
                    value={stats?.totalLeads ?? "..."}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/linkedin/leads')}
                />
                <MetricCard
                    title="Accepted / Connected"
                    value={stats?.connectedLeads ?? "..."}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/linkedin/leads')}
                />
                <MetricCard
                    title="Not Connected"
                    value={stats?.notConnectedLeads ?? "..."}
                    icon={<XCircle className="h-5 w-5" />}
                    iconBg="bg-rose-50 text-rose-600"
                    onClick={() => router.push('/dashboard/linkedin/leads')}
                />
                <MetricCard
                    title="Connection Rate"
                    value={`${connectionRate}%`}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                />
                <MetricCard
                    title="Conversations"
                    value={stats?.uniqueConversations ?? "..."}
                    icon={<MessageCircle className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/linkedin/chat')}
                />
            </div>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Connection Status Breakdown</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Based on Status &amp; Connection Status columns from the Leads sheet</p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${connectionRate}%` }}
                        />
                        <div
                            className="h-full bg-rose-400 transition-all duration-500"
                            style={{ width: `${(100 - parseFloat(connectionRate)).toFixed(1)}%` }}
                        />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Accepted / Connected ({stats?.connectedLeads ?? 0})</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" /> Not Connected ({stats?.notConnectedLeads ?? 0})</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Bifurcation by Account</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Leads, connections, conversations &amp; quota per LinkedIn sender account</p>
                        </div>
                        <Users className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5">Account</th>
                                    <th className="px-3 py-2.5 text-center">Total Leads</th>
                                    <th className="px-3 py-2.5 text-center">Connected</th>
                                    <th className="px-3 py-2.5 text-center">Not Connected</th>
                                    <th className="px-3 py-2.5 text-center">Conversations</th>
                                    <th className="px-3 py-2.5 text-center">Messages</th>
                                    <th className="px-3 py-2.5 text-center">Daily Cap</th>
                                    <th className="px-3 py-2.5 text-center">Sent Today</th>
                                    <th className="px-3 py-2.5 text-center">Remaining</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(stats?.accountBreakdown ?? []).map(row => (
                                    <tr key={row.accountId} className={cn("transition-colors", accountColorClasses(row.color).split(' ')[0])}>
                                        <td className="px-3 py-2.5"><LinkedInAccountBadge accountId={row.accountId} /></td>
                                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{row.totalLeads}</td>
                                        <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{row.connectedLeads}</td>
                                        <td className="px-3 py-2.5 text-center font-bold text-rose-600">{row.notConnectedLeads}</td>
                                        <td className="px-3 py-2.5 text-center text-slate-600">{row.conversations}</td>
                                        <td className="px-3 py-2.5 text-center text-slate-600">{row.messages}</td>
                                        <td className="px-3 py-2.5 text-center text-slate-600">{row.quota.dailyCap}</td>
                                        <td className="px-3 py-2.5 text-center text-slate-600">{row.quota.sentCount}</td>
                                        <td className="px-3 py-2.5 text-center font-bold text-slate-900">{row.quota.remaining}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Daily Quota</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Across all connected LinkedIn accounts, from the Quota Tracker sheet</p>
                        </div>
                        <Gauge className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <StatBox label="Daily Cap" value={stats?.quota.dailyCap ?? 0} />
                        <StatBox label="Sent Today" value={stats?.quota.sentCount ?? 0} />
                        <StatBox label="Remaining" value={stats?.quota.remaining ?? 0} />
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                quotaUsedPct >= 90 ? "bg-rose-500" : quotaUsedPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${quotaUsedPct}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">{quotaUsedPct.toFixed(0)}% of daily cap used</p>
                </CardContent>
            </Card>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Message Activity</h3>
                            <p className="text-xs text-slate-500 mt-0.5">From the Conversations sheet</p>
                        </div>
                        <Send className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatBox label="Total Messages" value={stats?.totalMessages ?? 0} />
                        <StatBox label="Unique Conversations" value={stats?.uniqueConversations ?? 0} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function MetricCard({ title, value, icon, iconBg, onClick }: {
    title: string; value: number | string;
    icon: React.ReactNode; iconBg: string; onClick?: () => void;
}) {
    return (
        <Card
            className={cn("border-border bg-white shadow-sm transition-all", onClick && "cursor-pointer hover:shadow-md")}
            onClick={onClick}
        >
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900">{value}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{title}</p>
                </div>
                <div className={cn("p-2.5 rounded-xl shrink-0", iconBg)}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="p-3 bg-slate-50 rounded-lg border border-border text-center">
            <p className="text-lg font-bold text-slate-900">{value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{label}</p>
        </div>
    );
}
