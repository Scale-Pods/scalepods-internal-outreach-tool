"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { ConsolidatedLead } from "@/lib/leads-utils";
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
    MessageCircle,
    MessageSquare,
    RefreshCw,
    Database
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

type SourceTable = 'icp_tracker' | 'meta_lead_tracker';

// --- Sorting & Activity Helpers ---
const getMsgDate = (raw: any) => {
    if (!raw || !String(raw).trim()) return null;
    const content = String(raw).trim();
    const isoRegex = /\n\n(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+)$/;
    const isoMatch = content.match(isoRegex);
    if (isoMatch) return new Date(isoMatch[1]);

    const lines = content.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    const lastLineDate = new Date(lastLine.replace(' ', 'T'));
    if (lines.length > 1 && !isNaN(lastLineDate.getTime()) && lastLine.includes('-') && lastLine.includes(':')) {
        return lastLineDate;
    }
    return null;
};

const getLeadLatestActivity = (lead: any) => {
    let latestDate = new Date(lead.created_at);

    // Check all bot messages (W.P_1 - W.P_12)
    for (let i = 1; i <= 12; i++) {
        const tsRaw = lead[`W.P_${i} TS`];
        let d = getMsgDate(lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]);

        // Try extracting from TS string (e.g. "Delivered - 2026-03-12 10:00:00")
        // Only use this as a fallback if the message content itself doesn't have a date
        if (!d && tsRaw && tsRaw.includes(' - ')) {
            const parts = tsRaw.split(' - ');
            const datePart = parts[parts.length - 1].trim();
            const tsDate = new Date(datePart.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$2-$1'));
            if (!isNaN(tsDate.getTime())) {
                const rawLower = tsRaw.toLowerCase();
                // Status receipts like delivered/read/failed don't count as "activity" that bumps the lead to the top
                if (rawLower.includes('read') || rawLower.includes('delivered') || rawLower.includes('failed')) {
                    tsDate.setHours(0, 0, 0, 0);
                }
                d = tsDate;
            }
        }

        if (d && d > latestDate) latestDate = d;
    }
    // Check reply
    const rd = getMsgDate(lead.whatsapp_replied || lead.stage_data?.["WhatsApp Replied"]);
    if (rd && rd > latestDate) latestDate = rd;
    // Check followup
    const fd = getMsgDate(lead["W.P_FollowUp"] || lead.stage_data?.["WhatsApp FollowUp"]);
    if (fd && fd > latestDate) latestDate = fd;

    // Check extended history
    for (let i = 1; i <= 10; i++) {
        const dReplied = getMsgDate(lead[`W.P_Replied_${i}`]);
        if (dReplied && dReplied > latestDate) latestDate = dReplied;

        const dFollow = getMsgDate(lead[`W.P_FollowUp_${i}`]);
        if (dFollow && dFollow > latestDate) latestDate = dFollow;
    }
    return latestDate;
};

