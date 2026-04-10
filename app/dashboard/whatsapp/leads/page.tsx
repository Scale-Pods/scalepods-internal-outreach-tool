"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Filter,
    Download,
    UserPlus,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    FileSpreadsheet,
    ArrowUpDown,
    Calendar,
    Briefcase,
    RefreshCw,
    Database
} from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { startOfDay, endOfDay } from "date-fns";

// Helper: check if lead has replied
const hasLeadReplied = (lead: any) => {
    for (let i = 1; i <= 25; i++) {
        const r = lead[`User_Replied_${i}`];
        if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') return true;
    }
    if (lead.whatsapp_replied && String(lead.whatsapp_replied).toLowerCase() !== "no" && String(lead.whatsapp_replied).toLowerCase() !== "none") return true;
    return false;
};

export default function WhatsappLeadsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [combinedLeads, setCombinedLeads] = useState<any[]>([]);
    const [metaLeads, setMetaLeads] = useState<any[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadSource, setSelectedLeadSource] = useState<'icp_tracker' | 'meta_lead_tracker'>('icp_tracker');
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[],
        campaign: string[]
    }>({
        replyStatus: [],
        campaign: []
    });

    // Fetch meta_lead_tracker
    useEffect(() => {
        (async () => {
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
        })();
    }, []);

    // Combine and tag leads from both tables
    useEffect(() => {
        if (loadingLeads || loadingMeta) return;

        const icpTagged = allLeads
            .filter((l: any) => {
                const wlc = l["Whatsapp Last Contacted"] || l["whatsapp_last_contacted"];
                return wlc && String(wlc).trim() !== "";
            })
            .map((l: any) => ({ ...l, _source: 'icp_tracker' as const }));

        const metaTagged = metaLeads
            .filter((l: any) => {
                const wlc = l["Whatsapp Last Contacted"] || l["whatsapp_last_contacted"];
                return wlc && String(wlc).trim() !== "";
            })
            .map((l: any) => ({ ...l, _source: 'meta_lead_tracker' as const }));

        setCombinedLeads([...icpTagged, ...metaTagged]);
    }, [allLeads, loadingLeads, metaLeads, loadingMeta]);

    const loading = loadingLeads || loadingMeta;

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            const leadName = (lead.name || lead.Name || '').toLowerCase();
            const leadPhone = lead.phone || lead.Phone || '';
            const leadEmail = (lead.email || lead.Email || '').toLowerCase();
            const matchesSearch = leadName.includes(searchQuery.toLowerCase()) ||
                leadEmail.includes(searchQuery.toLowerCase()) ||
                leadPhone.includes(searchQuery);
            if (!matchesSearch) return false;

            // Date range filter using Whatsapp Last Contacted
            if (dateRange.from) {
                const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                if (wlc) {
                    const contactDate = new Date(wlc);
                    const from = startOfDay(new Date(dateRange.from));
                    const to = endOfDay(new Date(dateRange.to || dateRange.from));
                    if (contactDate < from || contactDate > to) return false;
                } else {
                    return false;
                }
            }

            // Reply status filter
            const replied = hasLeadReplied(lead);
            if (activeFilters.replyStatus.length > 0) {
                const matchesReply = (activeFilters.replyStatus.includes("Replied") && replied) ||
                    (activeFilters.replyStatus.includes("Sent") && !replied);
                if (!matchesReply) return false;
            }

            // Campaign (source table) filter
            if (activeFilters.campaign.length > 0) {
                if (!activeFilters.campaign.includes(lead._source)) return false;
            }

            return true;
        }).sort((a, b) => {
            const wlcA = a["Whatsapp Last Contacted"] || a["whatsapp_last_contacted"];
            const wlcB = b["Whatsapp Last Contacted"] || b["whatsapp_last_contacted"];
            return new Date(wlcB).getTime() - new Date(wlcA).getTime();
        });
    }, [combinedLeads, searchQuery, dateRange, activeFilters]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange]);

    const toggleFilter = (type: 'replyStatus' | 'campaign', value: string) => {
        setActiveFilters(prev => {
            const current = prev[type];
            if (current.includes(value)) {
                return { ...prev, [type]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [type]: [...current, value] };
            }
        });
    };

    const resetFilters = () => {
        setActiveFilters({ replyStatus: [], campaign: [] });
        setDateRange({ from: undefined, to: undefined });
        setSearchQuery("");
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filteredLeads.map(l => l.id || l.Phone || Math.random().toString()));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
    const paginatedLeads = filteredLeads.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );

    if (loading) {
        return <SPLoader />;
    }

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Leads</h1>
                    <p className="text-slate-500 text-sm mt-1">Leads with WhatsApp contact history across all campaigns</p>
                </div>
                <div className="flex items-center gap-3">
                    {(activeFilters.replyStatus.length > 0 || activeFilters.campaign.length > 0 || dateRange.from || searchQuery) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                        >
                            RESET FILTERS
                        </Button>
                    )}
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-10 h-10 bg-slate-50/50 border-border"
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 h-10 border-border ${activeFilters.replyStatus.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}>
                                <Filter className="h-4 w-4" />
                                {activeFilters.replyStatus.length > 0 ? `Status (${activeFilters.replyStatus.length})` : 'Status'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Replied')} className="flex items-center justify-between">
                                Replied {activeFilters.replyStatus.includes('Replied') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Sent')} className="flex items-center justify-between">
                                Sent {activeFilters.replyStatus.includes('Sent') && "✓"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 h-10 border-border ${activeFilters.campaign.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                                <Database className="h-4 w-4" />
                                {activeFilters.campaign.length > 0 ? `Campaign (${activeFilters.campaign.length})` : 'Campaign'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => toggleFilter('campaign', 'icp_tracker')} className="flex items-center justify-between">
                                ICP Tracker {activeFilters.campaign.includes('icp_tracker') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('campaign', 'meta_lead_tracker')} className="flex items-center justify-between">
                                Meta Lead Tracker {activeFilters.campaign.includes('meta_lead_tracker') && "✓"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" className="gap-2 h-10 border-border" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedLeads.length > 0 && (
                <div className="bg-white border border-emerald-100 p-3 rounded-lg flex items-center justify-between shadow-sm">
                    <span className="text-sm font-bold text-slate-700">{selectedLeads.length} leads selected</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-border text-slate-600">Export Selected</Button>
                    </div>
                </div>
            )}

            {/* Leads Table */}
            <Card className="border-border overflow-hidden shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-border">
                                    <th className="px-4 py-4 w-[40px]">
                                        <Checkbox
                                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">Name</th>
                                    <th className="px-4 py-4">Phone</th>
                                    <th className="px-4 py-4">Campaign</th>
                                    <th className="px-4 py-4 text-center">Reply Status</th>
                                    <th className="px-4 py-4">Last Contacted</th>
                                    <th className="px-4 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                            No leads with WhatsApp contact history found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => {
                                        const leadId = lead.id || lead.Phone || `lead-${index}`;
                                        const leadName = lead.name || lead.Name || 'Unknown';
                                        const leadPhone = lead.phone || lead.Phone || '';
                                        const replied = hasLeadReplied(lead);
                                        const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                                        const isIcp = lead._source === 'icp_tracker';

                                        return (
                                            <tr
                                                key={`${leadId}-${index}`}
                                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                                onClick={() => {
                                                    setSelectedLeadSource(lead._source);
                                                    setSelectedLeadIdForChat(leadId);
                                                }}
                                            >
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedLeads.includes(leadId)}
                                                        onCheckedChange={() => toggleSelect(leadId)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 font-bold text-slate-900">{leadName}</td>
                                                <td className="px-4 py-4 text-slate-600 font-mono text-xs">{leadPhone}</td>
                                                <td className="px-4 py-4">
                                                    <Badge variant="outline" className={`text-[10px] uppercase font-bold ${
                                                        isIcp
                                                            ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                            : 'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                        {isIcp ? 'ICP Tracker' : 'Meta Lead'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <StatusBadge replied={replied} />
                                                </td>
                                                <td className="px-4 py-4 text-slate-500 text-xs">
                                                    {wlc ? new Date(wlc).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </td>
                                                <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => {
                                                                setSelectedLeadSource(lead._source);
                                                                setSelectedLeadIdForChat(leadId);
                                                            }}>View Chat</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-900">{paginatedLeads.length}</span> of <span className="font-bold text-slate-900">{filteredLeads.length}</span> contacted leads
                        </p>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;

                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Chat Detail Modal */}
            <Dialog open={!!selectedLeadIdForChat} onOpenChange={(open) => !open && setSelectedLeadIdForChat(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>WhatsApp Chat Detail</DialogTitle>
                    </DialogHeader>
                    {selectedLeadIdForChat && (
                        <WhatsAppChatDetail
                            customerId={selectedLeadIdForChat}
                            onClose={() => setSelectedLeadIdForChat(null)}
                            sourceTable={selectedLeadSource}
                            metaLeads={metaLeads}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ replied }: { replied: boolean }) {
    const classes = replied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
    const label = replied ? "REPLIED" : "SENT";

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${classes}`}>
            {label}
        </span>
    );
}

