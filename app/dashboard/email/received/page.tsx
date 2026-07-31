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
import { Mail, ChevronDown, ChevronUp, Reply, Search, RefreshCw, Clock, User, Bot, Snowflake, Flame, ExternalLink } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
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
import type { NormalizedLeadRow, LeadType, ReplyEntry } from "@/lib/services/email-outreach";

interface ReceivedEntry {
    id: string;
    leadType: LeadType;
    table: string;
    fullName: string;
    email: string;
    lastContactedRaw: string | null;
    timestamp: string;
    relativeTime: string;
    replies: ReplyEntry[];
}

function buildEntries(leads: NormalizedLeadRow[]): ReceivedEntry[] {
    const entries: ReceivedEntry[] = [];

    leads.forEach((lead) => {
        if (lead.replies.length === 0) return;

        const lastContactedRaw = lead.lastContacted || lead.createdAt;
        const d = lastContactedRaw ? new Date(lastContactedRaw) : new Date();
        const validDate = !isNaN(d.getTime()) ? d : new Date();

        entries.push({
            id: lead.id,
            leadType: lead.leadType,
            table: lead.table,
            fullName: lead.fullName,
            email: lead.email,
            lastContactedRaw,
            timestamp: format(validDate, "MMM dd, yyyy • p"),
            relativeTime: formatDistanceToNow(validDate, { addSuffix: true }),
            replies: lead.replies,
        });
    });

    entries.sort((a, b) => {
        const da = a.lastContactedRaw ? new Date(a.lastContactedRaw).getTime() : 0;
        const db = b.lastContactedRaw ? new Date(b.lastContactedRaw).getTime() : 0;
        return db - da;
    });

    return entries;
}

