"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Filter,
    Mail,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    ArrowLeft,
    Reply,
    Clock,
    User,
    Send,
    CheckCircle2,
    XCircle,
    ExternalLink,
    MailOpen,
    Snowflake,
    Flame,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SPLoader } from "@/components/sp-loader";
import type { NormalizedLeadRow, LeadType } from "@/lib/services/email-outreach";

const ITEMS_PER_PAGE = 7;

interface SentEmailEntry {
    id: string;
    leadType: LeadType;
    table: string;
    fullName: string;
    email: string;
    senderEmail: string;
    replied: boolean;
    lastContactedRaw: string | null;
    lastContactedFormatted: string;
    relativeTime: string;
    stages: { stage: number; content: string; status: string | null; hasData: boolean }[];
    stagesSent: number;
}

function buildEntries(leads: NormalizedLeadRow[]): SentEmailEntry[] {
    const entries: SentEmailEntry[] = [];

    leads.forEach((lead) => {
        const sentStages = lead.stages.filter(s => s.content && String(s.content).trim() !== "");
        if (sentStages.length === 0) return;

        const lastContactedRaw = lead.lastContacted || lead.createdAt;
        let lastContactedFormatted = "N/A";
        let relativeTime = "";
        if (lastContactedRaw) {
            try {
                const d = new Date(lastContactedRaw);
                if (!isNaN(d.getTime())) {
                    lastContactedFormatted = format(d, "MMM dd, yyyy • p");
                    relativeTime = formatDistanceToNow(d, { addSuffix: true });
                }
            } catch { }
        }

        entries.push({
            id: lead.id,
            leadType: lead.leadType,
            table: lead.table,
            fullName: lead.fullName,
            email: lead.email,
            senderEmail: lead.senderEmail || "N/A",
            replied: lead.replies.length > 0 || !!lead.replied,
            lastContactedRaw,
            lastContactedFormatted,
            relativeTime,
            stages: lead.stages.map(s => ({
                stage: s.stage,
                content: String(s.content || ""),
                status: s.status,
                hasData: !!s.content && String(s.content).trim() !== "",
            })),
            stagesSent: sentStages.length,
        });
    });

    entries.sort((a, b) => {
        const da = a.lastContactedRaw ? new Date(a.lastContactedRaw).getTime() : 0;
        const db = b.lastContactedRaw ? new Date(b.lastContactedRaw).getTime() : 0;
        return db - da;
    });

    return entries;
}

