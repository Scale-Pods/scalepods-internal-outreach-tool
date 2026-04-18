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
import { Mail, ChevronDown, ChevronUp, Reply, Search, RefreshCw, Sparkles, Clock, User, Send, Copy, Check, ExternalLink } from "lucide-react";
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
        try {
            setLoadingDB(true);
            const realReplies: NormalizedReply[] = [];

            // Fetch from instantly_lead_replies table
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
    }, []);

    const handleRefresh = () => {
        fetchReplies();
    };

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

    // Compute stats based on filtered results
    const stats = useMemo(() => {
        const total = filteredReplies.length;
        const withScore = filteredReplies.filter(r => r.aiInterestScore !== null && r.aiInterestScore !== undefined);
        const avgScore = withScore.length > 0 
            ? Math.round(withScore.reduce((sum, r) => sum + (r.aiInterestScore || 0), 0) / withScore.length) 
            : null;
        const highInterest = filteredReplies.filter(r => (r.aiInterestScore || 0) >= 70).length;
        return { total, avgScore, highInterest };
    }, [filteredReplies]);

    return (
        <div className="space-y-4 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Received Emails</h1>
                    <p className="text-xs text-slate-500">
                        View and manage all lead responses in one place
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <DateRangePicker
                        className="h-10 w-full sm:w-[260px] shadow-sm"
                        onUpdate={(values) => setDateRange(values.range)}
                    />
                    <Button 
                        onClick={handleRefresh}
                        variant="outline"
                        size="sm"
                        className="gap-2 h-10 px-4 hover:bg-slate-50 transition-all text-xs font-semibold shadow-sm border-slate-200 bg-white"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", loadingDB && "animate-spin")} />
                        <span>Refresh Data</span>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Replies</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.total}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                            <Mail className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Interest</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.avgScore !== null ? `${stats.avgScore}%` : "N/A"}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">High Intent</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {loading ? "..." : stats.highInterest}
                            </h3>
                        </div>
                        <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl border border-violet-100">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by lead email, subject, or content..."
                            className="pl-10 h-10 bg-slate-50 border-slate-200 text-sm focus:bg-white transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-full md:w-[160px] h-10 text-sm shadow-sm bg-white border-slate-200">
                                <SelectValue placeholder="Sort By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button
                            variant="outline"
                            size="sm"
                            className="text-slate-500 h-10 px-4 text-xs bg-white hover:bg-slate-50 shadow-sm border-slate-200 font-semibold"
                            onClick={() => {
                                setSearchQuery("");
                                setDateRange(undefined);
                                setSortBy("newest");
                            }}
                        >
                            Reset
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

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors shadow-sm"
            title="Copy to clipboard"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ');
};

function IdButton({ title, idStr }: { title: string, idStr: string }) {
    const [visible, setVisible] = useState(false);
    
    if (visible) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-border rounded-lg shadow-sm">
                <div className="flex flex-col min-w-0 max-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
                    <span className="text-[10px] font-mono text-slate-600 truncate bg-slate-100 px-1 py-0.5 rounded select-all" title={idStr}>{idStr}</span>
                </div>
                <CopyButton text={idStr} />
            </div>
        );
    }

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setVisible(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-border text-[10px] font-bold text-slate-600 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm shrink-0 uppercase tracking-wider"
        >
            <span>Reveal {title}</span>
        </button>
    );
}

function EmailReplyCard({ reply }: { reply: NormalizedReply }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const scoreConfig = getScoreConfig(reply.aiInterestScore);

    const processHtml = (html: string) => {
        if (!html) return "";
        return html.replace(/<a\b([^>]*?)>/gi, '<a $1 target="_blank" rel="noopener noreferrer">');
    };

    return (
        <>
            <div 
                onClick={() => setIsModalOpen(true)}
                className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md p-3 flex items-center gap-4 cursor-pointer group"
            >
                {/* Avatar / Icon */}
                <div className="h-10 w-10 shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
                    <Reply className="h-4 w-4" />
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

                    {/* Preview text */}
                    <p className="text-sm text-slate-400 truncate max-w-lg mt-1.5 italic font-sans">
                        {stripHtml(reply.replyContent).substring(0, 100)}...
                    </p>
                </div>

                <div className="shrink-0 p-2 rounded-full text-slate-300 group-hover:bg-slate-50 group-hover:text-emerald-600 transition-colors">
                    <ExternalLink className="h-5 w-5" />
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl border-none">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                    <Reply className="h-6 w-6" />
                                </div>
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-xl font-bold text-slate-900">
                                        Reply from {reply.leadEmail}
                                    </DialogTitle>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <Clock className="h-3 w-3" />
                                        <span>{reply.timestamp}</span>
                                        <span className="text-slate-300">•</span>
                                        <span>{reply.relativeTime}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {reply.campaignId && <IdButton title="Campaign" idStr={reply.campaignId} />}
                                {reply.threadId && <IdButton title="Thread" idStr={reply.threadId} />}
                            </div>
                        </div>
                        <DialogDescription className="sr-only">
                            Full details of the email reply from {reply.leadEmail}.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
                        {/* Meta Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                                    <User className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Contact</p>
                                    <p className="text-sm font-semibold text-slate-700">{reply.leadEmail}</p>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                                    <Send className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sent From</p>
                                    <p className="text-sm font-semibold text-slate-700">{reply.senderEmail || "N/A"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Subject Row</p>
                            <p className="text-sm font-bold text-slate-800">{reply.subject}</p>
                        </div>

                        {/* Main Content */}
                        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[300px]">
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Content</p>
                            </div>
                            <div className="p-6 prose prose-sm max-w-none text-slate-700 leading-relaxed font-sans email-full-content">
                                <div dangerouslySetInnerHTML={{ __html: processHtml(reply.replyContent) }} />
                            </div>
                        </div>

                        {/* Original Conversation */}
                        {reply.originalEmailSent && !reply.originalEmailSent.toLowerCase().includes("not found") && (
                            <div className="mt-8">
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-slate-200"></div>
                                    </div>
                                    <div className="relative px-4 bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Original Conversation
                                    </div>
                                </div>
                                <div className="bg-white/50 rounded-xl border border-dashed border-slate-200 p-6 opacity-70 hover:opacity-100 transition-opacity">
                                    <div 
                                        className="text-sm text-slate-600 prose prose-sm max-w-none italic"
                                        dangerouslySetInnerHTML={{ __html: processHtml(reply.originalEmailSent) }} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="h-10 px-8 font-semibold">
                            Back to Inbox
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
