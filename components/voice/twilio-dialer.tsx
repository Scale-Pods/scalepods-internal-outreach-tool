'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Phone, PhoneOff, Mic, MicOff,
    Delete, X, Loader2, PhoneCall, ChevronDown, Check,
} from 'lucide-react';
import { CALLER_NUMBERS, DEFAULT_CALLER_NUMBER } from '@/lib/services/caller-numbers';

type Status = 'idle' | 'loading' | 'ready' | 'calling' | 'connected' | 'error';

const KEYPAD = [
    { key: '1', sub: '' },
    { key: '2', sub: 'ABC' },
    { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' },
    { key: '5', sub: 'JKL' },
    { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' },
    { key: '8', sub: 'TUV' },
    { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' },
    { key: '0', sub: '+' },
    { key: '#', sub: '' },
];

function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const STATUS_COLOR: Record<Status, string> = {
    idle: 'text-zinc-500',
    loading: 'text-zinc-400',
    ready: 'text-emerald-400',
    calling: 'text-yellow-400',
    connected: 'text-emerald-400',
    error: 'text-red-400',
};

const DOT_COLOR: Record<Status, string> = {
    idle: 'bg-zinc-600',
    loading: 'bg-zinc-500 animate-pulse',
    ready: 'bg-emerald-500',
    calling: 'bg-yellow-400 animate-pulse',
    connected: 'bg-emerald-500 animate-pulse',
    error: 'bg-red-500',
};

type TwilioDialerProps = {
    /** Render a custom trigger element; receives an onClick to open the dialer. */
    renderTrigger?: (props: { onClick: () => void }) => React.ReactNode;
};

export function TwilioDialer({ renderTrigger }: TwilioDialerProps = {}) {
    const [isOpen, setIsOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [statusMsg, setStatusMsg] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    const [callerNumber, setCallerNumberState] = useState(DEFAULT_CALLER_NUMBER);
    const [pickerOpen, setPickerOpen] = useState(false);

    // Remember the last-used caller number per browser so reps don't have to
    // re-pick it every time they open the dialer.
    useEffect(() => {
        try {
            const saved = localStorage.getItem('dialer_caller_number');
            if (saved && CALLER_NUMBERS.some(c => c.number === saved)) setCallerNumberState(saved);
        } catch { /* noop */ }
    }, []);

    function setCallerNumber(number: string) {
        setCallerNumberState(number);
        try { localStorage.setItem('dialer_caller_number', number); } catch { /* noop */ }
    }

    const deviceRef = useRef<any>(null);
    const callRef = useRef<any>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize Twilio Device whenever dialer opens
    useEffect(() => {
        if (!isOpen) return;

        let mounted = true;

        async function init() {
            setStatus('loading');
            setStatusMsg('Initializing...');

            try {
                const res = await fetch('/api/twilio/token');
                const json = await res.json();
                if (!mounted) return;
                if (json.error || !json.token) throw new Error(json.error || 'No token');

                const { Device } = await import('@twilio/voice-sdk');
                if (!mounted) return;

                const device = new Device(json.token, { logLevel: 1 });
                deviceRef.current = device;

                device.on('registered', () => {
                    if (mounted) { setStatus('ready'); setStatusMsg('Ready to call'); }
                });
                device.on('error', (err: any) => {
                    if (mounted) { setStatus('error'); setStatusMsg(err.message || 'Device error'); }
                });

                await device.register();
            } catch (err: any) {
                if (mounted) {
                    setStatus('error');
                    setStatusMsg(err.message || 'Initialization failed');
                }
            }
        }

        init();

        return () => {
            mounted = false;
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            try { callRef.current?.disconnect(); } catch { /* noop */ }
            try { deviceRef.current?.destroy(); } catch { /* noop */ }
            deviceRef.current = null;
            callRef.current = null;
            setStatus('idle');
            setStatusMsg('');
            setDuration(0);
            setIsMuted(false);
            setPickerOpen(false);
        };
    }, [isOpen]);

    async function makeCall() {
        if (!deviceRef.current || !phoneNumber.trim() || status !== 'ready') return;

        setStatus('calling');
        setStatusMsg(`Calling ${phoneNumber.trim()}…`);

        try {
            const call = await deviceRef.current.connect({
                params: { To: phoneNumber.trim(), CallerId: callerNumber },
            });
            callRef.current = call;

            call.on('accept', () => {
                setStatus('connected');
                setStatusMsg('Connected');
                setDuration(0);
                timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            });

            const finish = (msg: string) => {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                callRef.current = null;
                setStatus('ready');
                setStatusMsg(msg);
                setIsMuted(false);
                setDuration(0);
                setTimeout(() => setStatusMsg('Ready to call'), 2500);
            };

            call.on('disconnect', () => finish('Call ended'));
            call.on('cancel', () => finish('Cancelled'));
            call.on('reject', () => finish('Rejected'));
            call.on('error', (err: any) => finish(err.message || 'Call error'));
        } catch (err: any) {
            setStatus('ready');
            setStatusMsg(err.message || 'Call failed');
        }
    }

    function hangUp() {
        try { callRef.current?.disconnect(); } catch { /* noop */ }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        callRef.current = null;
        setStatus('ready');
        setStatusMsg('Call ended');
        setIsMuted(false);
        setDuration(0);
        setTimeout(() => setStatusMsg('Ready to call'), 2500);
    }

    function toggleMute() {
        if (!callRef.current) return;
        const next = !isMuted;
        callRef.current.mute(next);
        setIsMuted(next);
    }

    function pressKey(key: string) {
        if (status === 'connected') {
            callRef.current?.sendDigits(key);
        } else if (status !== 'calling') {
            setPhoneNumber(p => p + key);
        }
    }

    function handleClose() {
        if (status === 'connected' || status === 'calling') return;
        setIsOpen(false);
        setPhoneNumber('');
    }

    const isInCall = status === 'connected' || status === 'calling';

    return (
        <>
            {/* Trigger */}
            {renderTrigger ? (
                renderTrigger({ onClick: () => setIsOpen(true) })
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-8 right-8 z-40 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white shadow-[0_0_30px_-5px_rgba(16,185,129,0.7)] transition-all duration-200 flex items-center justify-center group"
                    aria-label="Open dialer"
                >
                    <Phone className="h-6 w-6 transition-transform duration-200 group-hover:rotate-12" />
                </button>
            )}

            {/* Modal overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/65 backdrop-blur-md"
                        onClick={handleClose}
                    />

                    {/* Dialer panel */}
                    <div className="relative w-full max-w-[22rem] bg-zinc-950 border border-white/10 rounded-3xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden">
                        {/* Top accent line */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${DOT_COLOR[status]}`} />
                                    <span className="text-white font-semibold text-sm tracking-wide">Voice Dialer</span>
                                </div>
                                <button
                                    onClick={handleClose}
                                    disabled={isInCall}
                                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Status line */}
                            <div className={`text-center text-sm font-medium mb-4 h-5 transition-colors ${STATUS_COLOR[status]}`}>
                                {status === 'loading' ? (
                                    <span className="flex items-center justify-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        {statusMsg}
                                    </span>
                                ) : status === 'connected' ? (
                                    <span className="flex items-center justify-center gap-1.5">
                                        <PhoneCall className="h-3 w-3" />
                                        {formatDuration(duration)}
                                    </span>
                                ) : (
                                    statusMsg
                                )}
                            </div>

                            {/* Caller ID picker — which of our numbers to call from */}
                            <div className="relative mb-3">
                                <button
                                    onClick={() => !isInCall && setPickerOpen(o => !o)}
                                    disabled={isInCall}
                                    className="w-full flex items-center justify-between gap-2 bg-zinc-900 border border-white/5 hover:border-white/10 rounded-xl px-3.5 py-2.5 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold shrink-0">Call from</span>
                                    <span className="flex-1 text-right text-sm text-white font-mono truncate">
                                        {CALLER_NUMBERS.find(c => c.number === callerNumber)?.display ?? callerNumber}
                                    </span>
                                    {!isInCall && (
                                        <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </button>

                                {pickerOpen && !isInCall && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-900 border border-white/10 rounded-xl shadow-[0_15px_35px_-10px_rgba(0,0,0,0.7)] overflow-hidden z-10">
                                        {CALLER_NUMBERS.map(c => (
                                            <button
                                                key={c.number}
                                                onClick={() => { setCallerNumber(c.number); setPickerOpen(false); }}
                                                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-zinc-800 transition-colors"
                                            >
                                                <span>
                                                    <span className="text-xs font-semibold text-white">{c.label}</span>
                                                    <span className="ml-2 text-xs text-zinc-500 font-mono">{c.display}</span>
                                                </span>
                                                {callerNumber === c.number && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Number display */}
                            <div className="flex items-center gap-2 bg-zinc-900 border border-white/5 rounded-2xl px-4 py-3 mb-5 focus-within:border-emerald-500/30 transition-colors">
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={e => !isInCall && setPhoneNumber(e.target.value)}
                                    placeholder="+1 234 567 8900"
                                    readOnly={isInCall}
                                    className="flex-1 bg-transparent text-white text-xl font-mono tracking-wider outline-none placeholder:text-zinc-700 min-w-0"
                                    autoFocus
                                />
                                {phoneNumber && !isInCall && (
                                    <button
                                        onClick={() => setPhoneNumber(p => p.slice(0, -1))}
                                        className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 active:scale-90"
                                    >
                                        <Delete className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Keypad grid */}
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                {KEYPAD.map(({ key, sub }) => (
                                    <button
                                        key={key}
                                        onClick={() => pressKey(key)}
                                        className="h-14 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 active:scale-95 border border-white/5 hover:border-white/10 transition-all duration-100 flex flex-col items-center justify-center gap-0.5"
                                    >
                                        <span className="text-white font-semibold text-base leading-none">{key}</span>
                                        {sub && (
                                            <span className="text-zinc-600 text-[9px] font-medium leading-none tracking-widest">{sub}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Call controls */}
                            <div className="flex items-center justify-center gap-4">
                                {/* Mute (only when connected) */}
                                {status === 'connected' && (
                                    <button
                                        onClick={toggleMute}
                                        className={`h-12 w-12 rounded-full flex items-center justify-center transition-all active:scale-90 border ${
                                            isMuted
                                                ? 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                                                : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white hover:border-white/10'
                                        }`}
                                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                    </button>
                                )}

                                {/* Main call / hang-up button */}
                                {isInCall ? (
                                    <button
                                        onClick={hangUp}
                                        className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 flex items-center justify-center shadow-[0_0_25px_-5px_rgba(239,68,68,0.6)] transition-all"
                                        aria-label="End call"
                                    >
                                        <PhoneOff className="h-6 w-6 text-white" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={makeCall}
                                        disabled={!phoneNumber.trim() || status !== 'ready'}
                                        className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_0_25px_-5px_rgba(16,185,129,0.6)] transition-all"
                                        aria-label="Make call"
                                    >
                                        <Phone className="h-6 w-6 text-white" />
                                    </button>
                                )}
                            </div>

                            {/* Hint */}
                            <p className="text-center text-zinc-700 text-[10px] mt-4">
                                Enter number with country code · e.g. +971 50 123 4567
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
