"use client";

import { SPLoader } from "@/components/sp-loader";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX, Phone, Clock, Calendar, ArrowRight, User, Copy, Check, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface CallDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    call: any;
}

export function CallDetailsModal({ open, onOpenChange, call }: CallDetailsModalProps) {
    const [fullCall, setFullCall] = useState<any>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [transcriptCopied, setTranscriptCopied] = useState(false);

    const displayCall = fullCall || call || {};

    const audioUrl = displayCall.audio_url || displayCall.recordingUrl || null;

    useEffect(() => {
        if (open && call?.id) {
            setFullCall(call); // Set initial data
            setLocalLoading(true);
            // Fetch fresh details to get messages/transcript if not present
            fetch(`/api/calls/${call.id}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data) setFullCall(data);
                })
                .catch(err => console.error("Error fetching details", err))
                .finally(() => setLocalLoading(false));
        }
    }, [open, call]);

    // Helper to get messages from various AI provider formats
    const getMessages = (data: any) => {
        if (!data) return [];

        let rawMessages: any[] = [];
        if (Array.isArray(data.transcript) && data.transcript.length > 0) {
            rawMessages = data.transcript;
        } else if (Array.isArray(data.messages)) {
            rawMessages = data.messages;
        } else if (data.analysis && Array.isArray(data.analysis.transcript)) {
            rawMessages = data.analysis.transcript;
        } else if (typeof data.transcript === 'string') {
            return [{ role: 'assistant', message: data.transcript }];
        }

        return rawMessages.map((msg: any) => ({
            role: msg.role === 'agent' ? 'assistant' : (msg.role || 'user'),
            message: msg.message || msg.content || msg.text || '',
            startTime: msg.startTime ?? msg.start_time ?? msg.time ?? msg.timestamp
        }));
    };

    const messages = getMessages(displayCall);
    const recordingUrl = displayCall.audio_url || displayCall.recordingUrl || displayCall.recording_url || displayCall.artifact?.recordingUrl;

    const getDurationData = (data: any) => {
        let seconds = 0;
        // Check various provider-specific normalized locations
        if (typeof data.call_duration_secs === 'number') seconds = data.call_duration_secs;
        else if (data.analysis?.call_duration_secs) seconds = data.analysis.call_duration_secs;
        else if (typeof data.durationSeconds === 'number') seconds = data.durationSeconds;
        else if (typeof data.duration === 'number') seconds = data.duration;

        if (seconds === 0 && data.endedAt && data.startedAt) {
            const start = new Date(data.startedAt).getTime();
            const end = new Date(data.endedAt).getTime();
            seconds = (end - start) / 1000;
        }

        // Active call fallback
        if (seconds === 0 && (data.status === 'in-progress' || data.status === 'processing') && data.metadata?.start_time_unix_secs) {
            const start = data.metadata.start_time_unix_secs * 1000;
            const now = Date.now();
            seconds = Math.max(0, (now - start) / 1000);
        }

        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return {
            formatted: `${min}m ${sec}s`,
            seconds: seconds
        };
    };

    const { formatted: durationDisplay, seconds: durationSeconds } = getDurationData(displayCall);

    // Cost Mapping
    // Cost is pre-formatted in /api/calls route as "X credits", fallback to displayCall.cost
    const costDisplay = displayCall.cost || (displayCall.metadata?.cost ? `${displayCall.metadata.cost} credits` : '$0.00');

    const startedAtDisplay = displayCall.metadata?.start_time_unix_secs
        ? new Date(displayCall.metadata.start_time_unix_secs * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        })
        : (displayCall.startedAt ? new Date(displayCall.startedAt).toLocaleString() : (displayCall.date || 'N/A'));

    // Determine Call Type and entities
    const rawDynamicVars = displayCall.conversation_initiation_client_data?.dynamic_variables || {};
    const rawType = displayCall.type || displayCall.metadata?.type || rawDynamicVars.direction || rawDynamicVars.type || "unknown";
    const isInbound = rawType === 'inbound';

    // Default call type 
    const callTypeDisplay = isInbound ? "Inbound" : "Outbound";

    const guestNumber = displayCall.customer_number || displayCall.phone || displayCall.caller_number || "Unknown";
    const assistantNumber = displayCall.phoneNumber || "Unknown";
    const assistantName = displayCall.agent_name || (displayCall.source === 'vapi' ? "Vapi AI Assistant" : "AI Agent");

    // Reconstruct connection logic
    let fromName;
    let fromSubInfo;
    let fromLabel;

    let toName;
    let toSubInfo;
    let toLabel;

    const extractedGuestName = (call?.name && call.name !== "Guest" && call.name !== "Unknown")
        ? call.name
        : (displayCall.name && displayCall.name !== "Guest" && displayCall.name !== "Unknown"
            ? displayCall.name
            : (displayCall.lead?.name || displayCall.user_name || displayCall.metadata?.user_name || rawDynamicVars.user_name || displayCall.customer?.name || "Guest"));

    if (isInbound) {
        // Customer calls us
        fromName = extractedGuestName;
        fromSubInfo = guestNumber;
        fromLabel = "From (Customer)";

        toName = assistantName;
        toSubInfo = assistantNumber;
        toLabel = "To (Assistant)";
    } else {
        // We call the customer (or a Web Call simulating us calling)
        fromName = assistantName;
        fromSubInfo = assistantNumber;
        fromLabel = "From (Assistant)";

        toName = extractedGuestName;
        toSubInfo = guestNumber;
        toLabel = "To (Customer)";
    }

    const handleCopyTranscript = () => {
        if (!messages || messages.length === 0) return;

        const header = `CALL TRANSCRIPT\n` +
            `==========================\n` +
            `Date: ${startedAtDisplay}\n` +
            `Duration: ${durationDisplay}\n` +
            `From: ${fromName} (${fromSubInfo !== "Unknown" ? fromSubInfo : "N/A"})\n` +
            `To: ${toName} (${toSubInfo !== "Unknown" ? toSubInfo : "N/A"})\n` +
            `==========================\n\n`;

        const transcriptText = messages
            .filter((msg: any) => msg.role !== 'system')
            .map((msg: any) => {
                const role = (msg.role === 'assistant' || msg.role === 'agent' || msg.role === 'bot' || msg.role === 'model') ? 'AI' : 'User';
                const text = msg.message || msg.content || msg.text || '';

                // Try to get time if available
                let timePrefix = '';
                if (msg.startTime !== undefined && msg.startTime !== null) {
                    const mins = Math.floor(msg.startTime / 60);
                    const secs = Math.floor(msg.startTime % 60);
                    timePrefix = `[${mins}:${secs.toString().padStart(2, '0')}] `;
                }

                return `${timePrefix}${role}: ${text}`;
            })
            .join('\n\n');

        navigator.clipboard.writeText(header + transcriptText);
        setTranscriptCopied(true);
        setTimeout(() => setTranscriptCopied(false), 2000);
    };

    if (!call) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl p-0 gap-0 bg-white overflow-hidden max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 border-b border-border flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-xl font-semibold">Call Details</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto relative">
                    {localLoading && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
                            <SPLoader fullScreen={false} />
                        </div>
                    )}
                    {/* Call Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50/50 border-b border-border items-start">
                        {/* Column 1: Status & Type */}
                        <div className="space-y-6">
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Status</p>
                                <Badge className={`${displayCall.status === 'done' || displayCall.status === 'ended' || displayCall.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-none shadow-none uppercase text-[10px] px-2.5 py-0.5`}>
                                    {displayCall.status || 'Unknown'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Type</p>
                                <Badge variant="outline" className="border-border text-slate-600 uppercase text-[10px] px-2.5 py-0.5">
                                    {callTypeDisplay}
                                </Badge>
                            </div>
                        </div>

                        {/* Column 2: Duration & Date */}
                        <div className="space-y-6">
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Duration</p>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-900">{durationDisplay}</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Date & Time</p>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm text-slate-700">{startedAtDisplay}</span>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Cost breakdown Top */}
                        <div className="space-y-6">
                            {(displayCall.metadata?.charging?.call_charge > 0) && (
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Call Cost</p>
                                    <span className="font-bold text-slate-900">{displayCall.metadata.charging.call_charge} credits</span>
                                </div>
                            )}
                            {(displayCall.llm_charge > 0 || displayCall.metadata?.charging?.llm_charge > 0) && (
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Credits (LLM)</p>
                                    <span className="font-bold text-slate-900">{displayCall.llm_charge || displayCall.metadata?.charging?.llm_charge}</span>
                                </div>
                            )}
                        </div>

                        {/* Column 4: LLM Cost & Name */}
                        <div className="space-y-6">
                            {(displayCall.llm_price > 0 || displayCall.metadata?.charging?.llm_price > 0) && (
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">LLM Cost</p>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">
                                            ${((displayCall.llm_price || displayCall.metadata?.charging?.llm_price || 0) / Math.max(1, (displayCall.durationSeconds / 60) || 1)).toFixed(4)} / min
                                        </span>
                                        <span className="text-xs text-slate-500 mt-0.5">
                                            Total: ${(displayCall.llm_price || displayCall.metadata?.charging?.llm_price || 0).toFixed(4)}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Guest Name</p>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span className="font-bold text-slate-900 truncate max-w-[150px]" title={extractedGuestName}>{extractedGuestName}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Call Information */}
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">Call Information</h3>
                            <div className="p-5 border border-border rounded-xl bg-white shadow-sm">
                                <div className="flex justify-between items-center mb-3 px-2">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">{fromLabel}</p>
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">{toLabel}</p>
                                </div>
                                <div className="flex items-center justify-between gap-4">

                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${fromLabel.includes('Assistant') ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {fromLabel.includes('Assistant') ? <Avatar><AvatarFallback>AI</AvatarFallback></Avatar> : <Phone className="h-5 w-5" />}
                                        </div>
                                        <div className="flex-1 font-semibold text-slate-900 border border-border bg-slate-50/50 rounded-lg px-4 py-3">
                                            <span className="block text-sm">{fromName}</span>
                                            {fromSubInfo !== "Unknown" && fromSubInfo !== "Website/API" && (
                                                <span className="block text-xs font-normal text-slate-500 mt-0.5 tracking-wide">{`+${fromSubInfo.replace(/\+/g, '')}`}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center px-4 shrink-0">
                                        <span className="text-[10px] uppercase font-bold text-blue-600 tracking-widest mb-2">{isInbound ? "INBOUND" : "OUTBOUND"}</span>
                                        <div className="h-0.5 w-20 bg-blue-200 relative">
                                            <ArrowRight className="w-4 h-4 text-blue-600 absolute -right-1.5 -top-[7px]" />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="flex-1 font-semibold text-slate-900 border border-border bg-slate-50/50 rounded-lg px-4 py-3 text-right">
                                            <span className="block text-sm">{toName}</span>
                                            {toSubInfo !== "Unknown" && toSubInfo !== "Website/API" && (
                                                <span className="block text-xs font-normal text-slate-500 mt-0.5 tracking-wide">{`+${toSubInfo.replace(/\+/g, '')}`}</span>
                                            )}
                                        </div>
                                        <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${toLabel.includes('Assistant') ? 'bg-purple-100 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {toLabel.includes('Assistant') ? <Avatar><AvatarFallback>AI</AvatarFallback></Avatar> : <Phone className="h-5 w-5" />}
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Audio Player Section */}
                            {audioUrl && (
                                <ModernAudioPlayer audioUrl={audioUrl} initialDuration={durationSeconds} />
                            )}
                        </div>

                        {/* Summary Section (Structured Data) */}
                        {(() => {
                            const analysis = displayCall.analysis || {};
                            let summaryText = analysis.summary || displayCall.summary || displayCall.transcript_summary || "";

                            // 1. Deep scan for "Call Summary" in structuredData or analysis objects
                            if (!summaryText && (analysis.structuredData || analysis.structured_data)) {
                                const sd = analysis.structuredData || analysis.structured_data;
                                const entries = Array.isArray(sd) ? sd : Object.values(sd || {});
                                for (const item of entries) {
                                    if (typeof item === 'object' && item !== null) {
                                        const name = (item.name || item.label || item.propertyName || "").toLowerCase();
                                        if (name.includes('summary')) {
                                            summaryText = item.result || item.value || item.response || "";
                                            if (summaryText) break;
                                        }
                                    }
                                }
                            }

                            // 2. Scan Artifacts (As suggested by Vapi Docs)
                            if (!summaryText && displayCall.artifact?.messages) {
                                const artMsgs = displayCall.artifact.messages;
                                for (const msg of artMsgs) {
                                    if (msg.role === 'assistant' && (msg.content?.toLowerCase().includes('summary') || msg.name?.toLowerCase().includes('summary'))) {
                                        summaryText = msg.content;
                                        break;
                                    }
                                }
                            }

                            if (!summaryText) return null;

                            return (
                                <div className="mb-8 p-6 bg-blue-50/40 border border-blue-100 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center">
                                            <FileText className="h-3.5 w-3.5 text-white" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Call Summary</h3>
                                    </div>
                                    <p className="text-[13px] leading-relaxed text-slate-700 font-medium whitespace-pre-wrap">
                                        {summaryText}
                                    </p>
                                </div>
                            );
                        })()}

                        {/* Transcript */}
                        <div className="flex-1 min-h-[200px]">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Transcript</h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 gap-2 text-[10px] font-bold uppercase transition-all ${transcriptCopied ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                                    onClick={handleCopyTranscript}
                                >
                                    {transcriptCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    {transcriptCopied ? 'Copied' : 'Copy Transcript'}
                                </Button>
                            </div>
                            <ScrollArea className="h-[300px] w-full rounded-lg border border-border bg-slate-50 p-4">
                                <div className="space-y-4">
                                    {Array.isArray(messages) && messages
                                        .filter((msg: any) => msg.role !== 'system') // Filter out system prompt
                                        .map((msg: any, idx: number) => (
                                            <TranscriptMessage
                                                key={idx}
                                                role={msg.role}
                                                text={msg.message || msg.content || msg.text || ''}
                                            />
                                        ))}
                                    {(!messages || messages.length === 0) && (
                                        <p className="text-sm text-slate-500 text-center italic">No transcript available.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}

function ModernAudioPlayer({ audioUrl, initialDuration = 0 }: { audioUrl: string, initialDuration?: number }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const seekRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // Start false for instant interaction
    const [isDragging, setIsDragging] = useState(false);
    const [isStalled, setIsStalled] = useState(false); // New state for actual buffering transitions

    const formatTime = (secs: number) => {
        if (!isFinite(secs) || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => { });
        }
    }, [isPlaying]);

    const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const bar = seekRef.current;
        // Guard: only seek when duration is a real, finite, positive number
        if (!audio || !bar || !isFinite(duration) || duration <= 0) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        if (isFinite(newTime)) {
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
        setIsMuted(v === 0);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isMuted) {
            audio.volume = volume || 1;
            audio.muted = false;
            setIsMuted(false);
        } else {
            audio.muted = true;
            setIsMuted(true);
        }
    };

    const skip = (secs: number) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(duration) || duration <= 0) return;
        const newTime = Math.max(0, Math.min(duration, audio.currentTime + secs));
        if (isFinite(newTime)) {
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    // Speed — cycles through SPEEDS on each click
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const [speed, setSpeed] = useState(1);

    // Sync initial duration if provided and current duration is 0
    useEffect(() => {
        if (initialDuration > 0 && duration === 0) {
            setDuration(initialDuration);
        }
    }, [initialDuration, duration]);

    const changeSpeed = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        audio.playbackRate = next;
        setSpeed(next);
    };

    useEffect(() => {
        if (audioRef.current && audioUrl) {
            audioRef.current.load();
            setIsPlaying(false);
            setCurrentTime(0);
            setIsLoading(true);
        }
    }, [audioUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setFiniteDuration = () => {
            if (isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
            setIsLoading(false);
            setIsStalled(false);
        };
        const onTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
        const onPlay = () => {
            setIsPlaying(true);
            setIsStalled(false);
        };
        const onPause = () => setIsPlaying(false);
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
        const onWaiting = () => setIsStalled(true);
        const onPlaying = () => {
            setIsLoading(false);
            setIsStalled(false);
        };
        const onCanPlay = () => {
            setIsLoading(false);
            setIsStalled(false);
        };

        audio.addEventListener('loadedmetadata', setFiniteDuration);
        audio.addEventListener('durationchange', setFiniteDuration);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('canplay', onCanPlay);

        return () => {
            audio.removeEventListener('loadedmetadata', setFiniteDuration);
            audio.removeEventListener('durationchange', setFiniteDuration);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('playing', onPlaying);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('canplay', onCanPlay);
        };
    }, [isDragging]);

    const progressPct = (isFinite(duration) && duration > 0) ? (currentTime / duration) * 100 : 0;
    const volPct = (isMuted ? 0 : volume) * 100;

    return (
        <div className="mt-6 p-5 border border-border rounded-xl bg-slate-50/50 shadow-sm">
            {/* Hidden native audio element — all browser compat underneath */}
            <audio
                ref={audioRef}
                src={audioUrl && audioUrl.startsWith('http') ? `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}` : audioUrl}
                preload="metadata"
                style={{ display: 'none' }}
            />

            {/* Header: title + download */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 text-blue-600">
                        <Volume2 className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-none">Call Recording</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Play to review conversation</p>
                    </div>
                </div>
                <a
                    href={audioUrl}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wide transition-colors"
                    title="Download Recording"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                </a>
            </div>

            {/* Seek Bar */}
            <div
                ref={seekRef}
                className="relative h-2.5 w-full rounded-full bg-slate-200 cursor-pointer mb-2 group"
                onClick={handleSeekClick}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
            >
                <div
                    className="absolute top-0 left-0 h-full rounded-full bg-blue-500"
                    style={{ width: `${progressPct}%`, transition: isDragging ? 'none' : 'width 75ms linear' }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-blue-600 shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 8px)` }}
                />
            </div>

            {/* Time display */}
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-4">
                <span>{formatTime(currentTime)}</span>
                <span>{(isLoading && duration === 0) ? '–:––' : formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-4">
                {/* Skip-back + Play/Pause + Skip-forward */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => skip(-10)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[11px] font-bold"
                        title="Rewind 10s"
                    >
                        ‑10
                    </button>
                    <button
                        onClick={togglePlay}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isStalled ? (
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : isPlaying ? (
                            <Pause className="h-4 w-4" />
                        ) : (
                            <Play className="h-4 w-4 ml-0.5" />
                        )}
                    </button>
                    <button
                        onClick={() => skip(10)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[11px] font-bold"
                        title="Forward 10s"
                    >
                        +10
                    </button>
                </div>

                {/* Speed + Volume */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={changeSpeed}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors min-w-[44px] text-center"
                        title="Cycle playback speed"
                    >
                        {speed === 1 ? '1×' : `${speed}×`}
                    </button>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={toggleMute}
                            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-20 cursor-pointer"
                            title="Volume"
                            style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                height: '6px',
                                borderRadius: '9999px',
                                background: `linear-gradient(to right, #2563eb ${volPct}%, #e2e8f0 ${volPct}%)`
                            }}
                        />
                    </div>
                </div>
            </div>


        </div>
    );
}

function TranscriptMessage({ role, text }: { role: string; text: string }) {
    const isAssistant = role === 'assistant' || role === 'model' || role === 'system' || role === 'bot';
    const isUser = role === 'user';
    const isTool = role === 'tool' || role === 'function' || role === 'tool-calls' || role === 'tool-output';

    if (isTool) {
        // Optional: Render tools differently or skip
        return (
            <div className="flex gap-3 justify-center">
                <div className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded border border-border font-mono max-w-[80%] whitespace-pre-wrap text-center">
                    Tool Info: {text}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isAssistant ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                {isAssistant ? <span className="text-xs font-bold">AI</span> : <span className="text-xs font-bold">U</span>}
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isAssistant
                ? 'bg-white border border-border text-slate-700 rounded-tl-none'
                : 'bg-blue-600 text-white rounded-tr-none'
                }`}>
                {text}
            </div>
        </div>
    );
}
