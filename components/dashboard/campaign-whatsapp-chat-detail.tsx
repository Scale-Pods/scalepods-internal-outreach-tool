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
    Tag,
    Building,
    CheckCircle2,
    Flame,
    Sparkles,
} from "lucide-react";
import { CampaignLabel } from "@/components/dashboard/campaign-badge";
import type { CampaignWaLead } from "@/lib/services/campaign-whatsapp";

interface CampaignWhatsAppChatDetailProps {
    lead: CampaignWaLead | null;
    onClose?: () => void;
    loading?: boolean;
}

export function CampaignWhatsAppChatDetail({
    lead,
    onClose,
    loading = false,
}: CampaignWhatsAppChatDetailProps) {
    const [copied, setCopied] = useState(false);

    const messages = useMemo(() => {
        if (!lead) return [];
        if (Array.isArray(lead.timeline) && lead.timeline.length > 0) {
            return lead.timeline.filter(m => m && Boolean(m.content && m.content.trim()));
        }
        // Defensive fallback if only raw conversation is present
        if (Array.isArray(lead.conversation)) {
            return lead.conversation
                .filter((m: any) => m && typeof m === 'object' && (m.direction || m.message_text || m.text || m.sender))
                .map((m: any, idx: number) => {
                    const dir = String(m.direction || '').toLowerCase().trim();
                    const sender = String(m.sender || '').toLowerCase().trim();
                    const isBot =
                        dir === 'outbound' ||
                        dir === 'outgoing' ||
                        sender === '917738558481' ||
                        sender.includes('scalepods');
                    return {
                        id: m.id || `conv-${idx}`,
                        type: (isBot ? 'bot' : 'user') as 'bot' | 'user',
                        label: isBot ? 'AI Bot Reply' : 'Customer Reply',
                        content: String(m.message_text || m.text || m.rendered_text || '').trim(),
                        date: m.timestamp || m.attempted_at || null,
                        status: m.status || (isBot ? 'SENT' : null),
                    };
                })
                .filter(m => Boolean(m.content));
        }
        return [];
    }, [lead]);

    const incomingCount = useMemo(() => messages.filter(m => m.type === 'user').length, [messages]);
    const outgoingCount = useMemo(() => messages.filter(m => m.type === 'bot').length, [messages]);
    const totalCount = incomingCount + outgoingCount;

    const handleCopyPhone = () => {
        if (!lead?.mobileNumber) return;
        navigator.clipboard.writeText(lead.mobileNumber);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="font-medium text-sm">Fetching conversation timeline...</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="font-medium">No lead selected</p>
                {onClose && <Button variant="outline" onClick={onClose}>Close</Button>}
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 flex flex-col h-full overflow-y-auto lg:overflow-hidden max-h-[88dvh]">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pr-8">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight break-words">{lead.fullName}</h2>
                        {lead.isPositive && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold uppercase gap-1">
                                <Sparkles className="h-3 w-3" /> Positive Lead
                            </Badge>
                        )}
                        {lead.isPf && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold uppercase gap-1">
                                <Flame className="h-3 w-3" /> PF Lead
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span>{lead.mobileNumber || 'No phone'}</span>
                        {lead.companyName && (
                            <>
                                <span>•</span>
                                <span className="font-medium text-slate-700">{lead.companyName}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-2 shrink-0">
                    <CampaignLabel
                        campaignId={lead.campaignId}
                        campaignName={lead.campaignName}
                        alias={lead.campaignAlias}
                        showUnassigned
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 text-[10px] font-black uppercase transition-all border shadow-sm ${
                            copied
                                ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                : 'text-slate-600 border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                        onClick={handleCopyPhone}
                    >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                        {copied ? 'Phone Copied!' : 'Copy Phone'}
                    </Button>
                </div>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 lg:overflow-hidden min-h-0">
                {/* Chat Timeline (Col 1 & 2) */}
                <div className="lg:col-span-2 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden min-h-[320px] max-h-[55dvh] lg:max-h-none lg:h-full lg:min-h-0">
                    <div className="bg-slate-50/70 border-b border-border p-3 px-4 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-600" />
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                WhatsApp Conversation
                            </h3>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded border border-border">
                            {totalCount} Messages
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/20">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 py-12">
                                <MessageSquare className="h-10 w-10 opacity-20" />
                                <p className="text-sm font-medium">No WhatsApp messages recorded for this lead.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isUser = msg.type === 'user';
                                const tsPill = !isUser && msg.status ? renderStatusPill(String(msg.status)) : null;
                                const formattedDate = formatMessageDate(msg.date);

                                return (
                                    <div
                                        key={msg.id || idx}
                                        className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl p-4 shadow-sm transition-all ${
                                                isUser
                                                    ? 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                                                    : 'bg-emerald-600 text-white rounded-tr-none'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2 gap-3">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                                                        isUser ? 'text-slate-600' : 'text-emerald-100'
                                                    }`}
                                                >
                                                    {isUser ? (
                                                        <User className="h-3 w-3" />
                                                    ) : (
                                                        <Bot className="h-3 w-3" />
                                                    )}
                                                    {msg.label}
                                                </span>
                                                {tsPill}
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                                {msg.content}
                                            </p>
                                        </div>
                                        {formattedDate && (
                                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                                                {formattedDate}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Sidebar (Col 3) */}
                <div className="lg:col-span-1 space-y-4 lg:overflow-y-auto lg:pr-1 lg:h-full pb-2 sm:pb-4">
                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</span>
                                    <p className="font-medium text-slate-900 mt-0.5">{lead.mobileNumber || '-'}</p>
                                </div>
                                {lead.email && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                                        <p className="font-medium text-slate-900 mt-0.5 truncate">{lead.email}</p>
                                    </div>
                                )}
                                {lead.companyName && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Company</span>
                                        <div className="font-medium text-slate-900 mt-0.5 flex items-center gap-1.5">
                                            <Building className="h-3.5 w-3.5 text-slate-400" /> {lead.companyName}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Campaign</span>
                                    <div className="mt-1">
                                        <CampaignLabel
                                            campaignId={lead.campaignId}
                                            campaignName={lead.campaignName}
                                            alias={lead.campaignAlias}
                                            showUnassigned
                                        />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Status</span>
                                    <div className="font-semibold text-xs mt-0.5">
                                        <Badge variant="outline" className="uppercase font-bold text-[10px]">
                                            {lead.whatsappStatus || 'None'}
                                        </Badge>
                                    </div>
                                </div>
                                {lead.leadClassification && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                            <Tag className="h-3 w-3" /> Classification
                                        </span>
                                        <Badge className="mt-1 bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold uppercase block w-fit">
                                            {lead.leadClassification}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Activity Stats
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                <StatBox label="Total Messages" value={totalCount} icon={MessageSquare} />
                                <StatBox
                                    label="Incoming Replies"
                                    value={incomingCount}
                                    icon={User}
                                />
                                <StatBox
                                    label="Outgoing Bot Messages"
                                    value={outgoingCount}
                                    icon={Bot}
                                />
                                <StatBox label="Reply Status" value={lead.hasReplied ? 'Replied' : 'No Reply'} icon={CheckCircle2} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function formatMessageDate(rawDate: string | null | undefined): string {
    if (!rawDate) return '';
    let str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function renderStatusPill(status: string) {
    const raw = String(status).toUpperCase();
    let label = 'SENT';
    if (raw.includes('FAILED')) label = 'FAILED';
    else if (raw.includes('BLOCKED')) label = 'BLOCKED';
    else if (raw.includes('READ')) label = 'READ';
    else if (raw.includes('DELIVERED')) label = 'DELIVERED';
    else if (raw.includes('REPLIED')) label = 'REPLIED';

    let cls = 'bg-white/20 text-emerald-50';
    if (label === 'FAILED') cls = 'bg-red-400/40 text-red-100';
    else if (label === 'BLOCKED') cls = 'bg-amber-400/40 text-amber-100';
    else if (label === 'READ') cls = 'bg-blue-400/40 text-blue-100';
    else if (label === 'DELIVERED') cls = 'bg-emerald-500/30 text-emerald-100';
    else if (label === 'REPLIED') cls = 'bg-cyan-400/40 text-cyan-100';

    return (
        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cls}`}>
            ✓✓ {label}
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

