"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RefreshCw, Phone, PhoneIncoming, PhoneOutgoing, Search, Download } from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays } from "date-fns";
import { formatDuration, cn } from "@/lib/utils";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TwilioCallDetailsModal } from "@/components/voice/twilio-call-details-modal";
import { getCallerNumberMeta } from "@/lib/services/caller-numbers";

export default function ColdCallLogsPage() {
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const fetchCalls = useCallback(async (from?: Date, to?: Date) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.append('from', from.toISOString());
            if (to) params.append('to', to.toISOString());
            const res = await fetch(`/api/twilio/calls?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setCalls(data);
            }
        } catch (e) {
            console.error('Cold call logs fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to || dateRange.from);
        to.setHours(23, 59, 59, 999);
        fetchCalls(from, to);
    }, []);

    const handleRefresh = () => {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to || dateRange.from);
        to.setHours(23, 59, 59, 999);
        fetchCalls(from, to);
    };

    const handleRowClick = (call: any) => {
        setSelectedCall(call);
        setModalOpen(true);
    };

    const filteredCalls = useMemo(() => {
        if (!searchQuery.trim()) return calls;
        const q = searchQuery.toLowerCase().trim();
        const cleanDigits = q.replace(/\D/g, '');

        return calls.filter((call) => {
            const from = (call.from || '').toLowerCase();
            const to = (call.to || '').toLowerCase();
            const fromDigits = from.replace(/\D/g, '');
            const toDigits = to.replace(/\D/g, '');
            const transcript = (call.transcript || '').toLowerCase();
            const status = (call.status || '').toLowerCase();
            const direction = (call.direction || '').toLowerCase();
            const fromMeta = getCallerNumberMeta(call.from);
            const metaLabel = (fromMeta?.label || '').toLowerCase();

            const matchesText =
                from.includes(q) ||
                to.includes(q) ||
                transcript.includes(q) ||
                status.includes(q) ||
                direction.includes(q) ||
                metaLabel.includes(q);

            const matchesDigits = cleanDigits && (fromDigits.includes(cleanDigits) || toDigits.includes(cleanDigits));

            return matchesText || matchesDigits;
        });
    }, [calls, searchQuery]);

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && calls.length === 0 && <SPLoader />}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 mb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cold Call Logs</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Manual calls placed from the dialer (US +1 447 288 1677 or UK +44 7462 179561) — recordings &amp; transcripts via Twilio
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <DateRangePicker onUpdate={(values) => {
                            setDateRange(values.range);
                            if (values.range?.from) {
                                const from = new Date(values.range.from);
                                from.setHours(0, 0, 0, 0);
                                const to = new Date(values.range.to || values.range.from);
                                to.setHours(23, 59, 59, 999);
                                fetchCalls(from, to);
                            }
                        }} />
                        <Button variant="outline" className="h-10 px-4 shadow-sm" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by phone number, status, label, or transcript..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 bg-white shadow-sm border-slate-200 focus-visible:ring-indigo-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <Card className="border-border overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                <TableHead>Direction</TableHead>
                                <TableHead>From</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Recording</TableHead>
                                <TableHead>Transcript</TableHead>
                                <TableHead className="w-[180px]">Date &amp; Time</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && calls.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="h-24 text-center">Loading calls...</TableCell></TableRow>
                            ) : filteredCalls.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-slate-500">
                                        {searchQuery ? `No cold calls matching "${searchQuery}".` : "No cold calls in this range."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCalls.map((call) => {
                                    const isInbound = (call.direction || '').toLowerCase().includes('inbound');
                                    const fromMeta = getCallerNumberMeta(call.from);
                                    const audioUrl = call.recordingUrl || call.audio_url;

                                    return (
                                        <TableRow
                                            key={call.id}
                                            className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                            onClick={() => handleRowClick(call)}
                                        >
                                            <TableCell>
                                                <Badge variant={isInbound ? "default" : "secondary"} className={`text-[10px] gap-1 ${isInbound ? 'bg-blue-600 outline-none border-none' : ''}`}>
                                                    {isInbound ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                                                    {isInbound ? 'Inbound' : 'Outbound'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    {fromMeta && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-indigo-200 text-indigo-600 bg-indigo-50">
                                                            {fromMeta.label}
                                                        </Badge>
                                                    )}
                                                    <span>{call.from || 'Unknown'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-800">{call.to || 'Unknown'}</TableCell>
                                            <TableCell className="text-slate-600 font-medium">{formatDuration(call.durationSeconds || 0)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] uppercase",
                                                    call.status === 'completed' ? 'border-emerald-200 text-emerald-600' : 'border-slate-200 text-slate-600'
                                                )}>
                                                    {call.status || 'unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {audioUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">Available</Badge>
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
                                            <TableCell>
                                                {call.transcript ? (
                                                    <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">Ready</Badge>
                                                ) : call.transcriptionStatus === 'in-progress' ? (
                                                    <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200" variant="outline">Processing</Badge>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-xs">
                                                {call.createdAt ? format(new Date(call.createdAt), 'PPp') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                {audioUrl ? (
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                                                    >
                                                        <a
                                                            href={`/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`}
                                                            download={`cold-call-${call.id || 'recording'}.mp3`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Download Recording"
                                                        >
                                                            <Download className="h-3.5 w-3.5 mr-1" />
                                                            Download
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="px-6 py-4 border-t border-border bg-slate-50/50 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-900">{filteredCalls.length}</span> of <span className="font-bold text-slate-900">{calls.length}</span> cold calls
                    </p>
                </div>
            </Card>

            <TwilioCallDetailsModal open={modalOpen} onOpenChange={setModalOpen} call={selectedCall} />
        </div>
    );
}
