"use client";

import { SPLoader } from "@/components/sp-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Mail, ChevronDown, ChevronUp, Reply, Search, RefreshCw, Sparkles, Clock, User, Send } from "lucide-react";
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

interface InstantlyReply {
    message_id: string;
    thread_id: string | null;
    campaign_id: string | null;
    sender_email_id: string | null;
    lead_email_id: string | null;
    reply_subject: string | null;
    emailbody_sent: string | null;
    clean_reply_text: string | null;
    reply_timestamp: string | null;
    ai_interest_score: number | null;
    created_at: string | null;
}

interface NormalizedReply {
    id: string;
    leadEmail: string;
    senderEmail: string;
    subject: string;
    replyContent: string;
    originalEmailSent: string;
    timestamp: string;
    originalDate: string;
    relativeTime: string;
    aiInterestScore: number | null;
    campaignId: string | null;
    threadId: string | null;
    source: "Instantly DB" | "Legacy";
}

export default function ReceivedEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [replies, setReplies] = useState<NormalizedReply[]>([]);
    const [sortBy, setSortBy] = useState("newest");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<any>(undefined);
    const [loadingDB, setLoadingDB] = useState(false);
    
    const loading = loadingLeads || loadingDB;

    const fetchReplies = async () => {
        if (loadingLeads && replies.length === 0) return;

        try {
            setLoadingDB(true);
            const realReplies: NormalizedReply[] = [];

            // 1. Process legacy leads table replies
            allLeads.forEach((lead: any, index: number) => {
                const emailReply = lead.email_replied;
                if (!emailReply || emailReply === "No" || String(emailReply).trim() === "") return;

                const trimmed = String(emailReply).trim();
                const lines = trimmed.split("\n");
                const lastLine = lines[lines.length - 1].trim();
                const lastLineDate = new Date(lastLine);

                let displayDate: string = lead.created_at || new Date().toISOString();
                let cleanContent = trimmed;

                if (!isNaN(lastLineDate.getTime()) && lastLine.includes("-") && lastLine.includes(":")) {
                    displayDate = lastLineDate.toISOString();
                    cleanContent = lines.slice(0, -1).join("\n").trim() || "Email Reply Received";
                }

                const emailStages = (lead.stages_passed || []).filter((s: string) => s.startsWith("Email_"));
                const lastEmailStage = emailStages.length > 0 ? emailStages[emailStages.length - 1] : "";

                realReplies.push({
                    id: `${lead.id || index}-legacy`,
                    leadEmail: lead.email || "No Email Provided",
                    senderEmail: lead.sender_email || "",
                    subject: lastEmailStage ? `Reply to ${lastEmailStage}` : "Email Reply",
                    replyContent: cleanContent,
                    originalEmailSent: "",
                    timestamp: format(new Date(displayDate), "MMM dd, yyyy • p"),
                    originalDate: displayDate,
                    relativeTime: formatDistanceToNow(new Date(displayDate), { addSuffix: true }),
                    aiInterestScore: null,
                    campaignId: null,
                    threadId: null,
                    source: "Legacy",
                });
            });

            // 2. Fetch from instantly_lead_replies table
            const dbRes = await fetch('/api/email/db-data');
            if (dbRes.ok) {
                const { leadReplies } = await dbRes.json();
                if (Array.isArray(leadReplies)) {
                    leadReplies.forEach((reply: InstantlyReply) => {
                        const dateStr = reply.reply_timestamp || reply.created_at || new Date().toISOString();
                        const dateObj = new Date(dateStr);
                        const validDate = !isNaN(dateObj.getTime()) ? dateObj : new Date();

                        realReplies.push({
                            id: reply.message_id || `db-reply-${Math.random().toString(36).substr(2, 9)}`,
                            leadEmail: reply.lead_email_id || "Unknown Lead",
                            senderEmail: reply.sender_email_id || "",
                            subject: reply.reply_subject || "Email Reply",
                            replyContent: reply.clean_reply_text || "(No reply content)",
                            originalEmailSent: reply.emailbody_sent || "",
                            timestamp: format(validDate, "MMM dd, yyyy • p"),
                            originalDate: validDate.toISOString(),
                            relativeTime: formatDistanceToNow(validDate, { addSuffix: true }),
                            aiInterestScore: reply.ai_interest_score,
                            campaignId: reply.campaign_id,
                            threadId: reply.thread_id,
                            source: "Instantly DB",
                        });
                    });
                }
            }

            // Sort newest first
            const sorted = realReplies.sort((a, b) => {
                const dateA = new Date(a.originalDate).getTime() || 0;
                const dateB = new Date(b.originalDate).getTime() || 0;
                return dateB - dateA;
            });
            
            setReplies(sorted);
        } catch (e) {
            console.error("Received emails fetch error:", e);
        } finally {
            setLoadingDB(false);
        }
    };

    useEffect(() => {
        fetchReplies();
    }, [allLeads, loadingLeads]);

    const handleRefresh = () => {
        fetchReplies();
    };

    // Compute stats
    const stats = useMemo(() => {
        const total = replies.length;
        const withScore = replies.filter(r => r.aiInterestScore !== null && r.aiInterestScore !== undefined);
        const avgScore = withScore.length > 0 
            ? Math.round(withScore.reduce((sum, r) => sum + (r.aiInterestScore || 0), 0) / withScore.length) 
            : null;
        const highInterest = replies.filter(r => (r.aiInterestScore || 0) >= 70).length;
        return { total, avgScore, highInterest };
    }, [replies]);

    const filteredReplies = useMemo(() => {
        let result = replies.filter((reply) => {
            // Search
            const q = searchQuery.toLowerCase();
            if (
                q &&
                !reply.leadEmail.toLowerCase().includes(q) &&
                !reply.replyContent.toLowerCase().includes(q) &&
                !reply.subject.toLowerCase().includes(q) &&
                !(reply.senderEmail || "").toLowerCase().includes(q)
            )
                return false;

            // Date range
            if (dateRange?.from) {
                const rd = reply.originalDate ? new Date(reply.originalDate) : null;
                if (!rd || isNaN(rd.getTime())) return false;
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                if (rd < from || rd > to) return false;
            }

            return true;
        });

        // Sort
        return result.sort((a, b) => {
            const da = a.originalDate ? new Date(a.originalDate).getTime() : 0;
            const db = b.originalDate ? new Date(b.originalDate).getTime() : 0;
            return sortBy === "newest" ? db - da : da - db;
        });
    }, [replies, searchQuery, dateRange, sortBy]);

    return (
        <div className="space-y-8 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header section */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Received Emails</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        View and manage all lead responses in one place
                    </p>
                </div>
                <Button 
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    className="gap-2 h-10 px-4 hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw className={cn("h-4 w-4", loadingDB && "animate-spin")} />
                    Refresh Inbox
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.total}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Total Replies</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Mail className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.avgScore !== null ? `${stats.avgScore}%` : "N/A"}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Avg Interest Score</p>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.highInterest}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">High Interest (70+)</p>
                        </div>
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by lead email, subject, or content..."
                            className="pl-10 bg-slate-50 border-border"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <DateRangePicker
                        className="w-full md:w-[260px]"
                        onUpdate={(values) => setDateRange(values.range)}
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px] h-9 text-xs">
                            <SelectValue placeholder="Sort By" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 h-9 text-xs ml-auto bg-slate-100 hover:bg-slate-200"
                        onClick={() => {
                            setSearchQuery("");
                            setDateRange(undefined);
                            setSortBy("newest");
                        }}
                    >
                        Reset Filters
                    </Button>
                </div>
            </div>

            {/* Reply List */}
            <div className="space-y-4">
                {!loading &&
                    filteredReplies.map((reply) => (
                        <EmailReplyCard key={reply.id} reply={reply} />
                    ))}
                {!loading && filteredReplies.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border border-dashed border-border rounded-xl bg-slate-50/50">
                        <Mail className="h-8 w-8 mb-2 opacity-50" />
                        <p>No replies found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Returns a color config based on the AI interest score */
function getScoreConfig(score: number | null) {
    if (score === null || score === undefined) return null;
    if (score >= 70) return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "High Interest" };
    if (score >= 40) return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Medium Interest" };
    return { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: "Low Interest" };
}

