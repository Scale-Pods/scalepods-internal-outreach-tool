"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SPLoader } from "@/components/sp-loader";
import { Users, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { format } from "date-fns";

interface HubspotLead {
    full_name: string | null;
    company_phone_number: string;
    status: string | null;
    last_conversation: string | null;
    created_at: string;
    lifecyclestage: string | null;
    "Other Personal Emails": string | null;
    "Personal Email": string | null;
    Replied: string | null;
    WTS_Reply_Track: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    "Demo Booked": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Interested": "bg-blue-100 text-blue-700 border-blue-200",
    "Not Interested": "bg-rose-100 text-rose-700 border-rose-200",
    "Follow Up": "bg-amber-100 text-amber-700 border-amber-200",
    "In Progress": "bg-purple-100 text-purple-700 border-purple-200",
    "Closed": "bg-slate-100 text-slate-600 border-slate-200",
};

function statusBadgeClass(status: string) {
    return STATUS_COLORS[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

function hasReplied(lead: HubspotLead) {
    if (lead.WTS_Reply_Track && lead.WTS_Reply_Track.trim() && !["no", "none", "false"].includes(lead.WTS_Reply_Track.trim().toLowerCase())) return true;
    if (lead.Replied && lead.Replied.trim() && !["no", "none", "false"].includes(lead.Replied.trim().toLowerCase())) return true;
    return false;
}


function PaginationFooter({ totalItems, currentPage, itemsPerPage, onPageChange }: {
    totalItems: number; currentPage: number; itemsPerPage: number; onPageChange: (p: number) => void;
}) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const getPageNumbers = (): (number | string)[] => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages];
        if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">Showing {start}–{end} of {totalItems.toLocaleString()} leads</p>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((p, i) =>
                    typeof p === 'string'
                        ? <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">…</span>
                        : <Button key={p} variant={p === currentPage ? "default" : "outline"} size="sm"
                            className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600' : ''}`}
                            onClick={() => onPageChange(p)}>
                            {p}
                        </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

function HubspotLeadsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [leads, setLeads] = useState<HubspotLead[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [repliedFilter, setRepliedFilter] = useState("all");

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const from = fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d; })();
    const to = toParam ? new Date(toParam) : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();

    const fetchLeads = useCallback(async (currentPage: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('from', from.toISOString());
            params.set('to', to.toISOString());
            if (search) params.set('search', search);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (repliedFilter !== 'all') params.set('replied', repliedFilter);

            const res = await fetch(`/api/hubspot-leads?${params.toString()}`);
            const json = await res.json();
            setLeads(json.data || []);
            setTotalCount(json.count || 0);
        } catch (e) {
            console.error('Failed to fetch hubspot leads:', e);
        } finally {
            setLoading(false);
        }
    }, [from.toISOString(), to.toISOString(), search, statusFilter, repliedFilter]);

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter, repliedFilter, fromParam, toParam]);

    useEffect(() => {
        fetchLeads(page);
    }, [page, fetchLeads]);

    const handleDateUpdate = (values: any) => {
        if (values.range?.from) {
            const f = new Date(values.range.from);
            f.setHours(0, 0, 0, 0);
            const t = new Date(values.range.to || values.range.from);
            t.setHours(23, 59, 59, 999);
            const params = new URLSearchParams(searchParams.toString());
            params.set('from', f.toISOString());
            params.set('to', t.toISOString());
            router.push(`?${params.toString()}`);
        }
    };

    const hasActiveFilters = search || statusFilter !== 'all' || repliedFilter !== 'all';

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">HubSpot Leads</h1>
                    <p className="text-sm text-slate-500">
                        {totalCount.toLocaleString()} leads in selected date range
                    </p>
                </div>
                <div className="shrink-0">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-white border-border shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search name, phone, email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-9 text-sm border-slate-200"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-9 text-sm border-slate-200">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Demo Booked">Demo Booked</SelectItem>
                                <SelectItem value="Interested">Interested</SelectItem>
                                <SelectItem value="Not Interested">Not Interested</SelectItem>
                                <SelectItem value="Follow Up">Follow Up</SelectItem>
                                <SelectItem value="In Progress">In Progress</SelectItem>
                                <SelectItem value="Closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={repliedFilter} onValueChange={setRepliedFilter}>
                            <SelectTrigger className="w-[140px] h-9 text-sm border-slate-200">
                                <SelectValue placeholder="Reply Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Replies</SelectItem>
                                <SelectItem value="yes">Replied</SelectItem>
                                <SelectItem value="no">Not Replied</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" className="h-9 text-slate-500 hover:text-slate-900 gap-1"
                                onClick={() => { setSearch(""); setStatusFilter("all"); setRepliedFilter("all"); }}>
                                <X className="h-3.5 w-3.5" /> Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="bg-white border-border shadow-sm">
                <CardHeader className="pb-2 pt-4 px-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                            <Users className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-semibold text-slate-800">HubSpot Lead List</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-100 hover:bg-transparent">
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Personal Email</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Other Personal Emails</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lifecycle Stage</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Replied</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Created At</TableHead>
                                    <TableHead className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Last Conversation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads.length === 0 && !loading ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-12 text-slate-400 text-sm">
                                            No HubSpot leads found for the selected filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leads.map((lead, idx) => (
                                        <TableRow key={idx} className="border-slate-50 hover:bg-slate-50/60 transition-colors">
                                            {/* Full Name */}
                                            <TableCell className="py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 font-bold text-sm flex-shrink-0">
                                                        {(lead.full_name || "?").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-800">{lead.full_name || "—"}</span>
                                                </div>
                                            </TableCell>

                                            {/* Phone */}
                                            <TableCell className="py-3">
                                                <span className="font-mono text-xs text-slate-700">{lead.company_phone_number || "—"}</span>
                                            </TableCell>

                                            {/* Personal Email */}
                                            <TableCell className="py-3">
                                                <span className="text-xs text-slate-600">{lead["Personal Email"] || "—"}</span>
                                            </TableCell>

                                            {/* Other Personal Emails */}
                                            <TableCell className="py-3">
                                                <span className="text-xs text-slate-600">{lead["Other Personal Emails"] || "—"}</span>
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell className="py-3">
                                                {lead.status ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass(lead.status)}`}>
                                                        {lead.status}
                                                    </span>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </TableCell>

                                            {/* Lifecycle Stage */}
                                            <TableCell className="py-3">
                                                {lead.lifecyclestage ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-100 text-purple-700 border-purple-200 uppercase">
                                                        {lead.lifecyclestage}
                                                    </span>
                                                ) : <span className="text-slate-300 text-xs">—</span>}
                                            </TableCell>

                                            {/* Replied */}
                                            <TableCell className="py-3">
                                                {hasReplied(lead) ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Replied</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">No Reply</span>
                                                )}
                                            </TableCell>

                                            {/* Created At */}
                                            <TableCell className="py-3">
                                                <span className="text-xs text-slate-500">
                                                    {lead.created_at ? format(new Date(lead.created_at), "MMM d, yyyy") : "—"}
                                                </span>
                                            </TableCell>

                                            {/* Last Conversation */}
                                            <TableCell className="py-3 max-w-[220px]">
                                                <p className="text-xs text-slate-500 truncate" title={lead.last_conversation || ""}>
                                                    {lead.last_conversation || "—"}
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <PaginationFooter
                        totalItems={totalCount}
                        currentPage={page}
                        itemsPerPage={10}
                        onPageChange={setPage}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

export default function HubspotLeadsPage() {
    return (
        <Suspense fallback={<SPLoader />}>
            <HubspotLeadsContent />
        </Suspense>
    );
}
