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
    CheckCircle2,
    XCircle,
    Send,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, formatDistanceToNow } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";
import { SPLoader } from "@/components/sp-loader";

const ITEMS_PER_PAGE = 7;
const EMAIL_STAGES = ["Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6"] as const;

interface EmailStageInfo {
    stage: string;
    content: string;
    hasData: boolean;
    stoppedByReply: boolean;
}

interface SentEmailEntry {
    id: string;
    fullName: string;
    email: string;
    senderEmail: string;
    replied: boolean;
    lastContactedRaw: string | null;
    lastContactedFormatted: string;
    relativeTime: string;
    stages: EmailStageInfo[];
    /** How many stages actually had outreach sent */
    stagesSent: number;
    /** The stage where reply happened (last stage with data before stop) */
    repliedAfterStage: string | null;
}

export default function SentEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [page, setPage] = useState(1);
    const [dateRange, setDateRange] = useState<any>(undefined);
    const [sentEmails, setSentEmails] = useState<SentEmailEntry[]>([]);
    const loading = loadingLeads;
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStage, setFilterStage] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");

    useEffect(() => {
        if (loadingLeads) return;

        const entries: SentEmailEntry[] = [];

        allLeads.forEach((lead: any, leadIndex: number) => {
            const fullName = String(lead.name || lead["Full Name"] || lead.full_name || "Unknown Lead");
            const email = String(lead.email || lead["Email"] || "No Email");
            const senderEmail = String(lead.sender_email || lead["SENDERS  EMAIL"] || lead["Senders email"] || "");
            const repliedRaw = String(lead.replied || lead["Replied"] || lead.email_replied || "No");
            const hasReplied = repliedRaw.toLowerCase() === "yes";

            // Get the Email Last Contacted timestamp
            const lastContactedRaw = lead.last_contacted || lead["Email Last Contacted"] || lead.created_at || null;
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

            // Build stages array
            const stages: EmailStageInfo[] = [];
            let repliedAfterStage: string | null = null;
            let foundReplyStop = false;
            let stagesSent = 0;

            for (const stageKey of EMAIL_STAGES) {
                const rawValue = lead.stage_data?.[stageKey] || lead[stageKey];
                const hasData = rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";

                if (foundReplyStop) {
                    // After reply, all subsequent stages are stopped
                    stages.push({
                        stage: stageKey,
                        content: "",
                        hasData: false,
                        stoppedByReply: true,
                    });
                    continue;
                }

                if (hasData) {
                    stagesSent++;
                    let content = String(rawValue).trim();

                    // Check if this is the stage where reply happened
                    // If lead has replied and next stage has no data, this is the last stage
                    stages.push({
                        stage: stageKey,
                        content,
                        hasData: true,
                        stoppedByReply: false,
                    });

                    // If the lead has replied, check if the NEXT stage has data
                    if (hasReplied) {
                        const currentIdx = EMAIL_STAGES.indexOf(stageKey);
                        const nextStageKey = EMAIL_STAGES[currentIdx + 1];
                        const nextVal = nextStageKey ? (lead.stage_data?.[nextStageKey] || lead[nextStageKey]) : undefined;
                        const nextHasData = nextVal !== undefined && nextVal !== null && String(nextVal).trim() !== "";

                        if (!nextHasData) {
                            // Reply happened after this stage, stop here
                            repliedAfterStage = stageKey;
                            foundReplyStop = true;
                        }
                    }
                } else {
                    // No data and no reply stop — just an empty stage
                    stages.push({
                        stage: stageKey,
                        content: "",
                        hasData: false,
                        stoppedByReply: false,
                    });
                }
            }

            // Only include leads that have at least one email stage sent
            if (stagesSent > 0) {
                entries.push({
                    id: String(lead.id || `lead-${leadIndex}`),
                    fullName,
                    email,
                    senderEmail,
                    replied: hasReplied,
                    lastContactedRaw,
                    lastContactedFormatted,
                    relativeTime,
                    stages,
                    stagesSent,
                    repliedAfterStage,
                });
            }
        });

        // Sort by last contacted (newest first)
        entries.sort((a, b) => {
            const da = a.lastContactedRaw ? new Date(a.lastContactedRaw).getTime() : 0;
            const db = b.lastContactedRaw ? new Date(b.lastContactedRaw).getTime() : 0;
            return db - da;
        });

        setSentEmails(entries);
    }, [allLeads, loadingLeads]);

    // Compute stats
    const stats = useMemo(() => {
        const total = sentEmails.length;
        const replied = sentEmails.filter(e => e.replied).length;
        const totalStagesSent = sentEmails.reduce((sum, e) => sum + e.stagesSent, 0);
        const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;
        return { total, replied, totalStagesSent, replyRate };
    }, [sentEmails]);

    const filteredEmails = useMemo(() => {
        return sentEmails.filter((entry) => {
            // Search
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (
                    !entry.fullName.toLowerCase().includes(q) &&
                    !entry.email.toLowerCase().includes(q) &&
                    !entry.senderEmail.toLowerCase().includes(q)
                )
                    return false;
            }

            // Date range filter using lastContactedRaw
            if (dateRange?.from) {
                const ed = entry.lastContactedRaw ? new Date(entry.lastContactedRaw) : null;
                if (!ed || isNaN(ed.getTime())) return false;
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                if (ed < from || ed > to) return false;
            }

            // Stage filter
            if (filterStage !== "all") {
                const stageIdx = parseInt(filterStage) - 1;
                if (stageIdx >= 0 && stageIdx < 6) {
                    if (!entry.stages[stageIdx]?.hasData) return false;
                }
            }

            // Status filter
            if (filterStatus === "replied" && !entry.replied) return false;
            if (filterStatus === "no_reply" && entry.replied) return false;

            return true;
        });
    }, [sentEmails, searchQuery, dateRange, filterStage, filterStatus]);

    const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
    const paginatedEmails = filteredEmails.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sent Emails</h1>
                    <p className="text-sm text-slate-500 mt-1">Email outreach sequence from ICP Tracker — stages stop on reply</p>
                </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.total}</h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Leads Contacted</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <User className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.totalStagesSent}</h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Emails Sent</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Send className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.replied}</h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Replied</p>
                        </div>
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                            <Reply className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : `${stats.replyRate}%`}</h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Reply Rate</p>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by name, email..."
                            className="pl-9 bg-slate-50 border-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <DateRangePicker
                        className="w-full md:w-[260px]"
                        onUpdate={(values) => { setDateRange(values.range); setPage(1); }}
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="h-4 w-4 text-slate-400 mr-2" />

                    <Select value={filterStage} onValueChange={(val) => { setFilterStage(val); setPage(1); }}>
                        <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue placeholder="Email Stage" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Stages</SelectItem>
                            <SelectItem value="1">Email 1</SelectItem>
                            <SelectItem value="2">Email 2</SelectItem>
                            <SelectItem value="3">Email 3</SelectItem>
                            <SelectItem value="4">Email 4</SelectItem>
                            <SelectItem value="5">Email 5</SelectItem>
                            <SelectItem value="6">Email 6</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setPage(1); }}>
                        <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue placeholder="Reply Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="replied">Replied</SelectItem>
                            <SelectItem value="no_reply">No Reply</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 h-9 text-xs ml-auto bg-slate-100 hover:bg-slate-200"
                        onClick={() => {
                            setSearchQuery("");
                            setDateRange(undefined);
                            setFilterStage("all");
                            setFilterStatus("all");
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
                    paginatedEmails.map((entry) => <SentEmailCard key={entry.id} entry={entry} />)
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
                        <span className="font-medium">
                            {Math.min(page * ITEMS_PER_PAGE, filteredEmails.length)}
                        </span>{" "}
                        of <span className="font-medium">{filteredEmails.length}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="gap-1"
                        >
                            <ArrowLeft className="h-4 w-4" /> Previous
                        </Button>
                        <span className="text-sm font-medium text-slate-600">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="gap-1"
                        >
                            Next <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Helper: strip HTML tags for plain-text preview */
function stripHtml(html: string) {
    if (!html) return "";
    return html.replace(/<(br|p|div|li|h[1-6])[^>]*>/gi, " ").replace(/<\/?[^>]+(>|$)/g, "");
}

function SentEmailCard({ entry }: { entry: SentEmailEntry }) {
    const [isOpen, setIsOpen] = useState(false);

    // Build a quick preview: how many stages sent, has reply?
    const previewText = entry.stages
        .filter(s => s.hasData)
        .map(s => s.stage.replace("_", " "))
        .join(" → ");

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md"
        >
            <CollapsibleTrigger asChild>
                <div className="p-5 cursor-pointer group">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-11 w-11 shrink-0 rounded-full flex items-center justify-center border",
                                entry.replied
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                    : "bg-blue-50 text-blue-600 border-blue-100"
                            )}>
                                {entry.replied ? <Reply className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                            </div>
                            <div className="space-y-1 min-w-0">
                                {/* Name and badges row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-base font-bold text-slate-900 truncate max-w-[260px]">
                                        {entry.fullName}
                                    </h4>
                                    {entry.replied ? (
                                        <Badge
                                            variant="outline"
                                            className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] font-bold gap-1"
                                        >
                                            <Reply className="h-3 w-3" /> Replied
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="text-slate-500 border-slate-200 bg-slate-50 text-[10px] font-bold"
                                        >
                                            No Reply
                                        </Badge>
                                    )}
                                    <Badge
                                        variant="secondary"
                                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] tracking-wider font-bold uppercase"
                                    >
                                        {entry.stagesSent} / 6 Stages
                                    </Badge>
                                </div>

                                {/* Email */}
                                <div className="flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    <p className="text-xs text-slate-500 font-medium truncate">{entry.email}</p>
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs text-slate-500">{entry.lastContactedFormatted}</span>
                                    {entry.relativeTime && (
                                        <span className="text-xs text-slate-400">({entry.relativeTime})</span>
                                    )}
                                </div>

                                {/* Stage flow preview */}
                                {!isOpen && (
                                    <p className="text-xs text-slate-400 mt-1">{previewText}</p>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0">
                            {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                            )}
                        </div>
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-5 pb-5 pt-0">
                    <div className="pl-[60px] space-y-4 border-t border-border pt-4">
                        {/* Sender info */}
                        {entry.senderEmail && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Send className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-semibold text-slate-600">Sent from:</span>
                                <span>{entry.senderEmail}</span>
                            </div>
                        )}

                        {/* Replied-after indicator */}
                        {entry.replied && entry.repliedAfterStage && (
                            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span className="text-emerald-700 font-medium">
                                    Lead replied after {entry.repliedAfterStage.replace("_", " ")} — sequence stopped
                                </span>
                            </div>
                        )}

                        {/* Stage timeline */}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Sequence</p>
                            <div className="space-y-2">
                                {entry.stages.map((stage, idx) => (
                                    <StageRow
                                        key={stage.stage}
                                        stage={stage}
                                        index={idx}
                                        isLast={idx === entry.stages.length - 1}
                                        replied={entry.replied}
                                        repliedAfterStage={entry.repliedAfterStage}
                                    />
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
    stage,
    index,
    isLast,
    replied,
    repliedAfterStage,
}: {
    stage: EmailStageInfo;
    index: number;
    isLast: boolean;
    replied: boolean;
    repliedAfterStage: string | null;
}) {
    const isRepliedStage = replied && repliedAfterStage === stage.stage;
    const stageLabel = stage.stage.replace("_", " ");

    if (stage.stoppedByReply) {
        // Stopped stage — dimmed out
        return (
            <div className="flex items-start gap-3 opacity-40">
                <div className="flex flex-col items-center">
                    <div className="h-7 w-7 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    {!isLast && <div className="w-px h-4 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">{stageLabel}</span>
                        <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-200 bg-slate-50 font-medium">
                            Skipped — Lead Replied
                        </Badge>
                    </div>
                </div>
            </div>
        );
    }

    if (!stage.hasData) {
        // Not sent yet (no data, not stopped by reply)
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

    // Sent stage
    const stripHtmlContent = stripHtml(stage.content);
    // Check if it's a date-only value (just a timestamp stored as stage value)
    const isDateOnly = !isNaN(new Date(stage.content).getTime()) && stage.content.length < 50;
    const displayContent = isDateOnly ? "Email sent" : stripHtmlContent;

    return (
        <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
                <div className={cn(
                    "h-7 w-7 rounded-full border-2 flex items-center justify-center",
                    isRepliedStage
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-blue-400 bg-blue-50"
                )}>
                    {isRepliedStage ? (
                        <Reply className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                        <span className="text-[10px] font-bold text-blue-600">{index + 1}</span>
                    )}
                </div>
                {!isLast && <div className="w-px h-full min-h-[16px] bg-slate-200 mt-1" />}
            </div>
            <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-700">{stageLabel}</span>
                    <Badge
                        variant="outline"
                        className={cn(
                            "text-[9px] font-bold",
                            isRepliedStage
                                ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                : "text-blue-600 bg-blue-50 border-blue-200"
                        )}
                    >
                        {isRepliedStage ? "✓ Sent → Replied" : "✓ Sent"}
                    </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600 leading-relaxed">
                    {stage.content.includes("<") ? (
                        <div
                            className="email-content overflow-auto max-h-48"
                            dangerouslySetInnerHTML={{ __html: stage.content }}
                        />
                    ) : (
                        <p className="whitespace-pre-wrap">{displayContent}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