export default function SentEmailsPage() {
    const [page, setPage] = useState(1);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [coldLeads, setColdLeads] = useState<NormalizedLeadRow[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedLeadRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStage, setFilterStage] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterType, setFilterType] = useState<"all" | LeadType>("all");

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/email/outreach`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
        } catch (err) {
            console.error("Error fetching sent emails:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const sentEmails = useMemo(() => buildEntries([...coldLeads, ...hotLeads]), [coldLeads, hotLeads]);

    const filteredEmails = useMemo(() => {
        return sentEmails.filter((entry) => {
            if (filterType !== "all" && entry.leadType !== filterType) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (
                    !entry.fullName.toLowerCase().includes(q) &&
                    !entry.email.toLowerCase().includes(q) &&
                    !entry.senderEmail.toLowerCase().includes(q)
                )
                    return false;
            }

            if (dateRange?.from) {
                const ed = entry.lastContactedRaw ? new Date(entry.lastContactedRaw) : null;
                if (!ed || isNaN(ed.getTime())) return false;
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                if (ed < from || ed > to) return false;
            }

            if (filterStage !== "all") {
                const stageIdx = parseInt(filterStage) - 1;
                if (stageIdx >= 0 && stageIdx < 6) {
                    if (!entry.stages[stageIdx]?.hasData) return false;
                }
            }

            if (filterStatus === "replied" && !entry.replied) return false;
            if (filterStatus === "no_reply" && entry.replied) return false;

            return true;
        });
    }, [sentEmails, searchQuery, dateRange, filterStage, filterStatus, filterType]);

    const stats = useMemo(() => {
        const contacted = filteredEmails.length;
        const sent = filteredEmails.reduce((sum, e) => sum + e.stagesSent, 0);
        const replied = filteredEmails.filter(e => e.replied).length;
        return {
            contacted,
            sent,
            replied,
            replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
        };
    }, [filteredEmails]);

    const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
    const paginatedEmails = filteredEmails.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-1">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Sent Emails</h1>
                    <p className="text-[11px] text-slate-500">Email_1 – Email_6 sequences from ENRICHED_LEADS, master_cold_leads & hubspot_lead</p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker
                        className="h-9 w-[240px]"
                        onUpdate={(values) => { setDateRange(values.range); setPage(1); }}
                    />
                </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{loading ? "..." : stats.contacted}</h3>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Contacted</p>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User className="h-4 w-4" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{loading ? "..." : stats.sent}</h3>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Sent</p>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Send className="h-4 w-4" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{loading ? "..." : stats.replied}</h3>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Replies</p>
                        </div>
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><Reply className="h-4 w-4" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{loading ? "..." : `${stats.replyRate}%`}</h3>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Rate</p>
                        </div>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="bg-white p-3 rounded-xl border border-border shadow-sm flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by name, email..."
                        className="pl-9 h-9 bg-slate-50 border-border text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                    <button
                        onClick={() => { setFilterType('all'); setPage(1); }}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/50')}
                    >
                        All
                    </button>
                    <button
                        onClick={() => { setFilterType('cold'); setPage(1); }}
                        className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'cold' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100/50')}
                    >
                        <Snowflake className="h-3 w-3" /> Cold
                    </button>
                    <button
                        onClick={() => { setFilterType('hot'); setPage(1); }}
                        className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'hot' ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-100/50')}
                    >
                        <Flame className="h-3 w-3" /> Hot
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400 mr-2" />

                    <Select value={filterStage} onValueChange={(val) => { setFilterStage(val); setPage(1); }}>
                        <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue placeholder="Email Stage" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Emails</SelectItem>
                            <SelectItem value="1">Email 1</SelectItem>
                            <SelectItem value="2">Email 2</SelectItem>
                            <SelectItem value="3">Email 3</SelectItem>
                            <SelectItem value="4">Email 4</SelectItem>
                            <SelectItem value="5">Email 5</SelectItem>
                            <SelectItem value="6">Email 6</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 h-9 text-xs ml-auto bg-slate-100 hover:bg-slate-200"
                        onClick={() => {
                            setSearchQuery("");
                            setDateRange({ from: subDays(new Date(), 7), to: new Date() });
                            setFilterStage("all");
                            setFilterStatus("all");
                            setFilterType("all");
                            setPage(1);
                        }}
                    >
                        Reset All Filters
                    </Button>
                </div>
            </div>

            {/* Email Cards */}
            <div className="space-y-4">
                {!loading && paginatedEmails.length > 0 ? (
                    paginatedEmails.map((entry) => <SentEmailCard key={`${entry.table}-${entry.id}`} entry={entry} />)
                ) : !loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border border-dashed border-border rounded-xl bg-slate-50/50">
                        <Mail className="h-8 w-8 mb-2 opacity-50" />
                        <p>No emails found matching your filters</p>
                    </div>
                ) : null}
            </div>

            {/* Pagination */}
            {!loading && filteredEmails.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                    <p className="text-sm text-slate-500">
                        Showing{" "}
                        <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span>–
                        <span className="font-medium">{Math.min(page * ITEMS_PER_PAGE, filteredEmails.length)}</span>{" "}
                        of <span className="font-medium">{filteredEmails.length}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="gap-1">
                            <ArrowLeft className="h-4 w-4" /> Previous
                        </Button>
                        <span className="text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="gap-1">
                            Next <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function stripHtml(html: string) {
    if (!html) return "";
    return html.replace(/<(br|p|div|li|h[1-6])[^>]*>/gi, " ").replace(/<\/?[^>]+(>|$)/g, "");
}

/** Email_N_Status values look like "Sent2026-07-30T09:04:13.000+05:30" — a
 *  status word glued directly to an ISO timestamp with no separator. Split
 *  the two apart and format the date into something readable. */
function parseStatus(raw: string | null): { label: string; formattedDate: string | null } {
    if (!raw) return { label: "", formattedDate: null };
    const match = raw.match(/^([A-Za-z /_-]*?)(\d{4}-\d{2}-\d{2}T[\d:.+-]+)$/);
    if (!match) return { label: raw.trim(), formattedDate: null };

    const [, wordPart, isoPart] = match;
    const label = wordPart.trim() || "Sent";
    const d = new Date(isoPart);
    const formattedDate = !isNaN(d.getTime()) ? format(d, "MMM dd, yyyy • p") : null;
    return { label, formattedDate };
}

function SentEmailCard({ entry }: { entry: SentEmailEntry }) {
    const [isOpen, setIsOpen] = useState(false);

    const previewText = entry.stages
        .filter(s => s.hasData)
        .map(s => `Email ${s.stage}`)
        .join(" → ");

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md"
        >
            <CollapsibleTrigger asChild>
                <div className="p-3 cursor-pointer group">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-11 w-11 shrink-0 rounded-full flex items-center justify-center border",
                                entry.replied ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100"
                            )}>
                                {entry.replied ? <Reply className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                            </div>
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base font-bold text-slate-900 truncate max-w-[260px]">{entry.fullName}</h4>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[9px] font-bold uppercase gap-1",
                                            entry.leadType === 'cold' ? "text-blue-600 bg-blue-50 border-blue-200" : "text-orange-600 bg-orange-50 border-orange-200"
                                        )}
                                    >
                                        {entry.leadType === 'cold' ? <Snowflake className="h-2.5 w-2.5" /> : <Flame className="h-2.5 w-2.5" />}
                                        {entry.leadType === 'cold' ? 'Cold' : 'Hot'}
                                    </Badge>
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] tracking-wider font-bold uppercase">
                                        {entry.stagesSent} / 6 Emails
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5">
                                    <div className="flex items-center gap-1.5 min-w-[120px]">
                                        <Mail className="h-3 w-3 text-slate-400" />
                                        <p className="text-[11px] text-slate-500 font-medium truncate">{entry.email}</p>
                                    </div>
                                    {entry.senderEmail && entry.senderEmail !== "N/A" && (
                                        <div className="flex items-center gap-1.5">
                                            <Send className="h-3 w-3 text-slate-400" />
                                            <p className="text-[11px] text-indigo-500 font-medium truncate">From: {entry.senderEmail}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs text-slate-500">{entry.lastContactedFormatted}</span>
                                    {entry.relativeTime && <span className="text-xs text-slate-400">({entry.relativeTime})</span>}
                                </div>

                                {!isOpen && <p className="text-xs text-slate-400 mt-1">{previewText}</p>}
                            </div>
                        </div>
                        <div className="shrink-0">
                            {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />}
                        </div>
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-5 pb-5 pt-0">
                    <div className="pl-[60px] space-y-4 border-t border-border pt-4">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Sequence</p>
                            <div className="space-y-2">
                                {entry.stages.map((stage, idx) => (
                                    <StageRow key={stage.stage} stage={stage} index={idx} isLast={idx === entry.stages.length - 1} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function StageRow({
    stage, index, isLast,
}: {
    stage: { stage: number; content: string; status: string | null; hasData: boolean };
    index: number;
    isLast: boolean;
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const stageLabel = `Email ${stage.stage}`;

    if (!stage.hasData) {
        return (
            <div className="flex items-start gap-3 opacity-40">
                <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-400">{index + 1}</span>
                    </div>
                    {!isLast && <div className="w-px h-4 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 pt-0.5">
                    <span className="text-xs font-semibold text-slate-400">{stageLabel}</span>
                    <span className="text-[10px] text-slate-400 ml-2">— Not sent</span>
                </div>
            </div>
        );
    }

    const processHtml = (html: string) => {
        if (!html) return "";
        return html.replace(/<a\b([^>]*?)>/gi, '<a $1 target="_blank" rel="noopener noreferrer">');
    };

    const stripHtmlContent = stripHtml(stage.content);
    const isDateOnly = !isNaN(new Date(stage.content).getTime()) && stage.content.length < 50;
    const displayContent = isDateOnly ? "Email sent" : stripHtmlContent;

    const { label: statusLabel, formattedDate: statusDate } = parseStatus(stage.status);
    const statusLower = statusLabel.toLowerCase();
    const isFailed = statusLower.includes("fail") || statusLower.includes("bounce") || statusLower.includes("error");

    return (
        <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
                <div className={cn(
                    "h-7 w-7 rounded-full border-2 flex items-center justify-center",
                    isFailed ? "border-rose-400 bg-rose-50" : "border-blue-400 bg-blue-50"
                )}>
                    <span className={cn("text-[10px] font-bold", isFailed ? "text-rose-600" : "text-blue-600")}>{index + 1}</span>
                </div>
                {!isLast && <div className="w-px h-full min-h-[16px] bg-slate-200 mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">{stageLabel}</span>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[9px] font-bold",
                            isFailed ? "text-rose-600 bg-rose-50 border-rose-200" : "text-blue-600 bg-blue-50 border-blue-200"
                        )}
                    >
                        {isFailed ? <XCircle className="h-2.5 w-2.5 mr-1 inline" /> : null}
                        {statusLabel ? statusLabel : "✓ Sent"}
                        {statusDate && <span className="font-normal opacity-70"> | {statusDate}</span>}
                    </Badge>
                </div>

                <div
                    onClick={() => setIsModalOpen(true)}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[13px] text-slate-600 leading-relaxed cursor-pointer hover:bg-slate-100 transition-colors group/content flex items-start justify-between gap-3"
                >
                    <div className="flex-1 overflow-hidden">
                        <p className="line-clamp-2">{displayContent}</p>
                    </div>
                    <div className="shrink-0 pt-1 opacity-0 group-hover/content:opacity-100 transition-opacity">
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white shadow-2xl">
                        <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <MailOpen className="h-5 w-5" />
                                </div>
                                <DialogTitle className="text-lg font-bold text-slate-900">{stageLabel} Content</DialogTitle>
                            </div>
                            <DialogDescription className="sr-only">Full content of the {stageLabel} email.</DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed bg-slate-50/50 p-6 rounded-xl border border-slate-200/60 font-sans">
                                {stage.content.includes("<") ? (
                                    <div dangerouslySetInnerHTML={{ __html: processHtml(stage.content) }} className="email-full-content" />
                                ) : (
                                    <p className="whitespace-pre-wrap">{stage.content}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="h-10 px-6 font-semibold">
                                Close Email
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
