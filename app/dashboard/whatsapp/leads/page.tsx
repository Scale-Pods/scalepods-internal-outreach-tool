"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search, Filter, ChevronLeft, ChevronRight, MoreVertical,
    RefreshCw, Database, X
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { SPLoader } from "@/components/sp-loader";
import { useData } from "@/context/DataContext";
import { startOfDay, endOfDay } from "date-fns";

// Helper: check if lead has replied — matches chat page logic
const hasLeadReplied = (lead: any) => {
    for (let i = 1; i <= 25; i++) {
        const r = lead[`User_Replied_${i}`];
        if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') return true;
    }
    if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") return true;
    const wtsTrack = lead["WTS_Reply_Track"];
    if (wtsTrack && String(wtsTrack).trim() !== "" && String(wtsTrack).toLowerCase() !== "no" && String(wtsTrack).toLowerCase() !== "none" && String(wtsTrack).toLowerCase() !== "false") return true;
    for (let i = 1; i <= 10; i++) {
        const r = lead[`W.P_Replied_${i}`];
        if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") return true;
    }
    return false;
};

// Helper: check if lead has WhatsApp activity — matches chat page logic
const hasWhatsappActivity = (lead: any, table: string) => {
    if (table === 'icp_tracker') {
        for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`]) return true; }
        for (let i = 1; i <= 25; i++) {
            if (lead[`User_Replied_${i}`] && String(lead[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
            if (lead[`Bot_Replied_${i}`]) return true;
        }
        if (lead.stages_passed?.some?.((s: string) => s.toLowerCase().includes("whatsapp"))) return true;
        for (let i = 1; i <= 12; i++) {
            if (lead[`W.P_${i}`] || lead.stage_data?.[`WhatsApp ${i}`]) return true;
        }
        return false;
    }
    for (let i = 1; i <= 5; i++) { if (lead[`Whatsapp_${i}`]) return true; }
    for (let i = 1; i <= 25; i++) {
        if (lead[`User_Replied_${i}`] && String(lead[`User_Replied_${i}`]).toLowerCase() !== 'no') return true;
        if (lead[`Bot_Replied_${i}`]) return true;
    }
    return false;
};

export default function WhatsappLeadsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadSource, setSelectedLeadSource] = useState<'icp_tracker' | 'meta_lead_tracker'>('icp_tracker');
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 15;

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined, to: undefined
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[], campaign: string[]
    }>({ replyStatus: [], campaign: [] });

    const loading = loadingLeads;
    const hasActiveFilters = activeFilters.replyStatus.length > 0 || activeFilters.campaign.length > 0 || !!dateRange.from || !!searchQuery;

    const combinedLeads = useMemo(() => {
        if (loadingLeads) return [];
        return allLeads
            .filter((l: any) => hasWhatsappActivity(l, l._table || 'icp_tracker'))
            .map((l: any) => ({ ...l, _source: l._table === 'meta_lead_tracker' ? 'meta_lead_tracker' : 'icp_tracker' }));
    }, [allLeads, loadingLeads]);

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            const leadName = (lead.name || lead.Name || '').toLowerCase();
            const leadPhone = lead.phone || lead.Phone || '';
            const leadEmail = (lead.email || lead.Email || '').toLowerCase();
            if (searchQuery && !leadName.includes(searchQuery.toLowerCase()) && !leadEmail.includes(searchQuery.toLowerCase()) && !leadPhone.includes(searchQuery)) return false;

            if (dateRange.from) {
                const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                if (!wlc) return false;
                const contactDate = new Date(wlc);
                const from = startOfDay(new Date(dateRange.from));
                const to = endOfDay(new Date(dateRange.to || dateRange.from));
                if (contactDate < from || contactDate > to) return false;
            }

            const replied = hasLeadReplied(lead);
            if (activeFilters.replyStatus.length > 0) {
                const match = (activeFilters.replyStatus.includes("Replied") && replied) || (activeFilters.replyStatus.includes("Sent") && !replied);
                if (!match) return false;
            }

            if (activeFilters.campaign.length > 0 && !activeFilters.campaign.includes(lead._source)) return false;
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
            return { ...prev, [type]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
        });
    };

    const resetFilters = () => {
        setActiveFilters({ replyStatus: [], campaign: [] });
        setDateRange({ from: undefined, to: undefined });
        setSearchQuery("");
    };

    const toggleSelectAll = () => {
        setSelectedLeads(selectedLeads.length === filteredLeads.length ? [] : filteredLeads.map(l => l.id || l.Phone || Math.random().toString()));
    };

    const toggleSelect = (id: string) => {
        setSelectedLeads(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
    };

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    const metaLeadsForChat = useMemo(() => allLeads.filter((l: any) => l._table === 'meta_lead_tracker'), [allLeads]);

    if (loading) return <SPLoader />;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            {/* Header + Filters — single compact bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">WhatsApp Leads</h1>
                    <p className="text-slate-500 text-xs">ICP & Meta leads with WhatsApp activity</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                </div>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${activeFilters.replyStatus.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}>
                            <Filter className="h-3 w-3" />
                            {activeFilters.replyStatus.length > 0 ? `Status (${activeFilters.replyStatus.length})` : 'Status'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Replied')}>Replied {activeFilters.replyStatus.includes('Replied') && "✓"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Sent')}>Sent {activeFilters.replyStatus.includes('Sent') && "✓"}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${activeFilters.campaign.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            <Database className="h-3 w-3" />
                            {activeFilters.campaign.length > 0 ? `Source (${activeFilters.campaign.length})` : 'Source'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => toggleFilter('campaign', 'icp_tracker')}>ICP Tracker {activeFilters.campaign.includes('icp_tracker') && "✓"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleFilter('campaign', 'meta_lead_tracker')}>Meta Lead {activeFilters.campaign.includes('meta_lead_tracker') && "✓"}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                        <X className="h-3 w-3" /> Reset
                    </Button>
                )}

                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-3 w-3" />
                </Button>
            </div>

            {/* Table */}
            <Card className="border-border overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase sticky top-0 z-10">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5 w-[36px]">
                                        <Checkbox checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
                                    </th>
                                    <th className="px-3 py-2.5">Name</th>
                                    <th className="px-3 py-2.5">Phone</th>
                                    <th className="px-3 py-2.5">Source</th>
                                    <th className="px-3 py-2.5 text-center">Status</th>
                                    <th className="px-3 py-2.5">Last Contacted</th>
                                    <th className="px-3 py-2.5 w-[40px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLeads.length === 0 ? (
                                    <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => {
                                        const leadId = lead.id || lead.Phone || `lead-${index}`;
                                        const leadName = lead.name || lead.Name || lead.full_name || lead.phone || lead.Phone || 'Unknown';
                                        const leadPhone = lead.phone || lead.Phone || lead.company_phone_number || '';
                                        const replied = hasLeadReplied(lead);
                                        const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
                                        const isIcp = lead._source === 'icp_tracker';

                                        return (
                                            <tr key={`${leadId}-${index}`} className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                onClick={() => { setSelectedLeadSource(lead._source); setSelectedLeadIdForChat(leadId); }}>
                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox checked={selectedLeads.includes(leadId)} onCheckedChange={() => toggleSelect(leadId)} className="h-3.5 w-3.5" />
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs">{leadName}</td>
                                                <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{leadPhone}</td>
                                                <td className="px-3 py-2">
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${isIcp ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                        {isIcp ? 'ICP' : 'Meta'}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${replied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {replied ? 'REPLIED' : 'SENT'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-[11px]">
                                                    {wlc ? new Date(wlc).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3.5 w-3.5" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setSelectedLeadSource(lead._source); setSelectedLeadIdForChat(leadId); }}>View Chat</DropdownMenuItem>
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
                    <div className="px-3 py-2 border-t border-border bg-slate-50/50 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">{filteredLeads.length}</span> leads
                            {activeFilters.campaign.length > 0 && ` · ${activeFilters.campaign.map(c => c === 'icp_tracker' ? 'ICP' : 'Meta').join(', ')}`}
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-7 w-7 p-0"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                                <span className="text-[11px] font-bold text-slate-600 px-2">{currentPage}/{totalPages}</span>
                                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-7 w-7 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Chat Detail Modal */}
            <Dialog open={!!selectedLeadIdForChat} onOpenChange={(open) => !open && setSelectedLeadIdForChat(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLeadIdForChat && (
                        <WhatsAppChatDetail customerId={selectedLeadIdForChat} onClose={() => setSelectedLeadIdForChat(null)} sourceTable={selectedLeadSource} metaLeads={metaLeadsForChat} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