export default function ReceivedEmailsPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedLeadRow[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedLeadRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState("newest");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | LeadType>("all");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/email/outreach`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
        } catch (e) {
            console.error("Received emails fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const allEntries = useMemo(() => buildEntries([...coldLeads, ...hotLeads]), [coldLeads, hotLeads]);

    const filteredEntries = useMemo(() => {
        let result = allEntries.filter((entry) => {
            if (filterType !== "all" && entry.leadType !== filterType) return false;

            const q = searchQuery.toLowerCase();
            if (q && !entry.fullName.toLowerCase().includes(q) && !entry.email.toLowerCase().includes(q)) return false;

            if (dateRange?.from) {
                const rd = entry.lastContactedRaw ? new Date(entry.lastContactedRaw) : null;
                if (!rd || isNaN(rd.getTime())) return false;
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                if (rd < from || rd > to) return false;
            }

            return true;
        });

        return result.sort((a, b) => {
            const da = a.lastContactedRaw ? new Date(a.lastContactedRaw).getTime() : 0;
            const db = b.lastContactedRaw ? new Date(b.lastContactedRaw).getTime() : 0;
            return sortBy === "newest" ? db - da : da - db;
        });
    }, [allEntries, searchQuery, dateRange, sortBy, filterType]);

    const stats = useMemo(() => {
        const total = filteredEntries.length;
        const totalMessages = filteredEntries.reduce((sum, e) => sum + e.replies.length, 0);
        const coldCount = filteredEntries.filter(e => e.leadType === 'cold').length;
        const hotCount = filteredEntries.filter(e => e.leadType === 'hot').length;
        return { total, totalMessages, coldCount, hotCount };
    }, [filteredEntries]);

    return (
        <div className="space-y-4 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">Received Emails</h1>
                    <p className="text-xs text-slate-500">
                        User_Replied / Bot_Replied conversations from ENRICHED_LEADS, master_cold_leads & hubspot_lead
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <DateRangePicker
                        className="h-10 w-full sm:w-[260px] shadow-sm"
                        onUpdate={(values) => setDateRange(values.range)}
                    />
                    <Button
                        onClick={fetchData}
                        variant="outline"
                        size="sm"
                        className="gap-2 h-10 px-4 hover:bg-slate-50 transition-all text-xs font-semibold shadow-sm border-slate-200 bg-white"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        <span>Refresh Data</span>
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Conversations</p>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.total}</h3>
                        </div>
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><Mail className="h-5 w-5" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Messages</p>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.totalMessages}</h3>
                        </div>
                        <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl border border-violet-100"><Reply className="h-5 w-5" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cold Replies</p>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.coldCount}</h3>
                        </div>
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100"><Snowflake className="h-5 w-5" /></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hot Replies</p>
                            <h3 className="text-2xl font-bold text-slate-900">{loading ? "..." : stats.hotCount}</h3>
                        </div>
                        <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100"><Flame className="h-5 w-5" /></div>
                    </CardContent>
                </Card>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by lead name or email..."
                        className="pl-10 h-10 bg-slate-50 border-slate-200 text-sm focus:bg-white transition-all shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                    <button
                        onClick={() => setFilterType('all')}
                        className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/50')}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType('cold')}
                        className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'cold' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100/50')}
                    >
                        <Snowflake className="h-3 w-3" /> Cold
                    </button>
                    <button
                        onClick={() => setFilterType('hot')}
                        className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'hot' ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-100/50')}
                    >
                        <Flame className="h-3 w-3" /> Hot
                    </button>
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
                            setDateRange({ from: subDays(new Date(), 7), to: new Date() });
                            setSortBy("newest");
                            setFilterType("all");
                        }}
                    >
                        Reset
                    </Button>
                </div>
            </div>

            {/* Reply List */}
            <div className="space-y-4">
                {!loading && filteredEntries.map((entry) => (
                    <ReceivedEntryCard key={`${entry.table}-${entry.id}`} entry={entry} />
                ))}
                {!loading && filteredEntries.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border border-dashed border-border rounded-xl bg-slate-50/50">
                        <Mail className="h-8 w-8 mb-2 opacity-50" />
                        <p>No replies found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReceivedEntryCard({ entry }: { entry: ReceivedEntry }) {
    const [isOpen, setIsOpen] = useState(false);
    const [modalReply, setModalReply] = useState<ReplyEntry | null>(null);
    const lastReply = entry.replies[entry.replies.length - 1];
    const previewText = (lastReply?.userReplied || lastReply?.botReplied || "").toString().slice(0, 100);

    return (
        <>
            <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md">
                <CollapsibleTrigger asChild>
                    <div className="p-3 cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
                                <Reply className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                                        {entry.replies.length} message{entry.replies.length !== 1 ? 's' : ''}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate">{entry.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs text-slate-500">{entry.timestamp}</span>
                                    <span className="text-xs text-slate-400">({entry.relativeTime})</span>
                                </div>
                                {!isOpen && previewText && (
                                    <p className="text-xs text-slate-400 mt-1 italic truncate max-w-lg">{previewText}...</p>
                                )}
                            </div>
                            <div className="shrink-0">
                                {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />}
                            </div>
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <div className="px-5 pb-5 pt-0">
                        <div className="pl-[56px] space-y-3 border-t border-border pt-4">
                            {entry.replies.map((reply) => (
                                <div key={reply.index} className="space-y-2">
                                    {!reply.userReplied && reply.userStatusOnly && (
                                        <div className="flex items-center gap-2 pl-8 text-[11px] text-slate-400 italic">
                                            User replied (stage {reply.index}) — no message text available
                                        </div>
                                    )}
                                    {!reply.botReplied && reply.botStatusOnly && (
                                        <div className="flex items-center gap-2 pl-8 text-[11px] text-slate-400 italic">
                                            Bot replied (stage {reply.index}) — no message text available
                                        </div>
                                    )}
                                    {reply.userReplied && (
                                        <div
                                            onClick={() => setModalReply(reply)}
                                            className="flex items-start gap-2 cursor-pointer group/msg"
                                        >
                                            <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <User className="h-3 w-3" />
                                            </div>
                                            <div className="flex-1 min-w-0 p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-[13px] text-slate-700">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">User Replied {reply.index}</p>
                                                <p className="line-clamp-3 whitespace-pre-wrap">{String(reply.userReplied)}</p>
                                            </div>
                                            <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover/msg:opacity-100 transition-opacity mt-1 shrink-0" />
                                        </div>
                                    )}
                                    {reply.botReplied && (
                                        <div
                                            onClick={() => setModalReply(reply)}
                                            className="flex items-start gap-2 cursor-pointer group/msg"
                                        >
                                            <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <Bot className="h-3 w-3" />
                                            </div>
                                            <div className="flex-1 min-w-0 p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-100 text-[13px] text-slate-700">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Bot Replied {reply.index}</p>
                                                <p className="line-clamp-3 whitespace-pre-wrap">{String(reply.botReplied)}</p>
                                            </div>
                                            <ExternalLink className="h-3 w-3 text-slate-300 opacity-0 group-hover/msg:opacity-100 transition-opacity mt-1 shrink-0" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <Dialog open={!!modalReply} onOpenChange={(open) => !open && setModalReply(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white shadow-2xl">
                    <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            Conversation — Stage {modalReply?.index}
                        </DialogTitle>
                        <DialogDescription className="sr-only">Full reply content.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                        {modalReply?.userReplied && (
                            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">User Replied</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{String(modalReply.userReplied)}</p>
                            </div>
                        )}
                        {modalReply?.botReplied && (
                            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Bot Replied</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{String(modalReply.botReplied)}</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-6 flex justify-end pt-4 border-t border-slate-100">
                        <Button variant="secondary" onClick={() => setModalReply(null)} className="h-10 px-6 font-semibold">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
