"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, Mic, ExternalLink, Copy, Eye, EyeOff, ShieldCheck, Wallet, Phone, BarChart3, Settings, Smartphone } from "lucide-react";
import React, { useState } from "react";
import { MaqsamBalanceDetail } from "@/components/dashboard/maqsam-balance-detail";
import { useRouter } from "next/navigation";

import { useData } from "@/context/DataContext";

export default function CredentialsPage() {
    const { calls, voiceBalance, maqsamBalance, twilioBalance, loadingBalances } = useData();

    const vapiAgentUsed = React.useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls]);

    const maqsamUsedCost = React.useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => {
            const isMaqsam = c.source === 'maqsam';
            const phoneStr = String(c.phone || c.customer_number || "");
            const isUAE = phoneStr.startsWith('+971') || phoneStr.startsWith('971');
            return isMaqsam || isUAE;
        }).reduce((acc: number, call: any) => acc + (call.costValue || 0), 0);
    }, [calls]);

    const [senderEmails, setSenderEmails] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    React.useEffect(() => {
        const fetchEmails = async () => {
            try {
                const res = await fetch('/api/email/warmup-analytics', { method: 'POST' });
                if (!res.ok) throw new Error("Failed to fetch analytics");
                const data = await res.json();

                // Extract emails from the warmup account objects
                if (Array.isArray(data)) {
                    const emails = data.map((account: any) => account.email);
                    setSenderEmails(emails);
                }
            } catch (err) {
                console.error("Error fetching sender emails:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEmails();
    }, []);

    const vapiDetails = voiceBalance?.vapi;
    const elDetails = voiceBalance?.elevenlabs || (voiceBalance?.character_limit ? voiceBalance : null);

    return (
        <div className="space-y-8 pb-10 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Credentials Management</h1>
                    <p className="text-slate-500">View your active integrations and manageable accounts.</p>
                </div>
            </div>

            <div className="grid gap-6">
                {/* Email Section */}
                <CredentialSection
                    title="Email Integration"
                    description="Active sender accounts detected from your campaigns."
                    icon={Mail}
                    iconColor="text-rose-600"
                    iconBg="bg-rose-50"
                >
                    <div className="grid gap-6 md:grid-cols-2">
                        {loading ? (
                            <div className="md:col-span-2 text-slate-400 text-sm animate-pulse">Detecting active email accounts...</div>
                        ) : senderEmails.length > 0 ? (
                            senderEmails.map((email, idx) => (
                                <ReadOnlyField key={idx} label={`Project Email ${idx + 1}`} value={email} />
                            ))
                        ) : (
                            <ReadOnlyField label="Connected Email" value="No active emails detected" />
                        )}
                    </div>
                </CredentialSection>

                {/* WhatsApp Section */}
                <CredentialSection
                    title="WhatsApp Business API"
                    description="Meta Business API credentials for WhatsApp CRM."
                    icon={MessageCircle}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                >
                    <div className="grid gap-6 md:grid-cols-2">
                        <ReadOnlyField label="WhatsApp Account 1 " value="+971 52 563 3027" />
                        <ReadOnlyField label="WhatsApp Account 2" value="+971 52 563 2921" />
                    </div>
                </CredentialSection>

                {/* Provisioned Numbers Section */}
                <CredentialSection
                    title="Provisioned Phone Numbers"
                    description="Active telephony lines for Voice and WhatsApp."
                    icon={Phone}
                    iconColor="text-slate-600"
                    iconBg="bg-slate-50"
                >
                    <div className="grid gap-8 md:grid-cols-3">
                        {/* UK Section */}
                        <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-border">
                            <ReadOnlyField label="Twilio (UK)" value="+44 (7462) 179309" />
                            <ReadOnlyField label="Agent ID" value="918c25eb-9882-452e-86df-b4851d464852" />
                        </div>

                        {/* US Section */}
                        <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-border">
                            <ReadOnlyField label="Twilio (US)" value="+1 (478) 215 9151" />
                            <ReadOnlyField label="Agent ID" value="b35e3032-7865-4913-ba22-a913b5d4117b" />
                        </div>

                        {/* UAE Section */}
                        <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-border">
                            <ReadOnlyField label="Maqsam (UAE)" value="+97148714150" />
                            <ReadOnlyField label="Agent ID" value="70f05e16-18f3-4f6e-964a-f47b299c6c1d" />
                        </div>
                    </div>
                </CredentialSection>

                {/* Voice Section */}
                <CredentialSection
                    title="Voice Agent (Vapi & ElevenLabs)"
                    description="AI Voice configuration and wallet balances."
                    icon={Mic}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                    action={
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="border-borderlue-200 text-blue-600 hover:bg-blue-50 gap-2" onClick={() => router.push('/dashboard/voice/logs')}>
                                <BarChart3 className="h-4 w-4" />
                                Detailed Cost Analysis
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={() => window.open('https://dashboard.vapi.ai/login', '_blank')}>
                                <Wallet className="h-4 w-4" />
                                Vapi Wallet
                            </Button>
                        </div>
                    }
                >
                    <div className="grid gap-6">
                        {/* Vapi Details */}
                        <div className="bg-blue-50/50 rounded-lg p-5 border border-borderlue-100 flex flex-col gap-4">
                            <div className="flex flex-col text-center bg-white p-8 rounded-lg border border-borderlue-100 shadow-sm">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Vapi Credits Used</span>
                                <span className="text-5xl font-black text-blue-600">
                                    ${vapiAgentUsed.toFixed(2)}
                                </span>
                                <p className="text-[10px] text-blue-500 mt-4 font-semibold bg-blue-50 px-3 py-1 rounded-full self-center border border-borderlue-100 italic">
                                    Total Lifetime Consumption
                                </p>
                            </div>
                        </div>

                        {/* ElevenLabs Details */}
                        <div className="bg-amber-50/50 rounded-lg p-5 border border-amber-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-md border border-amber-200">
                                        <Settings className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">ElevenLabs Credits</p>
                                        <p className="text-xs text-slate-500">Subscription Status: {elDetails?.status || 'Active'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Characters Left</p>
                                    <p className="text-2xl font-black text-emerald-600 uppercase">
                                        {elDetails ? `${((elDetails.character_limit - elDetails.character_count) || 0).toLocaleString()}` : '...'}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-amber-100">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Capacity</p>
                                    <p className="text-sm font-bold text-slate-700">
                                        {(elDetails?.character_limit || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Used Characters</p>
                                    <p className="text-sm font-bold text-slate-500">
                                        {(elDetails?.character_count || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CredentialSection>

                <CredentialSection
                    title="Maqsam Telephony"
                    description="VoIP and Telephony provider credentials."
                    icon={Phone}
                    iconColor="text-slate-600"
                    iconBg="bg-slate-50"
                    action={
                        <Button className="bg-slate-600 hover:bg-slate-700 text-white gap-2" onClick={() => window.open('https://maqsam.com', '_blank')}>
                            <Wallet className="h-4 w-4" />
                            Manage Billing
                        </Button>
                    }
                >

                    <MaqsamBalanceDetail initialBalance={maqsamBalance} />
                </CredentialSection>

                {/* Twilio Section */}
                <CredentialSection
                    title="Twilio Telephony"
                    description="Real-time balance and usage records for Twilio."
                    icon={Smartphone}
                    iconColor="text-rose-600"
                    iconBg="bg-rose-50"
                    action={
                        <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-2" onClick={() => window.open('https://console.twilio.com', '_blank')}>
                            <ExternalLink className="h-4 w-4" />
                            Twilio Console
                        </Button>
                    }
                >
                    <div className="space-y-4">
                        <div className="bg-rose-50/50 rounded-lg p-4 border border-rose-100 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-md border border-rose-200">
                                    <Smartphone className="h-5 w-5 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">Twilio Account</p>
                                    <p className="text-xs text-slate-500 font-mono">{twilioBalance?.account_sid || '---'}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Available Balance</p>
                                <p className="text-2xl font-black text-rose-600">
                                    {twilioBalance?.balance !== undefined ? `$${twilioBalance.balance.toFixed(2)}` : '---'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-lg border border-border text-center shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Recharge (PAYG)</p>
                                <p className="text-lg font-bold text-slate-800">
                                    {twilioBalance?.total_recharge !== undefined ? `$${twilioBalance.total_recharge.toFixed(2)}` : '---'}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-border text-center shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Used</p>
                                <p className="text-lg font-bold text-slate-600">
                                    {twilioBalance?.used !== undefined ? `$${twilioBalance.used.toFixed(2)}` : '---'}
                                </p>
                            </div>
                        </div>
                    </div>
                </CredentialSection>
            </div>
        </div>
    );
}

function CredentialSection({ title, description, icon: Icon, iconColor, iconBg, children, action }: any) {
    return (
        <Card className="border-border shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-border border-border bg-slate-50/30 pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${iconBg} ${iconColor}`}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
                            <CardDescription className="mt-1">{description}</CardDescription>
                        </div>
                    </div>
                    {action && <div>{action}</div>}
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {children}
            </CardContent>
        </Card>
    );
}

function ReadOnlyField({ label, value, isPassword }: { label: string, value: string, isPassword?: boolean }) {
    const [show, setShow] = useState(false);

    // Simple masking logic
    const displayValue = isPassword && !show
        ? "••••••••••••••••••••••••"
        : value;

    return (
        <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</Label>
            <div className="relative group">
                <div className="flex items-center w-full rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm">
                    <span className={`flex-1 truncate ${isPassword && !show ? 'font-mono tracking-widest' : 'font-sans'}`}>
                        {displayValue}
                    </span>
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isPassword && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => setShow(!show)}>
                                {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-600"
                            onClick={() => navigator.clipboard.writeText(value)}
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
