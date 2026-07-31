"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Users, MessageCircle, Send,
    Reply, Percent, XCircle, Snowflake, Flame,
} from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SPLoader } from "@/components/sp-loader";
import type { WaMetrics } from "@/lib/services/whatsapp-outreach";

export default function WhatsappDashboardClient({
    cold,
    hot,
}: {
    cold: WaMetrics;
    hot: WaMetrics;
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

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px] px-6">
            {loading && <SPLoader />}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Outreach Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Cold outreach (ENRICHED_LEADS) and Hot CRM outreach (hubspot_lead) WhatsApp performance
                    </p>
                </div>
                <DateRangePicker onUpdate={handleDateUpdate} />
            </div>

            <WaSection
                title="Cold Outreach Bot"
                subtitle="Source: ENRICHED_LEADS"
                icon={<Snowflake className="h-5 w-5" />}
                iconBg="bg-blue-50 text-blue-600"
                metrics={cold}
            />

            <WaSection
                title="Hot CRM Outreach Bot"
                subtitle="Source: hubspot_lead"
                icon={<Flame className="h-5 w-5" />}
                iconBg="bg-orange-50 text-orange-600"
                metrics={hot}
            />
        </div>
    );
}

function WaSection({
    title, subtitle, icon, iconBg, metrics,
}: {
    title: string; subtitle: string; icon: React.ReactNode; iconBg: string; metrics: WaMetrics;
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <MetricCard
                    title="Contacted Leads"
                    value={metrics.contactedLeads}
                    icon={<Users className="h-5 w-5" />}
                    iconBg="bg-indigo-50 text-indigo-600"
                    onClick={() => router.push('/dashboard/whatsapp/leads')}
                />
                <MetricCard
                    title="Messages Sent"
                    value={metrics.messagesSent}
                    icon={<Send className="h-5 w-5" />}
                    iconBg="bg-blue-50 text-blue-600"
                    onClick={() => router.push('/dashboard/whatsapp/sent')}
                />
                <MetricCard
                    title="Total Replies"
                    value={metrics.repliedLeads}
                    icon={<Reply className="h-5 w-5" />}
                    iconBg="bg-emerald-50 text-emerald-600"
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricCard
                    title="Reply Rate"
                    value={`${metrics.replyRate.toFixed(1)}%`}
                    icon={<Percent className="h-5 w-5" />}
                    iconBg="bg-violet-50 text-violet-600"
                />
                <MetricCard
                    title="Failed"
                    value={metrics.failedMessages}
                    icon={<XCircle className="h-5 w-5" />}
                    iconBg="bg-rose-50 text-rose-600"
                />
            </div>

            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Sequence Breakdown</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Whatsapp_1 – Whatsapp_6 stage distribution</p>
                        </div>
                        <MessageCircle className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="space-y-3">
                        {metrics.stageSentCounts.map((count, idx) => {
                            const num = idx + 1;
                            const pct = metrics.messagesSent > 0 ? (count / metrics.messagesSent) * 100 : 0;
                            return (
                                <div key={num} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-slate-500 w-20">Msg {num}</span>
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
