"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays } from "date-fns";
import { formatDuration, cn } from "@/lib/utils";
import React, { useState, useEffect, useCallback } from "react";
import { TwilioCallDetailsModal } from "@/components/voice/twilio-call-details-modal";

export default function ColdCallLogsPage() {
    const [calls, setCalls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
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

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && calls.length === 0 && <SPLoader />}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 mb-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cold Call Logs</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Manual calls placed from the dialer (+1 447 288 1677) — recordings &amp; transcripts via Twilio
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
                                <TableHead className="w-[200px]">Date &amp; Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && calls.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading calls...</TableCell></TableRow>
                            ) : calls.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500">No cold calls in this range.</TableCell></TableRow>
                            ) : (
                                calls.map((call) => {
                                    const isInbound = (call.direction || '').toLowerCase().includes('inbound');
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
                                            <TableCell className="font-medium text-slate-800">{call.from || 'Unknown'}</TableCell>
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
                                                {call.recordingUrl ? (
                                                    <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">Available</Badge>
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
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="px-6 py-4 border-t border-border bg-slate-50/50">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-900">{calls.length}</span> cold calls
                    </p>
                </div>
            </Card>

            <TwilioCallDetailsModal open={modalOpen} onOpenChange={setModalOpen} call={selectedCall} />
        </div>
    );
}
