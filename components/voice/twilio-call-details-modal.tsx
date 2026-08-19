"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Phone, Clock, Calendar, ArrowRight, FileText } from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface TwilioCallDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    call: any;
}

export function TwilioCallDetailsModal({ open, onOpenChange, call }: TwilioCallDetailsModalProps) {
    if (!call) return null;

    const isInbound = (call.direction || '').toLowerCase().includes('inbound');
    const audioUrl = call.recordingUrl || call.audio_url;
    const startedAtDisplay = call.startedAt || call.createdAt
        ? new Date(call.startedAt || call.createdAt).toLocaleString()
        : 'N/A';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 gap-0 bg-white overflow-hidden max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-xl font-semibold">Cold Call Details</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 p-6 bg-slate-50/50 border-b border-border">
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Status</p>
                            <Badge className={`${call.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-none shadow-none uppercase text-[10px] px-2.5 py-0.5`}>
                                {call.status || 'Unknown'}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Duration</p>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <span className="font-bold text-slate-900">{formatDuration(call.durationSeconds || 0)}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Date &amp; Time</p>
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-700">{startedAtDisplay}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">Call Information</h3>
                            <div className="p-5 border border-border rounded-xl bg-white shadow-sm flex items-center justify-between gap-4">
                                <div className="flex-1 font-semibold text-slate-900 border border-border bg-slate-50/50 rounded-lg px-4 py-3">
                                    <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">From</span>
                                    <span className="block text-sm">{call.from || 'Unknown'}</span>
                                </div>
                                <div className="flex flex-col items-center px-2 shrink-0">
                                    <span className="text-[10px] uppercase font-bold text-blue-600 tracking-widest mb-2">{isInbound ? "INBOUND" : "OUTBOUND"}</span>
                                    <ArrowRight className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1 font-semibold text-slate-900 border border-border bg-slate-50/50 rounded-lg px-4 py-3 text-right">
                                    <span className="block text-xs text-slate-500 uppercase tracking-wider mb-1">To</span>
                                    <span className="block text-sm">{call.to || 'Unknown'}</span>
                                </div>
                            </div>

                            {audioUrl && (
                                <div className="mt-6">
                                    <audio
                                        controls
                                        preload="metadata"
                                        className="w-full"
                                        src={`/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`}
                                    />
                                </div>
                            )}
                            {!audioUrl && (
                                <p className="text-sm text-slate-500 italic mt-4">No recording available for this call.</p>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="h-4 w-4 text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Transcript</h3>
                                {call.transcriptionStatus === 'in-progress' && (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">Processing…</Badge>
                                )}
                            </div>
                            <div className="rounded-lg border border-border bg-slate-50 p-4 min-h-[100px]">
                                {call.transcript ? (
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{call.transcript}</p>
                                ) : (
                                    <p className="text-sm text-slate-500 text-center italic">
                                        {call.transcriptionStatus === 'in-progress'
                                            ? 'Transcript is being generated…'
                                            : 'No transcript available.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
