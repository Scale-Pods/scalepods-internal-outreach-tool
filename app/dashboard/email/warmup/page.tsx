"use client";

import { SPLoader } from "@/components/sp-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Send,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    AlertCircle,
    Activity,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface HistoryData {
    date: string;
    sent: number;
    inbox: number;
    spam: number;
}

interface WarmupData {
    email: string;
    total_sent: number;
    landed_inbox: number;
    landed_spam: number;
    received: number;
    health_score: number;
    health_label: string;
    inbox_rate: number;
    spam_rate: number;
    status: "Healthy" | "Medium" | "Poor";
    history?: HistoryData[];
}

const ALL_TARGET_EMAILS = [
    "adnan@scalepods.co",
    "adnan@scalepods.org",
    "nancy@scalepods.co",
    "palashy@scalepods.org",
    "raunak@scalepods.co",
    "raunak@scalepods.tech",
    "tanushree@scalepods.co",
    "viraj@scalepods.co",
    "viraj@scalepods.tech",
];

const EMPTY_WARMUP: WarmupData = {
    email: "",
    total_sent: 0,
    landed_inbox: 0,
    landed_spam: 0,
    received: 0,
    health_score: 0,
    health_label: "0%",
    inbox_rate: 0,
    spam_rate: 0,
    status: "Poor",
    history: [],
};

export default function WarmupAnalyticsPage() {
    const [warmupData, setWarmupData] = useState<WarmupData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEmail, setSelectedEmail] = useState<string>(ALL_TARGET_EMAILS[0]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const warmupRes = await fetch('/api/email/warmup-analytics', { method: 'POST' });
            let warmupJson = [];
            if (warmupRes.ok) {
                warmupJson = await warmupRes.json();
            } else {
                throw new Error("Failed to fetch warmup analytics");
            }

            const apiEmails = new Set((warmupJson || []).map((w: WarmupData) => w.email));
            const missingAccounts: WarmupData[] = ALL_TARGET_EMAILS
                .filter(email => !apiEmails.has(email))
                .map(email => ({ ...EMPTY_WARMUP, email, status: "Poor" as const }));

            setWarmupData([...warmupJson, ...missingAccounts].sort((a: WarmupData, b: WarmupData) => a.email.localeCompare(b.email)));
        } catch (e: any) {
            console.error("Warmup fetch error", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const selectedAccount = warmupData.find(a => a.email === selectedEmail) || warmupData[0] || null;

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Warm-up Analytics</h1>
                    <p className="text-sm text-slate-500 mt-1">Monitor email account health and deliverability</p>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <Select value={selectedEmail} onValueChange={setSelectedEmail}>
                        <SelectTrigger className="w-[280px]">
                            <SelectValue placeholder="Select email account" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_TARGET_EMAILS.map((email) => (
                                <SelectItem key={email} value={email}>
                                    {email}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <button
                        onClick={() => fetchData()}
                        disabled={loading}
                        className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw className={cn("h-4 w-4 text-slate-500", loading && "animate-spin")} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!loading && warmupData.length === 0 && !error && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Warm-up Data</AlertTitle>
                    <AlertDescription>No warm-up data found for the configured emails.</AlertDescription>
                </Alert>
            )}

            {selectedAccount && !loading && (
                <div className="space-y-4">
                    <Card className="overflow-hidden border-border">
                        <div className="border-b border-border bg-slate-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {selectedAccount.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{selectedAccount.email}</h3>
                                    <p className="text-sm text-slate-500">Account Deliverability Status</p>
                                </div>
                            </div>
                            <StatusBadge status={selectedAccount.status} score={selectedAccount.health_score} />
                        </div>

                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                                <MiniMetric
                                    label="Health Score"
                                    value={`${selectedAccount.health_score}/100`}
                                    subtext={selectedAccount.health_label}
                                    icon={Activity}
                                    color="text-indigo-600"
                                    bg="bg-indigo-50"
                                />
                                <MiniMetric
                                    label="Inbox Rate"
                                    value={`${selectedAccount.inbox_rate}%`}
                                    icon={CheckCircle2}
                                    color="text-emerald-600"
                                    bg="bg-emerald-50"
                                />
                                <MiniMetric
                                    label="Spam Rate"
                                    value={`${selectedAccount.spam_rate}%`}
                                    icon={AlertTriangle}
                                    color="text-rose-600"
                                    bg="bg-rose-50"
                                />
                                <MiniMetric
                                    label="Emails Sent"
                                    value={selectedAccount.total_sent}
                                    icon={Send}
                                    color="text-blue-600"
                                    bg="bg-blue-50"
                                />
                                <MiniMetric
                                    label="Landed Inbox"
                                    value={selectedAccount.landed_inbox}
                                    icon={ShieldCheck}
                                    color="text-emerald-600"
                                    bg="bg-emerald-50"
                                />
                                <MiniMetric
                                    label="Landed Spam"
                                    value={selectedAccount.landed_spam}
                                    icon={AlertCircle}
                                    color="text-amber-600"
                                    bg="bg-amber-50"
                                />
                            </div>

                            {selectedAccount.history && selectedAccount.history.length > 0 ? (
                                <div className="h-[400px] w-full mt-8">
                                    <h4 className="text-base font-bold text-slate-900 mb-6">Historical Delivery Trend</h4>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedAccount.history} margin={{ top: 20, right: 60, left: 10, bottom: 30 }}>
                                            <defs>
                                                <linearGradient id={`colorInbox-${selectedAccount.email}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id={`colorSent-${selectedAccount.email}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                                tickFormatter={(str) => {
                                                    const date = new Date(str);
                                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                                }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 12, fill: '#64748b' }}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            />
                                            <Legend iconType="circle" verticalAlign="top" height={36} />
                                            <Area
                                                type="monotone"
                                                dataKey="sent"
                                                name="Emails Sent"
                                                stroke="#3b82f6"
                                                fillOpacity={1}
                                                fill={`url(#colorSent-${selectedAccount.email})`}
                                                strokeWidth={3}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="inbox"
                                                name="Landed in Inbox"
                                                stroke="#10b981"
                                                fillOpacity={1}
                                                fill={`url(#colorInbox-${selectedAccount.email})`}
                                                strokeWidth={3}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[300px] w-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-8">
                                    <div className="flex flex-col items-center text-center">
                                        <Activity className="h-10 w-10 text-slate-300 mb-3" />
                                        <p className="text-sm font-medium text-slate-500">No historical trend data available</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {loading && <SPLoader />}
        </div>
    );
}

function StatusBadge({ status, score }: { status: string, score: number }) {
    let colorClass = "bg-slate-100 text-slate-700 hover:bg-slate-100";
    if (status === "Healthy") colorClass = "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200";
    else if (status === "Medium") colorClass = "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200";
    else if (status === "Poor") colorClass = "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200";

    return (
        <Badge variant="outline" className={cn("px-4 py-1.5 text-sm font-bold border", colorClass)}>
            {status} ({score}%)
        </Badge>
    );
}

function MiniMetric({ label, value, subtext, icon: Icon, color, bg }: any) {
    return (
        <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-white border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</span>
                <div className={cn("p-2 rounded-full", bg, color)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{value}</span>
                {subtext && <span className="text-xs font-semibold text-slate-500">{subtext}</span>}
            </div>
        </div>
    );
}
