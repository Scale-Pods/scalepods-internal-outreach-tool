"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Search,
    Filter,
    Users,
    Send,
    MessageSquare,
    RefreshCw,
    Snowflake,
    Flame,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import type { NormalizedWaLead, LeadType } from "@/lib/services/whatsapp-outreach";
import { getWaLastContacted, countSentMessages, hasReplied } from "@/lib/services/whatsapp-outreach";

export default function WhatsappChatPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedWaLead[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedWaLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;
    const [sourceFilter, setSourceFilter] = useState<"all" | LeadType>("all");

    const [selectedLead, setSelectedLead] = useState<NormalizedWaLead | null>(null);

    const [pendingFilters, setPendingFilters] = useState<{ replyStatus: string[] }>({ replyStatus: [] });
    const [activeFilters, setActiveFilters] = useState<{ replyStatus: string[] }>({ replyStatus: [] });

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/whatsapp/outreach`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
        } catch (err) {
            console.error("Failed to fetch WhatsApp chats:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const combinedLeads = useMemo(() => {
        const all = [...coldLeads, ...hotLeads];
        if (sourceFilter === "all") return all;
        return all.filter(l => l.leadType === sourceFilter);
    }, [coldLeads, hotLeads, sourceFilter]);

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            const q = searchQuery.toLowerCase();
            const matchesSearch = lead.fullName.toLowerCase().includes(q) || lead.phone.includes(searchQuery);
            if (!matchesSearch) return false;

            const replied = hasReplied(lead);
            const matchesReplyStatus = activeFilters.replyStatus.length === 0 ||
                (activeFilters.replyStatus.includes("Replied") && replied) ||
                (activeFilters.replyStatus.includes("No Reply") && !replied);
            if (!matchesReplyStatus) return false;

            if (dateRange?.from) {
                const wlc = getWaLastContacted(lead);
                if (!wlc) return false;
                const contactDate = new Date(wlc);
                const from = startOfDay(new Date(dateRange.from));
                const to = endOfDay(new Date(dateRange.to || dateRange.from));
                if (contactDate < from || contactDate > to) return false;
            }

            return true;
        }).sort((a, b) => {
            const wlcA = getWaLastContacted(a);
            const wlcB = getWaLastContacted(b);
            const dateA = wlcA ? new Date(wlcA).getTime() : 0;
            const dateB = wlcB ? new Date(wlcB).getTime() : 0;
            return dateB - dateA;
        });
    }, [combinedLeads, searchQuery, activeFilters, dateRange]);

    const stats = useMemo(() => {
        let sentCount = 0;
        let repliedCount = 0;
        let failedCount = 0;
        filteredLeads.forEach(lead => {
            sentCount += countSentMessages(lead);
            lead.stages.forEach(s => {
                if ((s.status || '').toLowerCase().includes('failed')) failedCount++;
            });
            lead.conversation.forEach(m => {
                if (String(m.status || m.status_updated_at || '').toLowerCase().includes('failed') || m.error) failedCount++;
            });
            if (hasReplied(lead)) repliedCount++;
        });
        const uniqueSentCount = filteredLeads.filter(l => countSentMessages(l) > 0).length;
        return { totalLeads: filteredLeads.length, sentCount, uniqueSentCount, repliedCount, failedCount };
    }, [filteredLeads]);

    const handleApplyFilters = () => setActiveFilters(pendingFilters);
    const handleResetFilters = () => {
        setPendingFilters({ replyStatus: [] });
        setActiveFilters({ replyStatus: [] });
    };

    const toggleFilter = (value: string) => {
        setPendingFilters(prev => ({
            replyStatus: prev.replyStatus.includes(value) ? prev.replyStatus.filter(v => v !== value) : [...prev.replyStatus, value],
        }));
    };

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return filteredLeads.slice(start, start + leadsPerPage);
    }, [filteredLeads, currentPage]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange, sourceFilter]);

    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) items.push(renderPageButton(i));
        } else {
            items.push(renderPageButton(1));
            if (currentPage > 3) items.push(<span key="dots-1" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
                if (i > 1 && i < totalPages) items.push(renderPageButton(i));
            }
            if (currentPage < totalPages - 2) items.push(<span key="dots-2" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            items.push(renderPageButton(totalPages));
        }
        return items;
    };

    const renderPageButton = (page: number) => (
        <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            className={`h-8 w-8 text-xs font-bold ${currentPage === page ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            onClick={() => setCurrentPage(page)}
        >
            {page}
        </Button>
    );

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Chats</h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time engagement across Cold & Hot leads</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
                        <button
                            onClick={() => { setSourceFilter('all'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sourceFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => { setSourceFilter('cold'); setCurrentPage(1); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sourceFilter === 'cold' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Snowflake className="h-3.5 w-3.5" /> Cold Leads
                        </button>
                        <button
                            onClick={() => { setSourceFilter('hot'); setCurrentPage(1); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sourceFilter === 'hot' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Flame className="h-3.5 w-3.5" /> Hot Leads
                        </button>
                    </div>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                    <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 h-10 px-4">
                        <RefreshCw className="h-4 w-4" /> Refresh Chat
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-border shadow-sm bg-white h-auto">
                        <CardContent className="p-4 space-y-6">
                            <div className="flex items-center justify-between border-border border-border pb-2">
                                <div className="flex items-center gap-2 text-slate-900 font-bold">
                                    <Filter className="h-4 w-4" /> Filters
                                </div>
                                {activeFilters.replyStatus.length > 0 && (
                                    <button onClick={handleResetFilters} className="text-[10px] text-emerald-600 font-bold hover:underline">RESET</button>
                                )}
                            </div>

                            <FilterSection title="Reply Status">
                                <FilterOption label="Replied" checked={pendingFilters.replyStatus.includes("Replied")} onCheckedChange={() => toggleFilter("Replied")} />
                                <FilterOption label="No Reply" checked={pendingFilters.replyStatus.includes("No Reply")} onCheckedChange={() => toggleFilter("No Reply")} />
                            </FilterSection>

                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white h-9" size="sm" onClick={handleApplyFilters}>Apply Filters</Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <MetricCard title="Messages Sent" value={loading ? "..." : stats.sentCount.toLocaleString()} desc="Total outgoing pulses" icon={Send} />
                            <MetricCard title="Unique Msg Sent" value={loading ? "..." : stats.uniqueSentCount.toLocaleString()} desc="Unique leads contacted" icon={Users} />
                            <MetricCard title="Total Replies" value={loading ? "..." : stats.repliedCount.toLocaleString()} desc={`${stats.totalLeads > 0 ? ((stats.repliedCount / stats.totalLeads) * 100).toFixed(1) : 0}% Response Rate`} icon={MessageSquare} />
                        </div>
                        <Card className="border-border shadow-sm bg-white">
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Delivery Status</h3>
                                    <p className="text-xs text-slate-500">Global outbound health</p>
                                </div>
                                <div className="space-y-3">
                                    <StatusBar label="Sent" value={stats.sentCount} total={stats.sentCount || 1} color="bg-blue-400" />
                                    <StatusBar label="Replied" value={stats.repliedCount} total={stats.sentCount || 1} color="bg-emerald-500" />
                                    <StatusBar label="Failed" value={stats.failedCount} total={stats.sentCount || 1} color="bg-rose-500" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input className="pl-10 bg-white" placeholder="Search by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <Card className="border-border shadow-sm bg-white overflow-hidden">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                                <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                                Loading real-time chats...
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">No WhatsApp chats found.</div>
                        ) : (
                            <TooltipProvider>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-border border-border">
                                        <tr>
                                            <th className="px-4 py-3">Lead</th>
                                            <th className="px-4 py-3 text-center">Source</th>
                                            <th className="px-4 py-3 text-center">Lifecycle Stage</th>
                                            <th className="px-4 py-3 text-center">Messages Sent</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-right">Last Contacted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {paginatedLeads.map((lead, idx) => (
                                            <CustomerRow key={`${lead.table}-${lead.id}-${idx}`} lead={lead} onClick={() => setSelectedLead(lead)} />
                                        ))}
                                    </tbody>
                                </table>
                            </TooltipProvider>
                        )}

                        {!loading && filteredLeads.length > 0 && (
                            <div className="bg-slate-50 border-t border-border px-4 py-3 flex items-center justify-between">
                                <div className="text-xs text-slate-500 font-medium">
                                    Showing <span className="text-slate-900 font-bold">{filteredLeads.length > 0 ? (currentPage - 1) * leadsPerPage + 1 : 0}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * leadsPerPage, filteredLeads.length)}</span> of <span className="text-slate-900 font-bold">{filteredLeads.length}</span> leads
                                </div>
                                {filteredLeads.length > leadsPerPage && (
                                    <div className="flex gap-1 items-center">
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <div className="flex gap-1">{renderPaginationItems()}</div>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLead && <WhatsAppChatDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ title, value, desc, icon: Icon }: any) {
    return (
        <Card className="bg-white border-border shadow-sm">
            <CardContent className="p-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-2"><Icon className="h-5 w-5" /></div>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                <p className="text-xs font-medium text-slate-500">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
            </CardContent>
        </Card>
    );
}

function StatusBar({ label, value, total, color }: any) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-medium text-slate-600">
                <span>{label}</span><span>{value} ({((value / total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${(value / total) * 100}%` }} />
            </div>
        </div>
    );
}

function FilterSection({ title, children }: any) {
    return (
        <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-slate-400">{title}</h4>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function FilterOption({ label, checked, onCheckedChange }: any) {
    return (
        <div className="flex items-center gap-2">
            <Checkbox id={label} className="h-3.5 w-3.5 border-border" checked={checked} onCheckedChange={onCheckedChange} />
            <label htmlFor={label} className="text-sm font-medium text-slate-600 cursor-pointer">{label}</label>
        </div>
    );
}

function CustomerRow({ lead, onClick }: { lead: NormalizedWaLead; onClick: () => void }) {
    const sentCount = countSentMessages(lead);
    const replied = hasReplied(lead);
    const wlc = getWaLastContacted(lead);

    // Latest bot message status — prefer wa_conversation, fall back to Whatsapp_N_status
    let latestBotStatus: string | null = null;
    for (let i = lead.conversation.length - 1; i >= 0; i--) {
        const m = lead.conversation[i];
        if ((m.role === 'bot' || m.direction === 'outbound') && (m.status || m.status_updated_at)) {
            latestBotStatus = String(m.status || m.status_updated_at || '').trim() || null;
            break;
        }
    }
    if (!latestBotStatus) {
        for (let i = lead.stages.length - 1; i >= 0; i--) {
            if (lead.stages[i].status && String(lead.stages[i].status).trim()) {
                latestBotStatus = String(lead.stages[i].status).trim();
                break;
            }
        }
    }

    const formatTooltipDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return String(date);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleString([], { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <tr className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={onClick}>
            <td className="px-4 py-3">
                <div className="block">
                    <div className="font-bold text-slate-900 group-hover:text-emerald-700">{lead.fullName}</div>
                    <div className="text-xs text-slate-500">{lead.phone}</div>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <Badge variant="outline" className={`text-[10px] uppercase font-bold gap-1 ${lead.leadType === 'hot' ? 'border-orange-100 text-orange-600 bg-orange-50' : 'border-blue-100 text-blue-600 bg-blue-50'}`}>
                    {lead.leadType === 'hot' ? <Flame className="h-2.5 w-2.5" /> : <Snowflake className="h-2.5 w-2.5" />}
                    {lead.leadType === 'hot' ? 'Hot Leads' : 'Cold Leads'}
                </Badge>
            </td>
            <td className="px-4 py-3 text-center">
                {lead.lifecycleStage ? (
                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-purple-100 text-purple-600 bg-purple-50">
                        {lead.lifecycleStage}
                    </Badge>
                ) : (
                    <span className="text-slate-300 text-[10px]">—</span>
                )}
            </td>
            <td className="px-4 py-3 text-center font-bold text-slate-700">{sentCount}</td>
            <td className="px-4 py-3 text-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                {replied ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] text-slate-400 border-border">SENT</Badge>
                                )}
                            </div>
                        </TooltipTrigger>
                        {replied && wlc && (
                            <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">
                                {formatTooltipDate(wlc)}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
                {latestBotStatus && (
                    <div className="mt-1">
                        <MessageStatusBadge status={latestBotStatus} />
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-right text-slate-500 text-xs text-nowrap">
                {wlc ? new Date(wlc).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-slate-300">—</span>}
            </td>
        </tr>
    );
}

function MessageStatusBadge({ status }: { status: string }) {
    if (!status) return null;

    let mainStatus = "SENT";
    const statusLower = status.toLowerCase();
    if (statusLower.includes("failed")) mainStatus = "FAILED";
    else if (statusLower.includes("read")) mainStatus = "READ";
    else if (statusLower.includes("delivered")) mainStatus = "DELIVERED";
    else if (statusLower.includes("sent")) mainStatus = "SENT";
    else mainStatus = status.split(" ")[0].toUpperCase();

    let badgeClass = "bg-slate-100 text-slate-600 border-border";
    if (mainStatus === "DELIVERED") badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (mainStatus === "READ") badgeClass = "bg-blue-50 text-blue-700 border-blue-100";
    if (mainStatus === "FAILED") badgeClass = "bg-red-50 text-red-700 border-red-100";
    if (mainStatus === "SENT") badgeClass = "bg-amber-50 text-amber-700 border-amber-100";

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <div className="flex items-center justify-center cursor-help">
                        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>{mainStatus}</Badge>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-slate-800 backdrop-blur-md text-white text-[10px] border-none px-3 py-2 shadow-xl max-w-[250px] whitespace-normal">
                    {status}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
