"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Mic,
    PhoneCall,
    Search,
    RefreshCw,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    Play,
    FileText,
    Volume2,
    Calendar,
    Sparkles,
    Building,
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
import { CampaignBadge } from "@/components/dashboard/campaign-badge";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { formatDuration } from "@/lib/utils";
import type { CampaignVoiceCall } from "@/lib/services/campaign-voice";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useCampaignDateRange } from "@/context/CampaignDateContext";

const CALLS_PER_PAGE = 15;

export default function CampaignVoiceCallLogsPage() {
    const router = useRouter();

    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();
    const [calls, setCalls] = useState<CampaignVoiceCall[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
    const [callSlotFilter, setCallSlotFilter] = useState<string>("all"); // 'all' | '1' | '2' | '3'
    const [sentimentFilter, setSentimentFilter] = useState<string>("all"); // 'all' | 'positive' | 'negative' | 'neutral'
    const [statusFilter, setStatusFilter] = useState<string>("all"); // 'all' | 'picked_up' | 'missed'

    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=voice');
            if (res.ok) {
                const json = await res.json();
                setCampaignOptions((json.campaignOptions || []).map((c: any) => ({
                    id: String(c.id || c.campaign_id),
                    name: c.name || c.campaign_name || `Campaign ${c.id || c.campaign_id}`,
                })));
            }
        } catch (e) {
            console.error("Failed to fetch campaign options:", e);
        }
    }, []);

    const fetchCalls = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('pageSize', String(CALLS_PER_PAGE));
            if (searchInput.trim()) params.set('search', searchInput.trim());
            if (callSlotFilter !== 'all') params.set('callNumber', callSlotFilter);
            if (sentimentFilter !== 'all') params.set('sentiment', sentimentFilter);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/voice/calls?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch calls");
            const json = await res.json();
            setCalls(json.data || []);
            setTotalCount(json.totalCount || 0);
        } catch (err) {
            console.error("Failed to fetch Campaign voice calls:", err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchInput, callSlotFilter, sentimentFilter, statusFilter, fromIso, toIso, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchCalls();
    }, [fetchCalls]);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setDateRange(range.range, range.label);
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
        setCallSlotFilter("all");
        setSentimentFilter("all");
        setStatusFilter("all");
        setDateRange(undefined);
        setCurrentPage(1);
    };

    const hasActiveFilters =
        !!searchInput ||
        selectedCampaigns.length > 0 ||
        callSlotFilter !== "all" ||
        sentimentFilter !== "all" ||
        statusFilter !== "all";

    const totalPages = Math.ceil(totalCount / CALLS_PER_PAGE) || 1;

    const openCallDetails = (call: CampaignVoiceCall) => {
        setSelectedCall({
            id: call.vapiCallId || call.id,
            name: call.leadName,
            phone: call.phone,
            startedAt: call.callDate,
            durationSeconds: call.durationSeconds,
            status: call.status,
            cost: call.costUsd !== null && call.costUsd !== undefined ? `$${call.costUsd.toFixed(2)}` : 'N/A',
            callSummary: call.summary,
            audio_url: call.recordingUrl,
            transcript: call.transcript,
            note: call.note,
            campaignName: call.campaignName,
            callNumber: call.callNumber,
        });
        setModalOpen(true);
    };

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`space-y-6 pb-12 pt-4 px-6 relative ${loading ? 'h-[calc(100vh-6rem)] overflow-hidden' : 'min-h-[500px]'}`}>
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <PhoneCall className="h-6 w-6 text-cyan-600" />
                        Campaign Voice Call Logs
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Detailed voice history with transcripts, sentiment analysis, notes, and call recordings
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
                                    : `${selectedCampaigns.length} Campaign${selectedCampaigns.length > 1 ? 's' : ''}`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white p-1">
                            <DropdownMenuItem
                                className="text-xs font-bold cursor-pointer"
                                onClick={() => {
                                    setSelectedCampaigns([]);
                                    setCurrentPage(1);
                                }}
                            >
                                All Campaigns
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

                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchCalls}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Quick Sub-navigation banner */}
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
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
                    onClick={() => router.push('/dashboard/campaigns/voice/logs')}
                >
                    Call Logs
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

            {/* Search and Filters row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search lead by name, phone, notes, or summary..."
                        className="pl-9 h-9 text-xs bg-white border-slate-200"
                        value={searchInput}
                        onChange={e => {
                            setSearchInput(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                    {searchInput && (
                        <button
                            onClick={() => {
                                setSearchInput("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Call Slot filter */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
                        <button
                            onClick={() => { setCallSlotFilter("all"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${callSlotFilter === "all" ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
                        >
                            All Touches
                        </button>
                        <button
                            onClick={() => { setCallSlotFilter("1"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${callSlotFilter === "1" ? "bg-cyan-50 text-cyan-700 font-bold" : "text-slate-500 hover:text-cyan-700"}`}
                        >
                            Call 1
                        </button>
                        <button
                            onClick={() => { setCallSlotFilter("2"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${callSlotFilter === "2" ? "bg-cyan-50 text-cyan-700 font-bold" : "text-slate-500 hover:text-cyan-700"}`}
                        >
                            Call 2
                        </button>
                        <button
                            onClick={() => { setCallSlotFilter("3"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${callSlotFilter === "3" ? "bg-cyan-50 text-cyan-700 font-bold" : "text-slate-500 hover:text-cyan-700"}`}
                        >
                            Call 3
                        </button>
                    </div>

                    {/* Sentiment filter */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
                        <button
                            onClick={() => { setSentimentFilter("all"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${sentimentFilter === "all" ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-800"}`}
                        >
                            All Sentiments
                        </button>
                        <button
                            onClick={() => { setSentimentFilter("positive"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${sentimentFilter === "positive" ? "bg-amber-50 text-amber-700 font-bold" : "text-slate-500 hover:text-amber-700"}`}
                        >
                            Positive
                        </button>
                        <button
                            onClick={() => { setSentimentFilter("neutral"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${sentimentFilter === "neutral" ? "bg-slate-100 text-slate-700 font-bold" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Neutral
                        </button>
                        <button
                            onClick={() => { setSentimentFilter("negative"); setCurrentPage(1); }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${sentimentFilter === "negative" ? "bg-rose-50 text-rose-700 font-bold" : "text-slate-500 hover:text-rose-700"}`}
                        >
                            Negative
                        </button>
                    </div>
                </div>
            </div>

            {/* Calls Table */}
            <Card className="border-border shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Campaign</th>
                                <th className="px-4 py-3">Lead Name</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3 text-center">Touch</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Sentiment</th>
                                <th className="px-4 py-3 text-center">Duration</th>
                                <th className="px-4 py-3 text-center">Cost</th>
                                <th className="px-4 py-3">Summary / Note</th>
                                <th className="px-4 py-3 text-center">Artifacts</th>
                                <th className="px-4 py-3">Call Date</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {calls.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                                        No voice campaign calls found.
                                    </td>
                                </tr>
                            ) : (
                                calls.map(call => (
                                    <tr
                                        key={call.id}
                                        onClick={() => openCallDetails(call)}
                                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3">
                                            <CampaignBadge
                                                campaignId={call.campaignId}
                                                campaignName={call.campaignName}
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900">{call.leadName}</div>
                                            {call.companyName && (
                                                <div className="text-[10px] text-slate-400 truncate max-w-[140px] flex items-center gap-1">
                                                    <Building className="h-2.5 w-2.5" />
                                                    <span>{call.companyName}</span>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 font-medium text-slate-700 font-mono text-[11px]">
                                            {call.phone}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <Badge variant="outline" className="text-[9px] font-bold bg-slate-50 text-slate-700 border-slate-200">
                                                Call {call.callNumber}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] font-bold uppercase ${
                                                    call.isPickedUp
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                            >
                                                {call.status}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] font-bold uppercase ${
                                                    call.sentiment === 'positive'
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                        : call.sentiment === 'negative'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                            >
                                                {call.sentiment}
                                                {call.sentimentScore !== null && (
                                                    <span className="ml-1 opacity-70">({call.sentimentScore.toFixed(2)})</span>
                                                )}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-3 text-center font-mono text-slate-700">
                                            {formatDuration(call.durationSeconds)}
                                        </td>

                                        <td className="px-4 py-3 text-center font-mono text-slate-700">
                                            {call.costUsd !== null && call.costUsd !== undefined ? `$${call.costUsd.toFixed(2)}` : 'N/A'}
                                        </td>

                                        <td className="px-4 py-3 max-w-[220px]">
                                            <div className="text-[11px] text-slate-600 line-clamp-2" title={call.summary || call.note || ''}>
                                                {call.summary || call.note || '—'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {call.recordingUrl ? (
                                                    <Badge className="h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold gap-1" title="Recording available">
                                                        <Volume2 className="h-2.5 w-2.5" /> Audio
                                                    </Badge>
                                                ) : null}
                                                {call.transcript ? (
                                                    <Badge className="h-5 px-1.5 bg-cyan-50 text-cyan-700 border-cyan-200 text-[9px] font-bold gap-1" title="Transcript available">
                                                        <FileText className="h-2.5 w-2.5" /> Text
                                                    </Badge>
                                                ) : null}
                                                {!call.recordingUrl && !call.transcript && (
                                                    <span className="text-slate-300 text-[10px]">—</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                                            {call.callDate ? new Date(call.callDate).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            }) : '—'}
                                        </td>

                                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                onClick={() => openCallDetails(call)}
                                            >
                                                View Call
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-slate-500">
                        <div>
                            Showing {(currentPage - 1) * CALLS_PER_PAGE + 1} to{" "}
                            {Math.min(currentPage * CALLS_PER_PAGE, totalCount)} of {totalCount} calls
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-2 font-semibold text-slate-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Modal for call details */}
            <CallDetailsModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                call={selectedCall}
            />
        </div>
    );
}

