"use client";

import { SPLoader } from "@/components/sp-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    Send,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    AlertCircle,
    Activity,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
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
        <div className="space-y-3 pb-10 pt-2 relative min-h-[500px] px-2 md:px-0">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-1">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Warm-up Analytics</h1>
                    <p className="text-[11px] text-slate-500">Monitor email account health and deliverability</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Select value={selectedEmail} onValueChange={setSelectedEmail}>
                        <SelectTrigger className="w-full sm:w-[240px] h-9 text-xs">
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
                    <Button
                        onClick={() => fetchData()}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 text-xs font-semibold gap-2 border-slate-200"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
                        Refresh
                    </Button>
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
                    <Card className="overflow-hidden border-border shadow-sm">
                        <div className="border-b border-border bg-slate-50/30 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold text-base shadow-sm">
                                    {selectedAccount.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">{selectedAccount.email}</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Account Deliverability Status</p>
                                </div>
                            </div>
                            <StatusBadge status={selectedAccount.status} score={selectedAccount.health_score} />
                        </div>

                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
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
                                <div className="h-[320px] w-full mt-4">
                                    <h4 className="text-sm font-bold text-slate-900 mb-4 px-1 uppercase tracking-wider">Historical Delivery Trend</h4>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedAccount.history} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
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
        <Badge variant="outline" className={cn("px-3 py-1 text-[11px] font-bold border rounded-full", colorClass)}>
            {status} ({score}%)
        </Badge>
    );
}

function MiniMetric({ label, value, subtext, icon: Icon, color, bg }: any) {
    return (
        <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-white border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{label}</span>
                <div className={cn("p-1.5 rounded-full", bg, color)}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900 tracking-tight">{value}</span>
                {subtext && <span className="text-[10px] font-bold text-slate-500">{subtext}</span>}
            </div>
        </div>
    );
}