function EmailReplyCard({ reply }: { reply: NormalizedReply }) {
    const [isOpen, setIsOpen] = useState(false);
    const scoreConfig = getScoreConfig(reply.aiInterestScore);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md"
        >
            <CollapsibleTrigger asChild>
                <div className="p-5 flex items-center gap-4 cursor-pointer group">
                    {/* Avatar / Icon */}
                    <div className="h-12 w-12 shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
                        <Reply className="h-5 w-5" />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-bold text-slate-900 truncate max-w-[280px]">
                                    {reply.leadEmail}
                                </h4>
                                {/* Source badge */}
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] uppercase font-bold",
                                        reply.source === "Legacy"
                                            ? "text-purple-600 bg-purple-50 border-purple-100"
                                            : "text-emerald-600 bg-emerald-50 border-emerald-100"
                                    )}
                                >
                                    {reply.source}
                                </Badge>
                                {/* AI Interest Score badge */}
                                {scoreConfig && (
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px] font-bold gap-1",
                                            scoreConfig.bg, scoreConfig.text, scoreConfig.border
                                        )}
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        {reply.aiInterestScore}% – {scoreConfig.label}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Subject line */}
                        <p className="text-sm font-medium text-slate-700 truncate">{reply.subject}</p>

                        {/* Timestamp row */}
                        <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span className="text-xs text-slate-500">{reply.timestamp}</span>
                            </div>
                            <span className="text-xs text-slate-400">({reply.relativeTime})</span>
                        </div>

                        {/* Preview when collapsed */}
                        {!isOpen && (
                            <p className="text-sm text-slate-400 truncate max-w-lg mt-1.5">
                                {reply.replyContent.substring(0, 100)}...
                            </p>
                        )}
                    </div>

                    <div className="shrink-0 p-2 rounded-full text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600 transition-colors">
                        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-5 pb-5 pt-0">
                    <div className="pl-[64px] space-y-4 border-t border-border pt-4">
                        {/* Metadata grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                            {reply.leadEmail && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-500 block">Lead Email</span>
                                        <span className="text-slate-700 truncate block">{reply.leadEmail}</span>
                                    </div>
                                </div>
                            )}
                            {reply.senderEmail && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Send className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-500 block">Sender (Our Side)</span>
                                        <span className="text-slate-700 truncate block">{reply.senderEmail}</span>
                                    </div>
                                </div>
                            )}
                            {reply.campaignId && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-500 block">Campaign ID</span>
                                        <span className="text-slate-700 truncate block font-mono text-[10px]">{reply.campaignId}</span>
                                    </div>
                                </div>
                            )}
                            {reply.threadId && (
                                <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-500 block">Thread ID</span>
                                        <span className="text-slate-700 truncate block font-mono text-[10px]">{reply.threadId}</span>
                                    </div>
                                </div>
                            )}
                            {reply.aiInterestScore !== null && reply.aiInterestScore !== undefined && scoreConfig && (
                                <div className={cn("flex items-center gap-2 p-2.5 rounded-lg border", scoreConfig.bg, scoreConfig.border)}>
                                    <Sparkles className={cn("h-3.5 w-3.5 shrink-0", scoreConfig.text)} />
                                    <div className="min-w-0">
                                        <span className="font-semibold text-slate-500 block">AI Interest Score</span>
                                        <span className={cn("font-bold block", scoreConfig.text)}>{reply.aiInterestScore}% – {scoreConfig.label}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Original email sent (what we sent to the lead) */}
                        {reply.originalEmailSent && (
                            <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Our Email (Sent to Lead)</p>
                                <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-100 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                    {reply.originalEmailSent}
                                </div>
                            </div>
                        )}

                        {/* Reply content */}
                        <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead&apos;s Reply</p>
                            <div className="p-4 bg-slate-50 rounded-lg border border-border text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {reply.replyContent}
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
