"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Send,
    BarChart3,
    ArrowLeft,
    MessageSquare,
    Mail,
    Mic,
    ChevronDown,
    MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const whatsappSidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard/whatsapp",
        icon: LayoutDashboard,
    },
    {
        title: "Chat",
        href: "/dashboard/whatsapp/chat",
        icon: MessageSquare,
    },
    {
        title: "Lead",
        href: "/dashboard/whatsapp/leads",
        icon: Users,
    },

    {
        title: "Analytics",
        href: "/dashboard/whatsapp/analytics",
        icon: BarChart3,
    },
];

export default function WhatsappLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // If it's the specific chat page, make it a standalone view without the sidebar
    const isSpecificChat = pathname.startsWith("/dashboard/whatsapp/chat/") && pathname !== "/dashboard/whatsapp/chat";
    if (isSpecificChat) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
                <main className="w-full max-w-5xl h-[90vh] bg-card rounded-2xl shadow-xl overflow-hidden border border-border p-2 sm:p-6 flex flex-col relative">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
            {/* WhatsApp Sidebar */}
            <aside className="w-64 flex-col bg-[#0B0F19] border-r border-border hidden md:flex font-sans">
                {/* Logo Section */}
                <div className="p-6 pb-4 flex justify-center items-center gap-3">
                    <div className="relative w-10 h-10 flex-shrink-0">
                        <Image
                            src="/SP_logo.png"
                            alt="ScalePods Logo"
                            fill
                            className="object-contain drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            priority
                        />
                    </div>
                    <span className="text-xl font-black tracking-tight text-foreground uppercase">ScalePods</span>
                </div>

                <div className="px-4 pb-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full justify-between bg-transparent border-border text-slate-300 hover:bg-slate-900 hover:text-white h-10 shadow-sm"
                            >
                                <span className="flex items-center gap-2">
                                    <LayoutDashboard className="h-4 w-4 text-green-600" />
                                    <span>Switch Dashboard</span>
                                </span>
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[220px]" side="top">
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard" className="cursor-pointer w-full flex items-center">
                                    <LayoutDashboard className="mr-2 h-4 w-4" /> Master Overview
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/email" className="cursor-pointer w-full flex items-center">
                                    <Mail className="mr-2 h-4 w-4" /> Email Marketing
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/whatsapp" className="cursor-pointer w-full flex items-center">
                                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp CRM
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/dashboard/voice" className="cursor-pointer w-full flex items-center">
                                    <Mic className="mr-2 h-4 w-4" /> Voice Agent
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="px-4 py-2">
                    <div className="h-[1px] w-full bg-accent"></div>
                </div>

                <nav className="flex-1 overflow-auto px-4 space-y-2">
                    {whatsappSidebarItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                    ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-md shadow-green-500/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                    }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-muted-foreground/80 group-hover:text-foreground/80 transition-colors"}`} />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 mb-4">
                    {/* Switcher moved to top */}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto bg-background p-6">
                {children}
            </main>
        </div>
    );
}
