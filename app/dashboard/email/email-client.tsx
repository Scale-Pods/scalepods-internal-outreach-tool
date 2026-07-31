"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Mail, Send, RefreshCw, Users,
    Reply, Percent, XCircle, UserMinus, Snowflake, Flame,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import type { OutreachMetrics } from "@/lib/services/email-outreach";

export default function EmailDashboardClient({
    cold,
    hot,
}: {
    cold: OutreachMetrics;
    hot: OutreachMetrics;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setLoading(true);
            const from = new Date(range.range.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(range.range.to || range.range.from);
            to.setHours(23, 59, 59, 999);

            const params = new URLSearchParams(searchParams.toString());
            params.set('from', from.toISOString());
            params.set('to', to.toISOString());
            router.push(`?${params.toString()}`);
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        router.refresh();
        setTimeout(() => setLoading(false), 500);
    };

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Outreach Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Cold outreach (ENRICHED_LEADS + Master Cold Leads) and Hot CRM outreach (HubSpot) performance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                    <Button variant="outline" size="sm" className="gap-2 h-10" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Cold Outreach Row */}
            <OutreachSection
                title="Cold Outreach Bot"
                subtitle="Sources: ENRICHED_LEADS + master_cold_leads"
                icon={<Snowflake className="h-5 w-5" />}
                iconBg="bg-blue-50 text-blue-600"
                metrics={cold}
            />

            {/* Hot CRM Outreach Row */}
            <OutreachSection
                title="Hot CRM Outreach Bot"
                subtitle="Source: hubspot_lead"
                icon={<Flame className="h-5 w-5" />}
                iconBg="bg-orange-50 text-orange-600"
                metrics={hot}
            />
        </div>
    );
}

function OutreachSection({
    title, subtitle, icon, iconBg, metrics,
}: {
    title: string; subtitle: string; icon: React.ReactNode; iconBg: string; metrics: OutreachMetrics;
}) {
    const router = useRouter();
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", iconBg)}>{icon}</div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard
                    title="Contacted Leads"
                    value={metrics.contactedLeads}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Emails Sent"
                    value={metrics.emailsSent}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Replies"
                    value={metrics.repliedLeads}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/email/received')}
                />
                <MetricCard
                    title="Reply Rate"
                    value={`${metrics.replyRate.toFixed(1)}%`}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                    onClick={() => router.push('/dashboard/email/received')}
                />
                <MetricCard
                    title="Bounced"
                    value={metrics.bouncedLeads}
                    icon={<XCircle className="h-5 w-5" />}
                    iconBg="bg-rose-50 text-rose-600"
                    onClick={() => router.push('/dashboard/email/bounces')}
                />
                <MetricCard
                    title="Unsubscribed"
                    value={metrics.unsubscribedLeads}
                    icon={<UserMinus className="h-5 w-5" />}
                    iconBg="bg-amber-50 text-amber-600"
                    onClick={() => router.push('/dashboard/email/unsubscribed')}
                />
            </div>

            {/* Sequence Breakdown */}
            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Sequence Breakdown</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Email_1 – Email_6 stage distribution</p>
                        </div>
                        <Mail className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="space-y-3">
                        {metrics.stageSentCounts.map((count, idx) => {
                            const num = idx + 1;
                            const pct = metrics.emailsSent > 0 ? (count / metrics.emailsSent) * 100 : 0;
                            return (
                                <div key={num} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-slate-500 w-16">Email {num}</span>
                                    <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden relative">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500",
                                                num <= 2 ? "bg-blue-500" : num <= 4 ? "bg-violet-500" : "bg-indigo-500"
                                            )}
                                            style={{ width: `${Math.max(pct, 0)}%` }}
                                        />
                                        {count > 0 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                                                {count} ({pct.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
