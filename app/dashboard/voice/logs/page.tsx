"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, ChevronLeft, ChevronRight, User, Download, Search, Info, Activity, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SPLoader } from "@/components/sp-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect } from "react";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, parseISO, subDays } from "date-fns";
import { calculateDuration, formatDuration, cn } from "@/lib/utils";
import { useData } from "@/context/DataContext";

// Progressive fetch for missing metadata (phone numbers/direction)
// Static cells that rely on pre-fetched and normalized data from the API
const DynamicRowCells = ({ call, leads }: { call: any, leads: any[] }) => {
    // RESOLVE: Prioritize backend names, then Leads database, then Vapi/Maqsam metadata
    let guestName = call.name || "Guest";
    const guestNum = call.phone || "Unknown";
    const realType = call.type || (call.isInbound ? "Inbound" : "Outbound");
    const isInboundState = call.isInbound;

    // Eagerly resolve name from our Leads database based on phone if Guest
    if ((!guestName || guestName === "Guest" || guestName === "Unknown") && call.phone && leads) {
        const targetPhone = call.phone.replace(/\D/g, '');
        if (targetPhone && targetPhone.length > 5) {
            const foundLead = leads.find((l: any) => l.phone && l.phone.replace(/\D/g, '') === targetPhone);
            if (foundLead && foundLead.name) {
                guestName = foundLead.name;
            }
        }
    }

    return (
        <>
            <TableCell className="font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {guestName}
                </div>
            </TableCell>
            <TableCell className="font-medium text-slate-800">
                {guestNum}
            </TableCell>
            <TableCell>
                <Badge variant={isInboundState ? "default" : "secondary"} className={`text-[10px] ${isInboundState ? 'bg-blue-600 outline-none border-none' : ''}`}>
                    {realType}
                </Badge>
            </TableCell>
            <TableCell className="text-slate-600 font-medium">{formatDuration(call.durationSeconds)}</TableCell>
            <TableCell className="text-slate-500 text-xs">{call.country || 'Unknown'}</TableCell>
            <TableCell className="font-bold text-emerald-600">
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            className="hover:underline flex items-center gap-1 cursor-help"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {call.cost}
                            <Info className="h-3 w-3 text-slate-300" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-4 bg-white shadow-xl border-border" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-border pb-2">
                                <Activity className="h-4 w-4 text-blue-600" />
                                <h4 className="font-bold text-sm text-slate-900">Cost Breakdown</h4>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Agent (Vapi/AI):</span>
                                    <span className="font-mono text-slate-700">${(call.breakdown?.agent || 0).toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Telephony (Provider):</span>
                                    <span className="font-mono text-slate-700">${(call.breakdown?.telephony || 0).toFixed(3)}</span>
                                </div>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between text-xs font-bold text-slate-900">
                                <span>Total Estimated:</span>
                                <span className="text-emerald-600">{call.cost}</span>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </TableCell>
        </>
    );
};


export default function VoiceLogsPage() {
    const { calls: globalCalls, loadingCalls, refreshAll, leads, loadingLeads } = useData();
    const [allCallsMapped, setAllCallsMapped] = useState<any[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const loading = loadingCalls;
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [providerFilter, setProviderFilter] = useState("all");
    const [phoneFilter, setPhoneFilter] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [costModalOpen, setCostModalOpen] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (loadingCalls || loadingLeads || !globalCalls) return;

        const mappedCalls = globalCalls.map((c: any) => {
            const isInbound = c.isInbound === true;

            // Eagerly resolve name from our Leads database based on phone
            let resolvedName = c.name;
            if ((!resolvedName || resolvedName === "Guest" || resolvedName === "Unknown") && c.phone && leads) {
                const targetPhone = c.phone.replace(/\D/g, '');
                if (targetPhone && targetPhone.length > 5) {
                    const foundLead = leads.find((l: any) => l.phone && l.phone.replace(/\D/g, '') === targetPhone);
                    if (foundLead && foundLead.name) {
                        resolvedName = foundLead.name;
                    }
                }
            }

            return {
                ...c,
                name: resolvedName,
                displayDate: c.startedAt ? format(new Date(c.startedAt), 'PPp') : 'N/A',
                displayDuration: formatDuration(c.durationSeconds || 0),
            };
        });

        setAllCallsMapped(mappedCalls);
    }, [globalCalls, loadingCalls, leads, loadingLeads]);

    // Reset to page 1 ONLY when the user explicitly changes a filter — not when background data enrichment updates allCallsMapped.
    useEffect(() => {
        setCurrentPage(1);
    }, [dateRange, statusFilter, typeFilter, providerFilter, phoneFilter, sortBy]);

    // Re-apply filtering whenever data or filters change (no page reset here).
    useEffect(() => {
        const filteredCalls = allCallsMapped.filter((call: any) => {
            // Priority 1: Provider Filter
            if (providerFilter !== "all" && call.source !== providerFilter) return false;

            if (dateRange?.from) {
                if (!call.startedAt) return false;
                const callDate = new Date(call.startedAt);
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = new Date(dateRange.to || dateRange.from);
                to.setHours(23, 59, 59, 999);
                if (callDate < from || callDate > to) return false;
            }

            if (statusFilter !== "all" && call.status !== statusFilter) return false;
            if (typeFilter !== "all" && call.type?.toLowerCase() !== typeFilter.toLowerCase()) return false;

            if (phoneFilter) {
                const searchStr = phoneFilter.toLowerCase().trim();
                const phoneSearch = searchStr.replace(/\D/g, '');
                const phoneTarget = (call.phone || "").replace(/\D/g, '');

                const matchesPhone = phoneSearch && phoneTarget.includes(phoneSearch);
                const matchesName = (call.name || "Guest").toLowerCase().includes(searchStr);

                if (!matchesPhone && !matchesName) return false;
            }

            return true;
        });

        // Apply sorting
        const sortedCalls = [...filteredCalls].sort((a, b) => {
            if (sortBy === "newest") return new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime();
            if (sortBy === "oldest") return new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime();
            if (sortBy === "longest") return (b.durationSeconds || 0) - (a.durationSeconds || 0);
            if (sortBy === "shortest") return (a.durationSeconds || 0) - (b.durationSeconds || 0);
            return 0;
        });

        setCalls(sortedCalls);
    }, [allCallsMapped, dateRange, statusFilter, typeFilter, providerFilter, phoneFilter, sortBy]);

    const handleRefresh = () => {
        refreshAll();
    };

    const handleRowClick = (call: any) => {
        setSelectedCall(call);
        setModalOpen(true);
    };

    const paginatedCalls = calls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && allCallsMapped.length === 0 && <SPLoader />}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 mb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Call Logs</h1>
                        <p className="text-slate-500 text-sm mt-1">Comprehensive history of AI voice interactions</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" className="text-slate-600 border-border h-10 shadow-sm" onClick={() => setCostModalOpen(true)}>
                            <Info className="h-4 w-4 mr-2" />
                            Cost Info
                        </Button>
                        <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                        <Button variant="outline" className="h-10 px-4 shadow-sm" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-border shadow-sm">
                    <div className="relative w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search name or phone..."
                            className="pl-9 h-9"
                            value={phoneFilter}
                            onChange={(e) => setPhoneFilter(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 px-3 h-9 border border-border rounded-md bg-slate-50 text-xs font-semibold text-slate-600" title="Vapi and Maqsam sources only">
                        <Phone className="h-3.5 w-3.5 text-blue-600" />
                        <span>Voice AI (Active Channels)</span>
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="Inbound">Inbound</SelectItem>
                            <SelectItem value="Outbound">Outbound</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="answered">Answered / Done</SelectItem>
                            <SelectItem value="failed">Failed / Error</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="Sort By" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="longest">Longest Duration</SelectItem>
                            <SelectItem value="shortest">Shortest Duration</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="border-border overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                <TableHead className="w-[150px]">Name</TableHead>
                                <TableHead>Guest Number</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[200px]">Date & Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && calls.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading calls...</TableCell></TableRow>
                            ) : calls.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500">No calls matching filters.</TableCell></TableRow>
                            ) : (
                                (paginatedCalls as any[]).map((call) => (
                                    <TableRow
                                        key={call.id}
                                        className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                        onClick={() => handleRowClick(call)}
                                    >
                                        <DynamicRowCells call={call} leads={leads} />
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] uppercase border-${call.status === 'answered' ? 'emerald' : 'slate'}-200 text-${call.status === 'answered' ? 'emerald' : 'slate'}-600`}>
                                                {call.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-xs">{call.displayDate}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="px-6 py-4 border-t border-border bg-slate-50/50 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-900">{calls.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, calls.length)}</span> of {calls.length} calls
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-3 py-1">Page {currentPage}</span>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(Math.ceil(calls.length / itemsPerPage), p + 1))} disabled={currentPage >= Math.ceil(calls.length / itemsPerPage)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            <CallDetailsModal open={modalOpen} onOpenChange={setModalOpen} call={selectedCall} />

            <Dialog open={costModalOpen} onOpenChange={setCostModalOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white border-border shadow-xl overflow-hidden p-0">
                    <DialogHeader className="p-6 bg-slate-50 border-b border-border">
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <Info className="h-5 w-5" />
                            </div>
                            How Costing is Calculated
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Understanding our automated billing and rate matching logic.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">1</div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Normalization</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">System cleans phone numbers by removing all symbols and spaces, ensuring consistent lookup against our global rate database.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">2</div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Longest-Prefix Matching</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">We use high-precision matching. If a number matches multiple regions (e.g. UAE General vs Dubai Fixed), we prioritize the most specific prefix for maximum accuracy.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">3</div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm mb-1">Per-Minute Computation</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">Duration is tracked in seconds and converted to minutes. For outbound calls, the matched rate is applied. Inbound calls are always computed at $0.02.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600 text-sm">✓</div>
                                <div>
                                    <h4 className="font-bold text-emerald-800 text-sm mb-1">Billing Confirmation</h4>
                                    <p className="text-xs text-emerald-600/80 leading-relaxed italic">All rates are pulled directly from your official billing schedule (found in the PDF below).</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-slate-50 border-t border-border">
                        <a href="/billing-plan.pdf" download className="w-full">
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200">
                                <Download className="h-4 w-4 mr-2" />
                                Download Billing Plan PDF
                            </Button>
                        </a>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