export default function WhatsappChatPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    // Table source selector
    const [sourceTable, setSourceTable] = useState<SourceTable>('icp_tracker');
    const [metaLeads, setMetaLeads] = useState<any[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(false);

    // Loop data from master_leads_unique
    const [loopMap, setLoopMap] = useState<Record<string, string>>({});

    useEffect(() => {
        // Fetch loop data on mount
        (async () => {
            try {
                const res = await fetch('/api/leads/loops');
                if (res.ok) {
                    const data = await res.json();
                    const map: Record<string, string> = {};
                    (data.data || []).forEach((row: any) => {
                        if (row.Phone && row.Loop) {
                            const normalized = String(row.Phone).replace(/\D/g, '');
                            if (normalized) map[normalized] = row.Loop;
                        }
                    });
                    setLoopMap(map);
                }
            } catch (err) {
                console.error('Failed to fetch loop data:', err);
            }
        })();
    }, []);

    const fetchMetaLeads = useCallback(async () => {
        setLoadingMeta(true);
        try {
            const res = await fetch('/api/leads/meta');
            if (res.ok) {
                const data = await res.json();
                setMetaLeads(data.leads || []);
            }
        } catch (err) {
            console.error('Failed to fetch meta_lead_tracker:', err);
        } finally {
            setLoadingMeta(false);
        }
    }, []);

    useEffect(() => {
        if (sourceTable === 'meta_lead_tracker' && metaLeads.length === 0) {
            fetchMetaLeads();
        }
    }, [sourceTable]);

    const loading = sourceTable === 'icp_tracker' ? loadingLeads : loadingMeta;

    // URL Sync for chat
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialSelectedId = searchParams?.get('chat');

    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedId || null);

    useEffect(() => {
        const url = new URL(window.location.origin + window.location.pathname);
        if (selectedLeadId) {
            url.searchParams.set('chat', selectedLeadId);
        } else {
            url.searchParams.delete('chat');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedLeadId]);

    // Filter State
    const [pendingFilters, setPendingFilters] = useState<{
        replyStatus: string[],
        loops: string[],
        messageStatus: string[]
    }>({
        replyStatus: [],
        loops: [],
        messageStatus: []
    });

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[],
        loops: string[],
        messageStatus: string[]
    }>({
        replyStatus: [],
        loops: [],
        messageStatus: []
    });

    useEffect(() => {
        if (sourceTable === 'icp_tracker') {
            if (loadingLeads) return;
            const wpLeads = allLeads.filter(l => {
                const lead = l as any;
                // Strictly filter by table source
                if (lead._table && lead._table !== 'icp_tracker') return false;

                // Check Whatsapp_1-5 fields (icp_tracker schema)
                for (let i = 1; i <= 5; i++) {
                    if (lead[`Whatsapp_${i}`]) return true;
                }
                // Check User_Replied / Bot_Replied chain
                for (let i = 1; i <= 25; i++) {
                    if (lead[`User_Replied_${i}`] && String(lead[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
                    if (lead[`Bot_Replied_${i}`]) return true;
                }
                // Legacy W.P_ fields
                if (lead.stages_passed?.some?.((s: string) => s.toLowerCase().includes("whatsapp"))) return true;
                for (let i = 1; i <= 12; i++) {
                    if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) return true;
                }
                return false;
            });
            setLeads(wpLeads);
        } else {
            // meta_lead_tracker — show all leads that have any Whatsapp_ field
            const wpLeads = metaLeads.filter((lead: any) => {
                if (lead._table && lead._table !== 'meta_lead_tracker') return false;
                for (let i = 1; i <= 5; i++) {
                    if (lead[`Whatsapp_${i}`]) return true;
                }
                for (let i = 1; i <= 25; i++) {
                    if (lead[`User_Replied_${i}`] && String(lead[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
                    if (lead[`Bot_Replied_${i}`]) return true;
                }
                return false;
            });
            setLeads(wpLeads as any);
        }
    }, [allLeads, loadingLeads, sourceTable, metaLeads, loadingMeta]);

    const filteredLeads = useMemo(() => {
        return leads.filter(l => {
            const lead = l as any;
            const leadName = (lead.name || lead.Name || lead.full_name || '').toLowerCase();
            const leadPhone = String(lead.phone || lead.Phone || lead.company_phone_number || '');
            const matchesSearch = leadName.includes(searchQuery.toLowerCase()) ||
                leadPhone.includes(searchQuery);

            let hasReplied = false;
            // New schema
            for (let i = 1; i <= 25; i++) {
                const r = lead[`User_Replied_${i}`];
                if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') {
                    hasReplied = true;
                    break;
                }
            }
            // Legacy
            if (!hasReplied && lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
                hasReplied = true;
            }
            if (!hasReplied) {
                for (let i = 1; i <= 10; i++) {
                    const r = lead[`W.P_Replied_${i}`];
                    if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                        hasReplied = true;
                        break;
                    }
                }
            }

            const matchesReplyStatus = activeFilters.replyStatus.length === 0 ||
                (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                (activeFilters.replyStatus.includes("No Reply") && !hasReplied);

            const matchesLoop = activeFilters.loops.length === 0 ||
                activeFilters.loops.some(loop => {
                    const lName = (lead.source_loop || "").toLowerCase();
                    const target = loop.toLowerCase();
                    if (target === "follow up") return lName.includes("follow up") || lName.includes("followup");
                    return lName.includes(target);
                });

            const matchesMessageStatus = activeFilters.messageStatus.length === 0 ||
                activeFilters.messageStatus.some(status => {
                    const target = status.toLowerCase();
                    // New schema: Whatsapp_X_status
                    for (let i = 1; i <= 5; i++) {
                        if ((lead[`Whatsapp_${i}_status`] || "").toLowerCase().includes(target)) return true;
                    }
                    // New schema: Bot_Replied_Status_X
                    for (let i = 1; i <= 25; i++) {
                        if ((lead[`Bot_Replied_Status_${i}`] || "").toLowerCase().includes(target)) return true;
                    }
                    // Legacy: W.P_X TS
                    for (let i = 1; i <= 12; i++) {
                        if ((lead[`W.P_${i} TS`] || "").toLowerCase().includes(target)) return true;
                    }
                    return false;
                });

            // Date filter using "Whatsapp Last Contacted" column
            let matchesDate = true;
            if (dateRange?.from) {
                const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                if (wlc) {
                    const contactDate = new Date(wlc);
                    const from = startOfDay(new Date(dateRange.from));
                    const to = endOfDay(new Date(dateRange.to || dateRange.from));
                    matchesDate = contactDate >= from && contactDate <= to;
                } else {
                    matchesDate = false;
                }
            }

            return matchesSearch && matchesReplyStatus && matchesLoop && matchesMessageStatus && matchesDate;
        }).sort((a, b) => {
            const aLead = a as any;
            const bLead = b as any;
            const wlcA = aLead["Whatsapp Last Contacted"] || aLead["whatsapp_last_contacted"];
            const wlcB = bLead["Whatsapp Last Contacted"] || bLead["whatsapp_last_contacted"];
            const dateA = wlcA ? new Date(wlcA).getTime() : 0;
            const dateB = wlcB ? new Date(wlcB).getTime() : 0;
            return dateB - dateA;
        });
    }, [leads, searchQuery, activeFilters, dateRange]);

    // --- Stats derived directly from filteredLeads so metric card = sum of table rows ---
    const stats = useMemo(() => {
        let sentCount = 0;
        let repliedCount = 0;
        let failedCount = 0;
        filteredLeads.forEach(l => {
            const lead = l as any;
            let leadSentCount = 0;
            
            // --- Count Sent ---
            // Preference to new schema 1-5, then Bot Replies, then legacy
            for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) leadSentCount++; }
            for (let i = 1; i <= 25; i++) { if (lead[`Bot_Replied_${i}`] && String(lead[`Bot_Replied_${i}`]).trim()) leadSentCount++; }
            
            // Only add legacy counts if new schema didn't yield much (avoid double counting same drip)
            if (leadSentCount === 0) {
                for (let i = 1; i <= 12; i++) { if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) leadSentCount++; }
            }
            
            sentCount += leadSentCount;


            // --- Count Failed ---
            for (let i = 1; i <= 5; i++) {
                if (String(lead[`Whatsapp_${i}_status`] || "").toLowerCase().includes("failed")) failedCount++;
            }
            for (let i = 1; i <= 25; i++) {
                if (String(lead[`Bot_Replied_Status_${i}`] || "").toLowerCase().includes("failed")) failedCount++;
            }
            for (let i = 1; i <= 12; i++) {
                if (String(lead[`W.P_${i} TS`] || "").toLowerCase().includes("failed")) failedCount++;
            }

            // --- Count Replied ---
            let hasReplied = false;
            for (let i = 1; i <= 25; i++) {
                const r = lead[`User_Replied_${i}`];
                if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') {
                    hasReplied = true;
                    break;
                }
            }
            if (!hasReplied && lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
                hasReplied = true;
            }
            if (!hasReplied) {
                for (let i = 1; i <= 10; i++) {
                    const r = lead[`W.P_Replied_${i}`];
                    if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                        hasReplied = true;
                        break;
                    }
                }
            }
            if (hasReplied) repliedCount++;
        });

        const uniqueSentCount = filteredLeads.filter(l => {
            const lead = l as any;
            for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`]) return true; }
            for (let i = 1; i <= 25; i++) { if (lead[`Bot_Replied_${i}`]) return true; }
            for (let i = 1; i <= 12; i++) { if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) return true; }
            if (lead["W.P_FollowUp"] || lead.stage_data?.["WhatsApp FollowUp"]) return true;
            for (let i = 1; i <= 10; i++) { if (lead[`W.P_FollowUp_${i}`]) return true; }
            return false;
        }).length;

        return {
            totalLeads: filteredLeads.length,
            sentCount,
            uniqueSentCount,
            repliedCount,
            failedCount,
        };
    }, [filteredLeads]);

    const handleApplyFilters = () => { setActiveFilters(pendingFilters); };
    const handleResetFilters = () => {
        const reset = { replyStatus: [], loops: [], messageStatus: [] };
        setPendingFilters(reset);
        setActiveFilters(reset);
    };

    const toggleFilter = (type: 'replyStatus' | 'loops' | 'messageStatus', value: string) => {
        setPendingFilters(prev => {
            const current = prev[type];
            if (current.includes(value)) {
                return { ...prev, [type]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [type]: [...current, value] };
            }
        });
    };

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return filteredLeads.slice(start, start + leadsPerPage);
    }, [filteredLeads, currentPage]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange]);

    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) {
                items.push(renderPageButton(i));
            }
        } else {
            items.push(renderPageButton(1));

            if (currentPage > 3) {
                items.push(<span key="dots-1" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (i > 1 && i < totalPages) {
                    items.push(renderPageButton(i));
                }
            }

            if (currentPage < totalPages - 2) {
                items.push(<span key="dots-2" className="flex items-center justify-center w-8 h-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></span>);
            }

            items.push(renderPageButton(totalPages));
        }
        return items;
    };

    const renderPageButton = (page: number) => (
        <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            className={`h-8 w-8 text-xs font-bold ${currentPage === page ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
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
                    <p className="text-slate-500 text-sm mt-1">Real-time engagement across your leads</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {/* Table Source Selector */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
                        <button
                            onClick={() => { setSourceTable('icp_tracker'); setCurrentPage(1); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                sourceTable === 'icp_tracker'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Database className="h-3.5 w-3.5" />
                            ICP Tracker
                        </button>
                        <button
                            onClick={() => { setSourceTable('meta_lead_tracker'); setCurrentPage(1); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                sourceTable === 'meta_lead_tracker'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Database className="h-3.5 w-3.5" />
                            Meta Lead
                        </button>
                    </div>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2 h-10 px-4">
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
                                {(activeFilters.replyStatus.length > 0 || activeFilters.loops.length > 0 || activeFilters.messageStatus.length > 0) && (
                                    <button onClick={handleResetFilters} className="text-[10px] text-emerald-600 font-bold hover:underline">RESET</button>
                                )}
                            </div>

                            <FilterSection title="Reply Status" >
                                <FilterOption label="Replied" checked={pendingFilters.replyStatus.includes("Replied")} onCheckedChange={() => toggleFilter('replyStatus', "Replied")} />
                                <FilterOption label="No Reply" checked={pendingFilters.replyStatus.includes("No Reply")} onCheckedChange={() => toggleFilter('replyStatus', "No Reply")} />
                            </FilterSection>

                            <FilterSection title="Loop">
                                <FilterOption label="Intro" checked={pendingFilters.loops.includes("Intro")} onCheckedChange={() => toggleFilter('loops', "Intro")} />
                                <FilterOption label="Follow Up" checked={pendingFilters.loops.includes("Follow Up")} onCheckedChange={() => toggleFilter('loops', "Follow Up")} />
                                <FilterOption label="Nurture" checked={pendingFilters.loops.includes("Nurture")} onCheckedChange={() => toggleFilter('loops', "Nurture")} />
                            </FilterSection>

                            <FilterSection title="Message Status">
                                <FilterOption label="Read" checked={pendingFilters.messageStatus.includes("Read")} onCheckedChange={() => toggleFilter('messageStatus', "Read")} />
                                <FilterOption label="Sent" checked={pendingFilters.messageStatus.includes("Sent")} onCheckedChange={() => toggleFilter('messageStatus', "Sent")} />
                                <FilterOption label="Failed" checked={pendingFilters.messageStatus.includes("Failed")} onCheckedChange={() => toggleFilter('messageStatus', "Failed")} />
                                <FilterOption label="Delivered" checked={pendingFilters.messageStatus.includes("Delivered")} onCheckedChange={() => toggleFilter('messageStatus', "Delivered")} />
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
                                            <th className="px-4 py-3 text-center">Loop</th>
                                            <th className="px-4 py-3 text-center">Messages Sent</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Message Status</th>
                                            <th className="px-4 py-3 text-right">Last Contacted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {paginatedLeads.map((lead: any, idx) => {
                                            const uniqueId = String(lead.id || lead.phone || lead.Phone || lead.company_phone_number || `meta_${idx}`);
                                            return (
                                                <CustomerRow key={uniqueId} lead={lead} onClick={() => setSelectedLeadId(uniqueId)} loopMap={loopMap} />
                                            );
                                        })}
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
                                        <div className="flex gap-1">
                                            {renderPaginationItems()}
                                        </div>
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

            <Dialog open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLeadId && <WhatsAppChatDetail customerId={selectedLeadId} onClose={() => setSelectedLeadId(null)} sourceTable={sourceTable} metaLeads={metaLeads} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ title, value, desc, icon: Icon, dots }: any) {
    return (
        <Card className="bg-white border-border shadow-sm">
            <CardContent className="p-4">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-2"><Icon className="h-5 w-5" /></div>
                <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
                <p className="text-xs font-medium text-slate-500">{title}</p>
                <p className="text-[10px] text-slate-400 mt-1">{desc}</p>
                {dots && (
                    <div className="flex gap-1 mt-2">
                        <div className="h-2 w-2 rounded-full bg-blue-400" /><div className="h-2 w-2 rounded-full bg-emerald-500" /><div className="h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                )}
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

function CustomerRow({ lead: leadRaw, onClick, loopMap = {} }: { lead: ConsolidatedLead; onClick: () => void; loopMap?: Record<string, string> }) {
    const lead = leadRaw as any;
    const latestDate = getLeadLatestActivity(lead);

    // Count sent messages — coordinated with stats logic
    let sentCount = 0;
    // Preference to new schema 1-5, then Bot Replies, then legacy
    for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) sentCount++; }
    for (let i = 1; i <= 25; i++) { if (lead[`Bot_Replied_${i}`] && String(lead[`Bot_Replied_${i}`]).trim()) sentCount++; }
    
    // Only add legacy counts if new schema didn't yield much (avoid double counting same drip)
    if (sentCount === 0) {
        for (let i = 1; i <= 12; i++) { if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) sentCount++; }
    }

    // Get latest Bot_Replied_Status (new schema) — find the last bot message's status + timestamp
    let latestBotStatus: string | null = null;
    let latestBotStatusIndex = 0;
    let latestBotTimestamp: string | null = null;
    for (let i = 25; i >= 1; i--) {
        const s = lead[`Bot_Replied_Status_${i}`];
        if (s && String(s).trim()) {
            latestBotStatus = String(s).trim();
            latestBotStatusIndex = i;
            latestBotTimestamp = lead[`Bot_Replied_TS_${i}`] || lead[`Bot_Replied_Timestamp_${i}`] || null;
            break;
        }
    }

    // Fallback: Whatsapp_1_status through Whatsapp_5_status (drip message statuses)
    if (!latestBotStatus) {
        for (let i = 5; i >= 1; i--) {
            const s = lead[`Whatsapp_${i}_status`] || lead.stage_data?.[`Whatsapp_${i}_status`];
            if (s && String(s).trim()) {
                latestBotStatus = String(s).trim();
                latestBotStatusIndex = i;
                break;
            }
        }
    }

    // Legacy fallback: W.P_ TS fields
    const legacyStatuses = [];
    if (!latestBotStatus) {
        for (let i = 1; i <= 12; i++) {
            if (lead[`W.P_${i} TS`]) {
                legacyStatuses.push({ index: i, status: lead[`W.P_${i} TS`] });
            }
        }
    }
    const displayLegacyStatuses = legacyStatuses.slice(-2);

    // Check if user has replied — new schema + legacy
    let hasReplied = false;
    for (let i = 1; i <= 25; i++) {
        const r = lead[`User_Replied_${i}`];
        if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') {
            hasReplied = true;
            break;
        }
    }
    if (!hasReplied && lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") {
        hasReplied = true;
    }
    if (!hasReplied) {
        for (let i = 1; i <= 10; i++) {
            const r = lead[`W.P_Replied_${i}`];
            if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") {
                hasReplied = true;
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

    const displayPhone = lead.phone || lead.Phone || lead.company_phone_number || '';
    const displayName = lead.name || lead.Name || lead.full_name || displayPhone || 'Unknown';
    // Use _table source for Loop column as requested
    const displayLoop = lead._table === 'icp_tracker' ? 'ICP Tracker' : 'Meta Lead';

    return (
        <tr className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={onClick}>
            <td className="px-4 py-3">
                <div className="block">
                    <div className="font-bold text-slate-900 group-hover:text-emerald-700">{displayName}</div>
                    <div className="text-xs text-slate-500">{displayPhone}</div>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                {displayLoop ? (
                    <Badge variant="outline" className="text-[10px] uppercase font-bold border-borderlue-100 text-blue-600 bg-blue-50">{displayLoop}</Badge>
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
                                {hasReplied ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] text-slate-400 border-border">SENT</Badge>
                                )}
                            </div>
                        </TooltipTrigger>
                        {hasReplied && (
                            <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">
                                {formatTooltipDate(latestDate)}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-1.5">
                    {latestBotStatus ? (
                        <MessageStatusBadge index={latestBotStatusIndex} status={latestBotStatus} fallbackTimestamp={latestBotTimestamp} />
                    ) : displayLegacyStatuses.length > 0 ? (
                        displayLegacyStatuses.map((s) => (
                            <MessageStatusBadge key={s.index} index={s.index} status={s.status} />
                        ))
                    ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-right text-slate-500 text-xs text-nowrap">
                {(() => {
                    const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                    if (wlc) {
                        const d = new Date(wlc);
                        if (!isNaN(d.getTime())) return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                    return <span className="text-slate-300">—</span>;
                })()}
            </td>
        </tr>
    );
}

function MessageStatusBadge({ index, status, fallbackTimestamp }: { index: number, status: string, fallbackTimestamp?: string | null }) {
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
                    <div className="flex items-center gap-1.5 w-full justify-center cursor-help">
                        <span className="text-[9px] text-slate-400 font-mono select-none">{index}</span>
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
