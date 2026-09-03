"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search, Filter, ChevronLeft, ChevronRight,
    RefreshCw, Database, X, Snowflake, Flame, Building2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { SPLoader } from "@/components/sp-loader";
import { startOfDay, endOfDay, subDays } from "date-fns";
import type { NormalizedWaLead, LeadType } from "@/lib/services/whatsapp-outreach";
import { getWaLastContacted, countSentMessages, hasReplied } from "@/lib/services/whatsapp-outreach";

const LEAD_TYPE_META: Record<LeadType, { label: string; icon: typeof Flame; className: string }> = {
    hot: { label: 'Hot', icon: Flame, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    cold: { label: 'Cold', icon: Snowflake, className: 'bg-blue-50 text-blue-700 border-blue-100' },
    hubspot_wa: { label: 'HubSpot WA', icon: Building2, className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function WhatsappLeadsPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedWaLead[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedWaLead[]>([]);
    const [hubspotWaLeads, setHubspotWaLeads] = useState<NormalizedWaLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLead, setSelectedLead] = useState<NormalizedWaLead | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 15;

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 7),
        to: new Date()
    });

    const [activeFilters, setActiveFilters] = useState<{ replyStatus: string[], source: LeadType[] }>({
        replyStatus: [], source: []
    });

    const hasActiveFilters = activeFilters.replyStatus.length > 0 || activeFilters.source.length > 0 || !!dateRange.from || !!searchQuery;

    const fetchData = async (range?: { from?: Date; to?: Date }) => {
        setLoading(true);
        try {
            const r = range ?? dateRange;
            const params = new URLSearchParams();
            if (r.from) {
                params.set('from', startOfDay(new Date(r.from)).toISOString());
                params.set('to', endOfDay(new Date(r.to || r.from)).toISOString());
            }
            const res = await fetch(`/api/whatsapp/outreach${params.toString() ? `?${params.toString()}` : ''}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
            setHubspotWaLeads(json.hubspotWa?.leads || []);
        } catch (err) {
            console.error("Failed to fetch WhatsApp leads:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const combinedLeads = useMemo(() => [...coldLeads, ...hotLeads, ...hubspotWaLeads], [coldLeads, hotLeads, hubspotWaLeads]);

    const filteredLeads = useMemo(() => {
        return combinedLeads.filter(lead => {
            const q = searchQuery.toLowerCase();
            if (q && !lead.fullName.toLowerCase().includes(q) && !lead.phone.includes(searchQuery)) return false;

            // Date range is applied server-side (fetchData passes from/to
            // to the API), so combinedLeads is already scoped.

            const replied = hasReplied(lead);
            if (activeFilters.replyStatus.length > 0) {
                const match = (activeFilters.replyStatus.includes("Replied") && replied) || (activeFilters.replyStatus.includes("Sent") && !replied);
                if (!match) return false;
            }

            if (activeFilters.source.length > 0 && !activeFilters.source.includes(lead.leadType)) return false;
            return true;
        }).sort((a, b) => {
            const wlcA = getWaLastContacted(a);
            const wlcB = getWaLastContacted(b);
            const dateA = wlcA ? new Date(wlcA).getTime() : 0;
            const dateB = wlcB ? new Date(wlcB).getTime() : 0;
            return dateB - dateA;
        });
    }, [combinedLeads, searchQuery, dateRange, activeFilters]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange]);

    const toggleFilter = (type: 'replyStatus', value: string) => {
        setActiveFilters(prev => {
            const current = prev[type];
            return { ...prev, [type]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] };
        });
    };

    const toggleSourceFilter = (value: LeadType) => {
        setActiveFilters(prev => ({
            ...prev,
            source: prev.source.includes(value) ? prev.source.filter(v => v !== value) : [...prev.source, value],
        }));
    };

    const resetFilters = () => {
        const cleared = { from: undefined, to: undefined };
        setActiveFilters({ replyStatus: [], source: [] });
        setDateRange(cleared);
        setSearchQuery("");
        fetchData(cleared);
    };

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    if (loading) return <SPLoader />;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">WhatsApp Leads</h1>
                    <p className="text-slate-500 text-xs">Cold (ENRICHED_LEADS), Hot (hubspot_lead) & HubSpot WA (hubspot_wa_outreach) leads with WhatsApp activity</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <DateRangePicker onUpdate={({ range }) => {
                        const next = { from: range?.from, to: range?.to };
                        setDateRange(next);
                        fetchData(next);
                    }} />
                </div>
            </div>

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
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${activeFilters.source.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            <Database className="h-3 w-3" />
                            {activeFilters.source.length > 0 ? `Source (${activeFilters.source.length})` : 'Source'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => toggleSourceFilter('hot')}>Hot Leads {activeFilters.source.includes('hot') && "✓"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleSourceFilter('cold')}>Cold Leads {activeFilters.source.includes('cold') && "✓"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleSourceFilter('hubspot_wa')}>HubSpot WA {activeFilters.source.includes('hubspot_wa') && "✓"}</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                        <X className="h-3 w-3" /> Reset
                    </Button>
                )}

                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fetchData()}>
                    <RefreshCw className="h-3 w-3" />
                </Button>
            </div>

            <Card className="border-border overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase sticky top-0 z-10">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5">Name</th>
                                    <th className="px-3 py-2.5">Phone</th>
                                    <th className="px-3 py-2.5">Source</th>
                                    <th className="px-3 py-2.5 text-center">Messages Sent</th>
                                    <th className="px-3 py-2.5 text-center">Status</th>
                                    <th className="px-3 py-2.5">Whatsapp Last Contacted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLeads.length === 0 ? (
                                    <tr><td colSpan={6} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => {
                                        const replied = hasReplied(lead);
                                        const wlc = getWaLastContacted(lead);
                                        const sentCount = countSentMessages(lead);

                                        return (
                                            <tr key={`${lead.table}-${lead.id}-${index}`} className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                                onClick={() => setSelectedLead(lead)}>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs">{lead.fullName}</td>
                                                <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{lead.phone}</td>
                                                <td className="px-3 py-2">
                                                    {(() => {
                                                        const meta = LEAD_TYPE_META[lead.leadType];
                                                        const Icon = meta.icon;
                                                        return (
                                                            <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 gap-1 ${meta.className}`}>
                                                                <Icon className="h-2.5 w-2.5" />
                                                                {meta.label}
                                                            </Badge>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-slate-700">{sentCount}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${replied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {replied ? 'REPLIED' : 'SENT'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-[11px]">
                                                    {wlc ? new Date(wlc).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-slate-50/50 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">{filteredLeads.length}</span> leads
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

            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLead && (
                        <WhatsAppChatDetail lead={selectedLead} onClose={() => setSelectedLead(null)} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
