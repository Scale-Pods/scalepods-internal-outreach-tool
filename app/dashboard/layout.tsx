"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Mail, MessageCircle, Mic, Settings, LogOut, ChevronDown, Wallet, BarChart2, Users, Send, Key, ExternalLink, Smartphone, AlertCircle, Inbox, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataProvider, useData } from "@/context/DataContext";
import { MaqsamBalanceDetail } from "@/components/dashboard/maqsam-balance-detail";
import { calculateDuration } from "@/lib/utils";
import { useMemo } from "react";
import { logout } from "@/app/actions/auth";

const sidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Email Marketing",
        href: "/dashboard/email",
        icon: Mail,
    },
    {
        title: "WhatsApp",
        href: "/dashboard/whatsapp",
        icon: MessageCircle,
    },
    {
        title: "Voice Agent",
        href: "/dashboard/voice",
        icon: Mic,
    },
];

function WalletModal({ isOpen, onClose, type, details, calls }: { isOpen: boolean, onClose: () => void, type: 'vapi' | 'maqsam' | 'twilio', details?: any, calls?: any[] }) {
    const { voiceBalance, maqsamBalance } = useData();

    const title = (() => {
        switch (type) {
            case 'vapi': return 'Vapi Wallet';

            case 'maqsam': return 'Maqsam Telephony';
            case 'twilio': return 'Twilio Account';
            default: return 'Balance Detail';
        }
    })();

    const icon = (() => {
        switch (type) {
            case 'vapi': return <Mic className="h-5 w-5 text-blue-600" />;

            case 'maqsam': return <Wallet className="h-5 w-5 text-slate-600" />;
            case 'twilio': return <Smartphone className="h-5 w-5 text-rose-600" />;
            default: return <Wallet className="h-5 w-5" />;
        }
    })();

    const vapiAgentUsed = useMemo(() => {
        // Prioritize Vapi API's native 'used' value if available
        if (voiceBalance?.vapi?.used !== undefined && voiceBalance?.vapi?.used !== 0) {
            return voiceBalance.vapi.used;
        }
        if (!calls || !Array.isArray(calls)) return 0;
        // Fallback to summing 'agent' costs from logs specifically
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls, voiceBalance]);

    const maqsamUsedCost = useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => {
            const isMaqsam = c.source === 'maqsam';
            const provisionedNum = String(c.phoneNumber || "");
            const isSpecificMaqsamNum = provisionedNum.replace(/\D/g, '') === '97148714150';

            // Detection based on customer number prefix (legacy)
            const phoneStr = String(c.phone || c.customer_number || "");
            const isUAE = phoneStr.startsWith('+971') || phoneStr.startsWith('971');

            return isMaqsam || isUAE || isSpecificMaqsamNum;
        }).reduce((acc: number, call: any) => {
            // For Maqsam/Telephony, specifically sum the telephony-only portion
            return acc + (call.breakdown?.telephony || call.costValue || 0);
        }, 0);
    }, [calls]);

    const vapiDetails = voiceBalance?.vapi;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={type === 'maqsam' ? "sm:max-w-[550px]" : "sm:max-w-[420px]"}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {icon}
                        <span>{title}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2 space-y-6">
                    {type === 'vapi' && (
                        <div className="bg-blue-50/50 rounded-xl p-6 border border-borderlue-100 flex flex-col gap-4">
                            <div className="flex flex-col text-center bg-card p-8 rounded-lg border border-borderlue-100 shadow-sm">
                                <span className="text-sm font-bold text-muted-foreground/80 uppercase tracking-[0.2em] mb-2">Vapi Credits Used</span>
                                <span className="text-5xl font-black text-blue-600">
                                    ${vapiAgentUsed.toFixed(2)}
                                </span>

                            </div>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12" onClick={() => window.open('https://vapi.ai', '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Add Funds to VAPI
                            </Button>
                        </div>
                    )}


                    {type === 'twilio' && (
                        <div className="bg-rose-50/50 rounded-xl p-5 border border-rose-100 flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col text-center bg-card p-6 rounded-lg border border-rose-100 shadow-sm">
                                    <span className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider mb-1">Remaining Balance</span>
                                    <span className="text-4xl font-black text-rose-600">
                                        {typeof details?.balance === 'number' ? `$${details.balance.toFixed(2)}` : "---"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/80 mt-2 font-mono uppercase">{details?.account_sid || "Account SID Loading..."}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col text-center bg-card p-3 rounded-lg border border-rose-100 shadow-sm">
                                        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-1">Total Pay-As-You-Go</span>
                                        <span className="text-lg font-bold text-foreground/90">
                                            {typeof details?.total_recharge === 'number' ? `$${details.total_recharge.toFixed(2)}` : "---"}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-center bg-card p-3 rounded-lg border border-rose-100 shadow-sm">
                                        <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-1">Used to Date</span>
                                        <span className="text-lg font-bold text-muted-foreground">
                                            {typeof details?.used === 'number' ? `$${details.used.toFixed(2)}` : "---"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-2" onClick={() => window.open('https://console.twilio.com', '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Add Funds to Twilio
                            </Button>
                        </div>
                    )}

                    {type === 'maqsam' && (
                        <div className="space-y-4">
                            <MaqsamBalanceDetail initialBalance={maqsamBalance} />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DataProvider>
            <DashboardContent>
                {children}
            </DashboardContent>
        </DataProvider>
    );
}

function DashboardContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const dashboardConfig = {
        master: {
            label: "Master Overview",
            icon: LayoutDashboard,
            items: [
                { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { title: "Email Marketing", href: "/dashboard/email", icon: Mail },
                { title: "WhatsApp CRM", href: "/dashboard/whatsapp", icon: MessageCircle },
                { title: "Voice Agent", href: "/dashboard/voice", icon: Mic },
                { title: "Leads", href: "/dashboard/leads", icon: Users },
                { title: "Credentials", href: "/dashboard/credentials", icon: Key },
            ]
        },
        email: {
            label: "Email Marketing",
            icon: Mail,
            items: [
                { title: "Overview", href: "/dashboard/email", icon: LayoutDashboard },
                { title: "Sent", href: "/dashboard/email/sent", icon: Send },
                { title: "Received", href: "/dashboard/email/received", icon: Inbox },
                { title: "Bounces", href: "/dashboard/email/bounces", icon: AlertCircle },
                { title: "Unsubscribed", href: "/dashboard/email/unsubscribed", icon: UserMinus },
                { title: "Analytics", href: "/dashboard/email/analytics", icon: BarChart2 },
            ]
        },
        whatsapp: {
            label: "WhatsApp CRM",
            icon: MessageCircle,
            items: [
                { title: "Overview", href: "/dashboard/whatsapp", icon: LayoutDashboard },
                { title: "Chat", href: "/dashboard/whatsapp/chat", icon: MessageCircle },
                { title: "Leads", href: "/dashboard/whatsapp/leads", icon: Users },
                { title: "Analytics", href: "/dashboard/whatsapp/analytics", icon: BarChart2 },
            ]
        },
        voice: {
            label: "Voice Agent",
            icon: Mic,
            items: [
                { title: "Overview", href: "/dashboard/voice", icon: LayoutDashboard },
                { title: "Call Logs", href: "/dashboard/voice/logs", icon: Mic },
                { title: "Analytics", href: "/dashboard/voice/analytics", icon: BarChart2 },
            ]
        }
    };

    // Determine current context
    let currentContext = "master";
    if (pathname.startsWith("/dashboard/email")) currentContext = "email";
    else if (pathname.startsWith("/dashboard/whatsapp")) currentContext = "whatsapp";
    else if (pathname.startsWith("/dashboard/voice")) currentContext = "voice";

    const activeConfig = (dashboardConfig as any)[currentContext];

    const {
        calls,
        voiceBalance,
        maqsamBalance,
        twilioBalance,
        loadingBalances,
        loadingCalls
    } = useData();
    const vapiAgentUsed = useMemo(() => {
        // Prioritize Vapi API's native 'used' value if available
        if (voiceBalance?.vapi?.used !== undefined && voiceBalance?.vapi?.used !== 0) {
            return voiceBalance.vapi.used;
        }
        if (!calls || !Array.isArray(calls)) return 0;
        // Fallback to summing 'agent' costs from logs specifically
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls, voiceBalance]);

    const maqsamUsedCost = useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        return calls.filter((c: any) => {
            const isMaqsam = c.source === 'maqsam';
            const provisionedNum = String(c.phoneNumber || "");
            const isSpecificMaqsamNum = provisionedNum.replace(/\D/g, '') === '97148714150';

            // Detection based on customer number prefix (legacy)
            const phoneStr = String(c.phone || c.customer_number || "");
            const isUAE = phoneStr.startsWith('+971') || phoneStr.startsWith('971');

            return isMaqsam || isUAE || isSpecificMaqsamNum;
        }).reduce((acc: number, call: any) => {
            // For Maqsam/Telephony, specifically sum the telephony-only portion
            return acc + (call.breakdown?.telephony || call.costValue || 0);
        }, 0);
    }, [calls]);

    const [walletModal, setWalletModal] = useState<{ isOpen: boolean, type: 'vapi' | 'maqsam' | 'twilio' }>({
        isOpen: false,
        type: 'vapi'
    });


    const content = (() => {

        return (
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
                {/* Sidebar */}
                <aside className="hidden w-64 flex-col bg-white border-r border-border md:flex font-sans">
                    {/* Logo Section */}
                    <div className="p-6 pb-4 flex justify-start items-center gap-3">
                        <Link href="/" className="relative w-10 h-10 block flex-shrink-0">
                            <Image
                                src="/sidebar_logo.png"
                                alt="ScalePods Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </Link>
                        <span className="text-2xl font-black tracking-tighter text-slate-900 uppercase whitespace-nowrap">
                            SCALEPODS
                        </span>
                    </div>

                    <div className="px-4 pb-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    suppressHydrationWarning
                                    variant="outline"
                                    className="w-full justify-between bg-transparent border-border text-slate-600 hover:bg-slate-100 hover:text-slate-900 h-10 shadow-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <activeConfig.icon className="h-4 w-4 text-blue-600" />
                                        <span className="truncate">{activeConfig.label}</span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[220px]">
                                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" /> Master Overview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/email")}>
                                    <Mail className="mr-2 h-4 w-4" /> Email Marketing
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/whatsapp")}>
                                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp CRM
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/voice")}>
                                    <Mic className="mr-2 h-4 w-4" /> Voice Agent
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="px-4 py-2">
                        <div className="h-[1px] w-full bg-accent"></div>
                    </div>

                    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-2 mt-2 custom-scrollbar">
                        {activeConfig.items.map((item: any, index: number) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={index}
                                    href={item.href}
                                    className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                            ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                        }`}
                                >
                                    <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-white" : "text-muted-foreground/80 group-hover:text-foreground/80 transition-colors"}`} />
                                    <span className="whitespace-nowrap">{item.title}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto p-4 mb-2 space-y-2">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 px-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
                            onClick={async () => {
                                await logout();
                                router.push('/');
                                router.refresh();
                            }}
                        >
                            <LogOut className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">Logout</span>
                        </Button>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <header className="flex h-14 items-center gap-4 border-border border-border bg-card px-6 lg:h-[60px]">
                        <div className="flex flex-1 items-center justify-between">
                            <h1 className="text-lg font-semibold text-foreground">
                                {pathname === "/dashboard" ? "Master Overview" : activeConfig.items.find((item: any) => item.href === pathname)?.title || activeConfig.label}
                            </h1>

                            {currentContext === "master" && (
                                <div className="flex items-center gap-2">
                                    {/* Vapi Balance Button */}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-3 border-borderlue-200 bg-blue-50/30 hover:bg-blue-50 text-blue-700 gap-2 flex items-center shadow-sm"
                                        onClick={() => setWalletModal({ isOpen: true, type: 'vapi' })}
                                    >
                                        <Mic className="h-3.5 w-3.5" />
                                        <div className="flex flex-col items-start leading-[1.1]">
                                            <span className="text-[9px] font-bold uppercase opacity-70">Vapi Used</span>
                                            <span className="text-xs font-bold">
                                                {loadingCalls ? "..." : `$${vapiAgentUsed.toFixed(2)}`}
                                            </span>
                                        </div>
                                    </Button>


                                    {/* Twilio Button */}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-3 border-rose-200 bg-rose-50/30 hover:bg-rose-50 text-rose-700 gap-2 flex items-center shadow-sm"
                                        onClick={() => setWalletModal({ isOpen: true, type: 'twilio' })}
                                    >
                                        <Smartphone className="h-3.5 w-3.5" />
                                        <div className="flex flex-col items-start leading-[1.1]">
                                            <span className="text-[9px] font-bold uppercase opacity-70">Twilio</span>
                                            <span className="text-xs font-bold">
                                                {loadingBalances ? "..." : (twilioBalance?.balance !== undefined ? `$${twilioBalance.balance.toFixed(2)}` : "N/A")}
                                            </span>
                                        </div>
                                    </Button>


                                    {/* Maqsam Button */}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-3 border-slate-200 bg-slate-50/30 hover:bg-slate-50 text-slate-700 gap-2 flex items-center shadow-sm"
                                        onClick={() => setWalletModal({ isOpen: true, type: 'maqsam' })}
                                    >
                                        <Wallet className="h-3.5 w-3.5" />
                                        <div className="flex flex-col items-start leading-[1.1]">
                                            <span className="text-[9px] font-bold uppercase opacity-70">Maqsam Used</span>
                                            <span className="text-xs font-bold">
                                                {loadingCalls ? "..." : `$${maqsamUsedCost.toFixed(2)}`}
                                            </span>
                                        </div>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </header>

                    <WalletModal
                        isOpen={walletModal.isOpen}
                        type={walletModal.type}
                        details={(() => {
                            switch (walletModal.type) {
                                case 'vapi': return voiceBalance?.vapi;
                                case 'twilio': return twilioBalance;
                                case 'maqsam': return maqsamBalance;
                                default: return null;
                            }
                        })()}
                        calls={calls}
                        onClose={() => setWalletModal({ ...walletModal, isOpen: false })}
                    />

                    <main className="flex-1 overflow-auto bg-background p-6 relative">
                        {children}
                    </main>
                </div>
            </div>
        );
    })();

    return (
        <>{content}</>
    );
}
