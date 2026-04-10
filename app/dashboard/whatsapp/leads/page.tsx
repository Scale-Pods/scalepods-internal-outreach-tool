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
    RefreshCw
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
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
import { consolidateLeads, ConsolidatedLead } from "@/lib/leads-utils";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";

export default function WhatsappLeadsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const loading = loadingLeads;
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    // Filter State
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[],
        loops: string[]
    }>({
        replyStatus: [],
        loops: []
    });

    useEffect(() => {
        if (!loadingLeads) {
            // Filter: only show if last_contacted is NOT empty
            const filtered = allLeads.filter(l => l.last_contacted && String(l.last_contacted).trim() !== "");
            setLeads(filtered);
        }
    }, [allLeads, loadingLeads]);

    const filteredLeads = useMemo(() => {
        setCurrentPage(1); // Reset to first page on filter change
        return leads.filter(l => {
            // Search filter
            const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                l.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                l.phone.includes(searchQuery);

            if (!matchesSearch) return false;

            // Date range filter
            if (dateRange.from && l.last_contacted) {
                const contactDate = new Date(l.last_contacted);
                if (contactDate < dateRange.from) return false;
            }
            if (dateRange.to && l.last_contacted) {
                const contactDate = new Date(l.last_contacted);
                // End of day for "to" date
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);
                if (contactDate > toDate) return false;
            }

            // Reply status filter
            const hasReplied = l.whatsapp_replied && l.whatsapp_replied !== "No" && l.whatsapp_replied !== "none";
            if (activeFilters.replyStatus.length > 0) {
                const matchesReply = (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                    (activeFilters.replyStatus.includes("Sent") && !hasReplied);
                if (!matchesReply) return false;
            }

            // Loop filter
            if (activeFilters.loops.length > 0) {
                if (!activeFilters.loops.includes(l.source_loop)) return false;
            }

            return true;
        });
    }, [leads, searchQuery, dateRange, activeFilters]);

    const toggleFilter = (type: 'replyStatus' | 'loops', value: string) => {
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
        setActiveFilters({ replyStatus: [], loops: [] });
        setDateRange({ from: undefined, to: undefined });
        setSearchQuery("");
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filteredLeads.map(l => l.id));
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(l => l !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    // Pagination Logic
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
            {/* Header section with refined spacing */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Leads</h1>
                    <p className="text-slate-500 text-sm mt-1">Review leads successfully contacted via WhatsApp</p>
                </div>
                <div className="flex items-center gap-3">
                    {(activeFilters.replyStatus.length > 0 || activeFilters.loops.length > 0 || dateRange.from || searchQuery) && (
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

            {/* Search & Simple Filter Bar */}
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
                            <Button variant="outline" className={`gap-2 h-10 border-border ${activeFilters.replyStatus.length > 0 ? 'bg-emerald-50 border-bordermerald-200 text-emerald-700' : ''}`}>
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
                            <Button variant="outline" className={`gap-2 h-10 border-border ${activeFilters.loops.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}`}>
                                <Briefcase className="h-4 w-4" />
                                {activeFilters.loops.length > 0 ? `Loops (${activeFilters.loops.length})` : 'Loops'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => toggleFilter('loops', 'Intro')} className="flex items-center justify-between">
                                Intro {activeFilters.loops.includes('Intro') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('loops', 'followup')} className="flex items-center justify-between">
                                Follow Up {activeFilters.loops.includes('followup') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('loops', 'nurture')} className="flex items-center justify-between">
                                Nurture {activeFilters.loops.includes('nurture') && "✓"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" className="gap-2 h-10 border-border" onClick={() => window.location.reload()}>
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Bulk Action Context Header */}
            {selectedLeads.length > 0 && (
                <div className="bg-white border border-bordermerald-100 p-3 rounded-lg flex items-center justify-between shadow-sm">
                    <span className="text-sm font-bold text-slate-700">{selectedLeads.length} leads selected</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-border text-slate-600 hover:text-slate-900">Send Message</Button>
                        <Button size="sm" variant="outline" className="h-8 border-border text-slate-600 hover:text-slate-900">Export Selected</Button>
                        <Button size="sm" variant="destructive" className="h-8">Remove</Button>
                    </div>
                </div>
            )}

            {/* Leads Table */}
            <Card className="border-border overflow-hidden shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-border border-border">
                                    <th className="px-4 py-4 w-[40px]">
                                        <Checkbox
                                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">Name</th>
                                    <th className="px-4 py-4">Phone</th>
                                    <th className="px-4 py-4">Loop</th>
                                    <th className="px-4 py-4 text-center">Reply Status</th>
                                    <th className="px-4 py-4">Last Contacted</th>
                                    <th className="px-4 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                                            Syncing with Supabase...
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                            No leads with contact history found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => (
                                        <tr
                                            key={`${lead.id}-${index}`}
                                            className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedLeadIdForChat(lead.id)}
                                        >
                                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedLeads.includes(lead.id)}
                                                    onCheckedChange={() => toggleSelect(lead.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-4 font-bold text-slate-900">{lead.name}</td>
                                            <td className="px-4 py-4 text-slate-600 font-mono text-xs">{lead.phone}</td>
                                            <td className="px-4 py-4">
                                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px] uppercase font-bold">
                                                    {lead.source_loop}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <StatusBadge status={lead.whatsapp_replied || "No"} />
                                            </td>
                                            <td className="px-4 py-4 text-slate-500 text-xs">
                                                {new Date(lead.last_contacted!).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>

                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>View Journey</DropdownMenuItem>
                                                        <DropdownMenuItem>Send manual WhatsApp</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600">Exclude from List</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer */}
                    <div className="p-4 border-t border-border bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-900">{paginatedLeads.length}</span> of <span className="font-bold text-slate-900">{filteredLeads.length}</span> contacted leads
                        </p>

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
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
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
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const isNo = String(status).toLowerCase() === "no";
    const classes = isNo ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700";
    const label = isNo ? "SENT" : "REPLIED";

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${classes}`}>
            {label}
        </span>
    );
}
