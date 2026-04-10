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
import { Mail, ChevronDown, ChevronUp, Reply, Search, RefreshCw, BarChart2, Inbox } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";

export default function ReceivedEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [replies, setReplies] = useState<any[]>([]);
    const [sortBy, setSortBy] = useState("newest");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<any>(undefined);
    const [loadingDB, setLoadingDB] = useState(false);
    
    const loading = loadingLeads || loadingDB;

    const fetchReplies = async () => {
        if (loadingLeads && replies.length === 0) return;

        try {
            setLoadingDB(true);
            const realReplies: any[] = [];

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
                    sender: lead.email || "No Email Provided",
                    senderName: lead.name || "Lead",
                    status: "Replied",
                    subject: lastEmailStage ? `Reply to ${lastEmailStage}` : "Email Reply",
                    timestamp: format(new Date(displayDate), "MMM dd, yyyy • p"),
                    content: cleanContent,
                    originalDate: displayDate,
                    source: "Legacy",
                });
            });

            // 2. Fetch new database replies
            const dbRes = await fetch('/api/email/db-data');
            if (dbRes.ok) {
                const { leadReplies } = await dbRes.json();
                if (Array.isArray(leadReplies)) {
                    if (leadReplies.length > 0) {
                        console.log("DEBUG: First DB Reply Object:", leadReplies[0]);
                    }
                    
                    leadReplies.forEach((reply: any, idx: number) => {
                        const date = reply.timestamp || reply.created_at || reply.date || new Date().toISOString();
                        
                        // Aggressive search for sender email
                        const sender = reply.sender_email_id || reply.sender_email || reply.from_email || 
                                     reply.email || reply.lead_email || reply.email_id || 
                                     (reply.sender_name ? `${reply.sender_name} (ID: ${reply.id})` : `Unknown (${reply.id || idx})`);
                        
                        // Aggressive search for content
                        const content = reply.reply || reply.reply_text || reply.content || 
                                      reply.body || reply.text || reply.message || 
                                      reply.email_body || reply.message_text || "Empty Reply";
                        
                        // Aggressive search for name
                        const name = reply.sender_name || reply.lead_name || reply.name || 
                                   reply.first_name || reply.full_name || "Lead";
                                   
                        realReplies.push({
                            id: reply.id || `db-reply-${idx}`,
                            sender: sender,
                            senderName: name,
                            status: "Replied",
                            subject: reply.subject || "Email Reply",
                            timestamp: format(new Date(date), "MMM dd, yyyy • p"),
                            content: content,
                            originalDate: date,
                            source: "Instantly DB",
                            details: reply
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

    const filteredReplies = useMemo(() => {
        let result = replies.filter((reply) => {
            // Search
            const q = searchQuery.toLowerCase();
            if (
                q &&
                !reply.sender.toLowerCase().includes(q) &&
                !reply.content.toLowerCase().includes(q) &&
                !reply.senderName.toLowerCase().includes(q)
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
        <div className="space-y-8 pb-10 pt-6 max-w-5xl mx-auto relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header section with refined spacing */}
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

            {/* Summary Card */}
            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {loading ? "..." : filteredReplies.length} replies received
                        </h3>
                        <p className="text-sm font-medium text-slate-500 mt-1">Total Replies</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Mail className="h-6 w-6" />
                    </div>
                </CardContent>
            </Card>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by sender or content..."
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

function EmailReplyCard({ reply }: { reply: any }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md"
        >
            <CollapsibleTrigger asChild>
                <div className="p-6 flex items-center gap-4 cursor-pointer group">
                    <div className="h-12 w-12 shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-bordermerald-100">
                        <Reply className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-lg font-bold text-slate-900 truncate">
                                    {reply.senderName}
                                </h4>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px] uppercase font-bold",
                                            reply.source === "Legacy" ? "text-purple-600 bg-purple-50 border-purple-100" : "text-emerald-600 bg-emerald-50 border-emerald-100"
                                        )}
                                    >
                                        {reply.source || "Sequence"}
                                    </Badge>
                                {reply.repliedToStep && (
                                    <Badge
                                        variant="outline"
                                        className="text-indigo-600 bg-indigo-50 border-indigo-100 text-[10px] font-bold gap-1"
                                    >
                                        <Reply className="h-3 w-3" />
                                        {reply.repliedToStep}
                                    </Badge>
                                )}
                                {reply.timestamp && (
                                    <Badge
                                        variant="outline"
                                        className="text-slate-600 bg-slate-50 border-slate-100 text-[10px] font-bold"
                                    >
                                        {reply.timestamp}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <p className="text-xs text-slate-500 font-medium truncate">{reply.sender}</p>
                        </div>
                        {!isOpen && (
                            <p className="text-sm text-slate-400 truncate max-w-md mt-1">
                                {reply.content.substring(0, 80)}...
                            </p>
                        )}
                    </div>

                    <div className="shrink-0 p-2 rounded-full text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600 transition-colors">
                        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-6 pb-6 pt-0">
                    <div className="pl-[64px] space-y-4 border-t border-border pt-4">
                        <div className="p-4 bg-slate-50 rounded-lg border border-border text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {reply.content}
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
