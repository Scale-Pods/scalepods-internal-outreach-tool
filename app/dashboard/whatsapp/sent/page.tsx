"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCheck, Clock, XCircle, Search, Snowflake, Flame, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useMemo } from "react";
import { SPLoader } from "@/components/sp-loader";
import { subDays } from "date-fns";
import type { NormalizedWaLead, LeadType } from "@/lib/services/whatsapp-outreach";

const LEAD_TYPE_META: Record<LeadType, { label: string; icon: typeof Flame; className: string }> = {
    hot: { label: 'Hot', icon: Flame, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    cold: { label: 'Cold', icon: Snowflake, className: 'bg-blue-50 text-blue-700 border-blue-100' },
    hubspot_wa: { label: 'HubSpot WA', icon: Building2, className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

interface SentWaMessage {
    id: string;
    leadType: LeadType;
    recipient: string;
    message: string;
    status: string;
    time: string;
    rawDate: Date;
}

function buildMessages(leads: NormalizedWaLead[]): { messages: SentWaMessage[]; delivered: number; read: number; failed: number } {
    const messages: SentWaMessage[] = [];
    let delivered = 0, read = 0, failed = 0;

    leads.forEach(lead => {
        const pushMessage = (message: string, statusRaw: string | null | undefined, dateRaw: any, key: string) => {
            const statusKey = String(statusRaw || '').toLowerCase();
            let norm = "Delivered";
            if (statusKey.includes("failed")) { norm = "Failed"; failed++; }
            else if (statusKey.includes("read")) { norm = "Read"; read++; delivered++; }
            else { delivered++; }

            const d = dateRaw ? new Date(dateRaw) : (lead.createdAt ? new Date(lead.createdAt) : new Date());
            messages.push({
                id: `${lead.table}-${lead.id}-${key}`,
                leadType: lead.leadType,
                recipient: lead.fullName,
                message: String(message || '').trim(),
                status: norm,
                time: !isNaN(d.getTime()) ? d.toLocaleTimeString() : "Unknown",
                rawDate: d,
            });
        };

        // Whatsapp_1..6 drip messages
        lead.stages.forEach(s => {
            if (!s.content || !String(s.content).trim()) return;
            pushMessage(s.content, s.status, lead.lastContacted, `wa${s.stage}`);
        });

        // wa_conversation outbound bot messages
        lead.conversation.forEach((m, idx) => {
            if (m.role !== 'bot' && m.direction !== 'outbound') return;
            if (!m.message) return;
            pushMessage(m.message, m.status || m.status_updated_at, m.timestamp || m.status_updated_at, `conv${idx}`);
        });
    });

    messages.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    return { messages, delivered, read, failed };
}

export default function WhatsappSentPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedWaLead[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedWaLead[]>([]);
    const [hubspotWaLeads, setHubspotWaLeads] = useState<NormalizedWaLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date()
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/whatsapp/outreach`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
            setHubspotWaLeads(json.hubspotWa?.leads || []);
        } catch (e) {
            console.error("WhatsApp sent fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const dateFilteredLeads = useMemo(() => {
        const all = [...coldLeads, ...hotLeads, ...hubspotWaLeads];
        if (!dateRange?.from) return all;
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = dateRange.to ? new Date(dateRange.to) : from;
        to.setHours(23, 59, 59, 999);

        return all.filter(lead => {
            const wlc = lead.lastContacted || lead.createdAt;
            if (!wlc) return false;
            const d = new Date(wlc);
            if (isNaN(d.getTime())) return false;
            return d >= from && d <= to;
        });
    }, [coldLeads, hotLeads, hubspotWaLeads, dateRange]);

    const { messages, delivered, read, failed } = useMemo(() => buildMessages(dateFilteredLeads), [dateFilteredLeads]);

    const filteredMessages = messages.filter(msg =>
        msg.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <SPLoader />;

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Total Sent Messages</h1>
                    <p className="text-slate-500">Outbound WhatsApp messages from ENRICHED_LEADS, hubspot_lead & hubspot_wa_outreach</p>
                </div>
                <DateRangePicker onUpdate={(val) => setDateRange(val.range)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Total Sent" value={messages.length.toLocaleString()} icon={<Send className="h-4 w-4" />} color="text-blue-600" bg="bg-blue-50" />
                <StatCard title="Delivered" value={delivered.toLocaleString()} icon={<CheckCheck className="h-4 w-4" />} color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard title="Read" value={read.toLocaleString()} icon={<CheckCheck className="h-4 w-4 text-blue-500" />} color="text-amber-600" bg="bg-amber-50" />
                <StatCard title="Failed" value={failed.toLocaleString()} icon={<XCircle className="h-4 w-4" />} color="text-rose-600" bg="bg-rose-50" />
            </div>

            <Card className="border-border">
                <CardHeader className="border-border border-border flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-lg">Message History</CardTitle>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input className="pl-10 h-9" placeholder="Search recipients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="p-0 relative min-h-[300px]">
                    <div className="divide-y divide-border">
                        {filteredMessages.length > 0 ? (
                            filteredMessages.map((msg) => (
                                <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-950">{msg.recipient}</p>
                                            {(() => {
                                                const meta = LEAD_TYPE_META[msg.leadType];
                                                const Icon = meta.icon;
                                                return (
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold gap-1 ${meta.className}`}>
                                                        <Icon className="h-2.5 w-2.5" />
                                                        {meta.label}
                                                    </Badge>
                                                );
                                            })()}
                                        </div>
                                        <p className="text-sm text-slate-600 max-w-xl">{msg.message}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">{msg.time}</span>
                                            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${msg.status === 'Read' ? 'text-blue-500' :
                                                msg.status === 'Delivered' ? 'text-emerald-500' :
                                                    msg.status === 'Failed' ? 'text-rose-500' : 'text-slate-400'
                                                }`}>
                                                {(msg.status === 'Read' || msg.status === 'Delivered') && <CheckCheck className="h-3 w-3" />}
                                                {msg.status === 'Failed' && <XCircle className="h-3 w-3" />}
                                                {msg.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center text-slate-400">
                                No messages found.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon, color, bg }: any) {
    return (
        <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg} ${color}`}>{icon}</div>
                <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                    <p className="text-xl font-bold text-slate-900">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
