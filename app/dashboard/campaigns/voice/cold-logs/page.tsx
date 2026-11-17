"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    RefreshCw,
    PhoneIncoming,
    PhoneOutgoing,
    Search,
    Download,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    PhoneCall,
    Radio,
    Clock,
    User,
    CheckCircle2,
    PhoneOff,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { formatDuration, cn } from "@/lib/utils";
import { useCampaignDateRange } from "@/context/CampaignDateContext";
import { TwilioCallDetailsModal } from "@/components/voice/twilio-call-details-modal";
import { getCallerNumberMeta } from "@/lib/services/caller-numbers";
import { CampaignBadge } from "@/components/dashboard/campaign-badge";
import type { CampaignVoiceColdCall } from "@/lib/services/campaign-voice";
import { useRouter } from "next/navigation";

const COLD_CALLS_PER_PAGE = 15;

export default function CampaignVoiceColdLogsPage() {
    const router = useRouter();

    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();
    const [calls, setCalls] = useState<CampaignVoiceColdCall[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [attributedCount, setAttributedCount] = useState(0);
    const [unattributedCount, setUnattributedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=voice');
            if (res.ok) {
                const json = await res.json();
                setCampaignOptions((json.campaignOptions || []).map((c: any) => ({
                    id: String(c.campaign_id),
                    name: c.campaign_name,
                })));
            }
        } catch (e) {
            console.error("Failed to fetch campaign options:", e);
        }
    }, []);

    const fetchColdCalls = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('pageSize', String(COLD_CALLS_PER_PAGE));
            if (searchInput.trim()) params.set('search', searchInput.trim());
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/voice/cold-calls?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch cold calls");
            const json = await res.json();
            setCalls(json.data || []);
            setTotalCount(json.totalCount || 0);
            setAttributedCount(json.attributedCount || 0);
            setUnattributedCount(json.unattributedCount || 0);
        } catch (e) {
            console.error("Cold call logs fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchInput, statusFilter, fromIso, toIso, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchColdCalls();
    }, [fetchColdCalls]);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setDateRange(range.range, range.label);
        } else if (range?.from) {
            setDateRange(range, range.label);
        } else {
            setDateRange(undefined);
        }
        setCurrentPage(1);
    };

    const toggleCampaign = (id: string) => {
        setSelectedCampaigns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchInput("");
        setSelectedCampaigns([]);
        setStatusFilter("all");
        setDateRange(undefined);
        setCurrentPage(1);
    };

    const hasActiveFilters =
        !!searchInput ||
        selectedCampaigns.length > 0 ||
        statusFilter !== "all";

    const totalPages = Math.ceil(totalCount / COLD_CALLS_PER_PAGE) || 1;

    const handleRowClick = (call: CampaignVoiceColdCall) => {
        setSelectedCall(call);
        setModalOpen(true);
    };

    return (
        <div className="space-y-6 pb-12 pt-4 px-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Radio className="h-6 w-6 text-cyan-600" />
                        Campaign Voice Cold Call Logs
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manual dialer calls placed via Twilio — matched to campaign leads by contact phone number
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Campaign filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                                <Filter className="h-3.5 w-3.5 text-slate-500" />
                                {selectedCampaigns.length === 0
                                    ? "All Campaigns"
                                    : `${selectedCampaigns.length} Selected`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 bg-white p-1">
                            <DropdownMenuItem
                                className="text-xs font-bold cursor-pointer"
                                onClick={() => {
                                    setSelectedCampaigns([]);
                                    setCurrentPage(1);
                                }}
                            >
                                All Campaigns &amp; Dialer Calls
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-xs cursor-pointer flex items-center justify-between"
                                onClick={() => toggleCampaign("unattributed")}
                            >
                                <span className="truncate">Unattributed / Direct Dialer</span>
                                {selectedCampaigns.includes("unattributed") && (
                                    <Badge className="h-4 px-1 text-[9px] bg-cyan-600">Active</Badge>
                                )}
                            </DropdownMenuItem>
                            {campaignOptions.map(c => (
                                <DropdownMenuItem
                                    key={c.id}
                                    className="text-xs cursor-pointer flex items-center justify-between"
                                    onClick={() => toggleCampaign(c.id)}
                                >
                                    <span className="truncate">{c.name}</span>
                                    {selectedCampaigns.includes(c.id) && (
                                        <Badge className="h-4 px-1 text-[9px] bg-cyan-600">Active</Badge>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Date Picker */}
                    <DateRangePicker value={dateRange} onUpdate={handleDateUpdate} />

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 font-bold"
                        >
                            <X className="h-3.5 w-3.5" /> Reset
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchColdCalls}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Sub-navigation banner */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice')}
                >
                    Overview
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice/logs')}
                >
                    Call Logs
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
                    onClick={() => router.push('/dashboard/campaigns/voice/cold-logs')}
                >
                    Cold Call Logs
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/voice/analytics')}
                >
                    Analytics
                </Button>
            </div>

            {/* Quick KPI attribution strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border border-slate-200/80 bg-white shadow-xs p-3.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Total Cold Calls</span>
                        <Radio className="h-4 w-4 text-cyan-600" />
                    </div>
                    <p className="text-xl font-bold text-slate-900 mt-1">{totalCount.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Recorded across all manual dialer activity</p>
                </Card>

                <Card className="border border-slate-200/80 bg-white shadow-xs p-3.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Campaign Leads Contacted</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="text-xl font-bold text-emerald-600 mt-1">{attributedCount.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Matched directly to campaign outreach leads</p>
                </Card>

                <Card className="border border-slate-200/80 bg-white shadow-xs p-3.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Unattributed / Direct Dialer</span>
                        <PhoneOff className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="text-xl font-bold text-slate-700 mt-1">{unattributedCount.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Direct phone numbers not enrolled in campaigns</p>
                </Card>
            </div>

            {/* Search and status filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by contact name, phone, transcript, or caller ID..."
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-cyan-500"
                    />
                    {searchInput && (
                        <button
                            onClick={() => {
                                setSearchInput("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <Button
                        variant={statusFilter === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
                        className={cn("h-7 px-2.5 text-xs", statusFilter === "all" ? "bg-white text-slate-900 shadow-xs hover:bg-white" : "text-slate-600 hover:text-slate-900")}
                    >
                        All Statuses
                    </Button>
                    <Button
                        variant={statusFilter === "completed" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setStatusFilter("completed"); setCurrentPage(1); }}
                        className={cn("h-7 px-2.5 text-xs", statusFilter === "completed" ? "bg-white text-emerald-700 shadow-xs hover:bg-white" : "text-slate-600 hover:text-slate-900")}
                    >
                        Completed
                    </Button>
                    <Button
                        variant={statusFilter === "no-answer" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setStatusFilter("no-answer"); setCurrentPage(1); }}
                        className={cn("h-7 px-2.5 text-xs", statusFilter === "no-answer" ? "bg-white text-rose-700 shadow-xs hover:bg-white" : "text-slate-600 hover:text-slate-900")}
                    >
                        No Answer
                    </Button>
                    <Button
                        variant={statusFilter === "busy" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setStatusFilter("busy"); setCurrentPage(1); }}
                        className={cn("h-7 px-2.5 text-xs", statusFilter === "busy" ? "bg-white text-amber-700 shadow-xs hover:bg-white" : "text-slate-600 hover:text-slate-900")}
                    >
                        Busy
                    </Button>
                </div>
            </div>

            {/* Cold Call Table */}
            <Card className="border-border overflow-hidden shadow-xs bg-white">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/60 hover:bg-slate-50/60 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                <TableHead className="w-[170px]">Campaign</TableHead>
                                <TableHead className="w-[180px]">Contact / Lead</TableHead>
                                <TableHead className="w-[100px]">Direction</TableHead>
                                <TableHead className="w-[160px]">From</TableHead>
                                <TableHead className="w-[140px]">To</TableHead>
                                <TableHead className="w-[90px]">Duration</TableHead>
                                <TableHead className="w-[110px]">Status</TableHead>
                                <TableHead className="w-[110px]">Recording</TableHead>
                                <TableHead className="w-[100px]">Transcript</TableHead>
                                <TableHead className="w-[160px]">Date &amp; Time</TableHead>
                                <TableHead className="w-[90px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && calls.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-32 text-center text-slate-500">
                                        Loading cold calls...
                                    </TableCell>
                                </TableRow>
                            ) : calls.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-32 text-center text-slate-500">
                                        {searchInput || hasActiveFilters
                                            ? "No cold calls matching your filters."
                                            : "No cold calls found for the selected time range."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                calls.map((call) => {
                                    const isInbound = (call.direction || '').toLowerCase().includes('inbound');
                                    const fromMeta = getCallerNumberMeta(call.from);
                                    const audioUrl = call.recordingUrl;

                                    return (
                                        <TableRow
                                            key={call.id}
                                            className="cursor-pointer hover:bg-slate-50/70 transition-colors text-xs"
                                            onClick={() => handleRowClick(call)}
                                        >
                                            {/* Campaign */}
                                            <TableCell>
                                                {call.isAttributed ? (
                                                    <CampaignBadge
                                                        campaignId={call.campaignId}
                                                        campaignName={call.campaignName}
                                                    />
                                                ) : (
                                                    <Badge variant="outline" className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-50 text-slate-500 border-slate-200">
                                                        Direct Dialer
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            {/* Contact / Lead Name */}
                                            <TableCell className="font-semibold text-slate-900">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate max-w-[150px]">{call.leadName}</span>
                                                </div>
                                            </TableCell>

                                            {/* Direction */}
                                            <TableCell>
                                                <Badge
                                                    variant={isInbound ? "default" : "secondary"}
                                                    className={cn(
                                                        "text-[10px] gap-1 font-semibold",
                                                        isInbound ? "bg-blue-600 text-white border-transparent" : "bg-slate-100 text-slate-700"
                                                    )}
                                                >
                                                    {isInbound ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                                                    {isInbound ? 'Inbound' : 'Outbound'}
                                                </Badge>
                                            </TableCell>

                                            {/* From */}
                                            <TableCell className="font-medium text-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    {fromMeta && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-cyan-200 text-cyan-700 bg-cyan-50">
                                                            {fromMeta.label}
                                                        </Badge>
                                                    )}
                                                    <span className="font-mono text-[11px]">{call.from || '—'}</span>
                                                </div>
                                            </TableCell>

                                            {/* To */}
                                            <TableCell className="font-mono font-medium text-slate-800 text-[11px]">
                                                {call.to || '—'}
                                            </TableCell>

                                            {/* Duration */}
                                            <TableCell className="font-mono font-medium text-slate-700">
                                                {formatDuration(call.durationSeconds || 0)}
                                            </TableCell>

                                            {/* Status */}
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] uppercase font-bold",
                                                        call.status === 'completed'
                                                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                                                            : call.status === 'busy'
                                                            ? 'border-amber-200 text-amber-700 bg-amber-50'
                                                            : call.status === 'no-answer'
                                                            ? 'border-rose-200 text-rose-700 bg-rose-50'
                                                            : 'border-slate-200 text-slate-600 bg-slate-50'
                                                    )}
                                                >
                                                    {call.status || 'unknown'}
                                                </Badge>
                                            </TableCell>

                                            {/* Recording */}
                                            <TableCell>
                                                {audioUrl ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold" variant="outline">
                                                            Available
                                                        </Badge>
                                                        <a
                                                            href={`/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`}
                                                            download={`cold-call-${call.id || 'recording'}.mp3`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Download Recording"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </TableCell>

                                            {/* Transcript */}
                                            <TableCell>
                                                {call.transcript ? (
                                                    <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold" variant="outline">
                                                        Ready
                                                    </Badge>
                                                ) : call.transcriptionStatus === 'in-progress' ? (
                                                    <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200 font-semibold" variant="outline">
                                                        Processing
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </TableCell>

                                            {/* Date & Time */}
                                            <TableCell className="text-slate-500 text-[11px] whitespace-nowrap">
                                                {call.startedAt || call.createdAt
                                                    ? format(new Date(call.startedAt || call.createdAt!), 'PPp')
                                                    : '—'}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-[11px] font-semibold text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50"
                                                    onClick={() => handleRowClick(call)}
                                                >
                                                    Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                    <div>
                        Showing <span className="font-bold text-slate-800">{calls.length > 0 ? (currentPage - 1) * COLD_CALLS_PER_PAGE + 1 : 0}</span> to{" "}
                        <span className="font-bold text-slate-800">{Math.min(currentPage * COLD_CALLS_PER_PAGE, totalCount)}</span> of{" "}
                        <span className="font-bold text-slate-800">{totalCount.toLocaleString()}</span> calls
                        {attributedCount > 0 && (
                            <span className="ml-2 text-slate-400">
                                ({attributedCount} campaign-attributed, {unattributedCount} direct dialer)
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-semibold px-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={currentPage >= totalPages || loading}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            <TwilioCallDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                call={selectedCall}
            />
        </div>
    );
}

