"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    MessageSquare,
    User,
    Bot,
    Link as LinkIcon,
    Check,
    Snowflake,
    Flame,
    Building2,
    Tag,
} from "lucide-react";
import {
    buildConversationTimeline,
    countSentMessages,
    type NormalizedWaLead,
    type LeadType,
} from "@/lib/services/whatsapp-outreach";

const LEAD_TYPE_META: Record<LeadType, { label: string; icon: typeof Flame; className: string }> = {
    hot: { label: 'Hot Lead', icon: Flame, className: 'bg-orange-50 text-orange-700' },
    cold: { label: 'Cold Lead', icon: Snowflake, className: 'bg-blue-50 text-blue-700' },
    hubspot_wa: { label: 'HubSpot WA', icon: Building2, className: 'bg-purple-50 text-purple-700' },
};

interface WhatsAppChatDetailProps {
    lead: NormalizedWaLead | null;
    onClose?: () => void;
    loading?: boolean;
}

export function WhatsAppChatDetail({ lead, onClose, loading = false }: WhatsAppChatDetailProps) {
    const [copied, setCopied] = useState(false);

    const messages = useMemo(() => (lead ? buildConversationTimeline(lead) : []), [lead]);

    const handleCopyLink = () => {
        if (!lead) return;
        const baseUrl = window.location.origin;
        const identifier = lead.id || lead.phone;
        const phone = encodeURIComponent(identifier);
        const source = encodeURIComponent(lead.table);
        const shareUrl = `${baseUrl}/share/chat/${phone}?source=${source}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="font-medium">Fetching conversation history...</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="font-medium">Lead not found</p>
                {onClose && <Button variant="outline" onClick={onClose}>Close</Button>}
            </div>
        );
    }

    const typeMeta = LEAD_TYPE_META[lead.leadType];
    const TypeIcon = typeMeta.icon;

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 pr-12">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{lead.fullName}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{lead.phone}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={`hover:bg-inherit border-none text-[10px] font-bold uppercase gap-1 ${typeMeta.className}`}>
                        <TypeIcon className="h-3 w-3" />
                        {typeMeta.label}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 text-[10px] font-black uppercase transition-all border shadow-sm ${
                            copied
                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                : 'text-red-600 border-red-300 bg-red-50 hover:bg-red-100 hover:text-red-700 hover:border-red-400 ring-1 ring-red-100/50'
                        }`}
                        onClick={handleCopyLink}
                    >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                        {copied ? 'Link Copied!' : 'Share Link'}
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                {/* Chat timeline */}
                <div className="lg:col-span-2 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden h-full min-h-0">
                    <div className="bg-slate-50/50 border-b border-border p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversation Timeline</h3>
                        <div className="text-[10px] text-slate-400 font-bold">{messages.length} Messages</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                <MessageSquare className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No WhatsApp messages found for this lead.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const tsPill = msg.type === 'bot' && msg.status ? renderStatusPill(String(msg.status)) : null;

                                return (
                                    <div key={idx} className={`flex flex-col ${msg.type === 'user' ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.type === 'user'
                                            ? 'bg-slate-50 text-slate-800 border border-border rounded-tl-none'
                                            : 'bg-emerald-600 text-white rounded-tr-none'
                                            }`}>
                                            <div className="flex items-center justify-between mb-2 gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${msg.type === 'user' ? 'text-slate-400' : 'text-emerald-100'}`}>
                                                    {msg.label}
                                                </span>
                                                {tsPill}
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                                {msg.content}
                                            </p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                                                {new Date(msg.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 h-full pb-4">
                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact info</span>
                                    <p className="font-medium text-slate-900 mt-1">{lead.phone}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Source Table</span>
                                    <p className="font-bold text-blue-600 mt-1 text-xs">{lead.table}</p>
                                </div>
                                {lead.lifecycleStage && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Lifecycle Stage</span>
                                        <Badge className="mt-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[10px] font-bold uppercase block w-fit">
                                            {lead.lifecycleStage}
                                        </Badge>
                                    </div>
                                )}
                                {lead.leadClassification && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Tag className="h-3 w-3" /> Lead Classification
                                        </span>
                                        <Badge className="mt-1 bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] font-bold uppercase block w-fit">
                                            {lead.leadClassification}
                                        </Badge>
                                        {lead.leadClassificationReason && (
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{lead.leadClassificationReason}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900">Activity Stats</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <StatBox label="Total Messages" value={messages.length} icon={MessageSquare} />
                                <StatBox label="Incoming" value={messages.filter(m => m.type === 'user').length} icon={User} />
                                <StatBox label="Outgoing" value={messages.filter(m => m.type === 'bot').length} icon={Bot} />
                                <StatBox label="Drip Sequence Sent" value={countSentMessages(lead)} icon={Bot} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function renderStatusPill(status: string) {
    const raw = String(status);
    const main = raw.split(' - ')[0].trim();

    let label = 'SENT';
    const s = raw.toLowerCase();
    if (s.includes('failed')) label = 'FAILED';
    else if (s.includes('read')) label = 'READ';
    else if (s.includes('delivered')) label = 'DELIVERED';
    else if (s.includes('sent')) label = 'SENT';
    else if (main) label = main.toUpperCase();

    let cls = 'bg-emerald-500/30 text-emerald-100';
    if (label === 'FAILED') cls = 'bg-red-400/40 text-red-100';
    else if (label === 'READ') cls = 'bg-blue-400/40 text-blue-100';
    else if (label === 'DELIVERED') cls = 'bg-emerald-500/30 text-emerald-100';
    else if (label === 'SENT') cls = 'bg-white/20 text-emerald-50';

    return (
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cls}`}>
            {label}
        </span>
    );
}

function StatBox({ label, value, icon: Icon }: any) {
    return (
        <div className="p-2 px-3 bg-slate-50 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{value}</span>
        </div>
    );
}
