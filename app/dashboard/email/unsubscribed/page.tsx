"use client";

import { SPLoader } from "@/components/sp-loader";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    RefreshCw,
    UserMinus,
    AlertCircle,
    Info,
    ChevronUp,
    ChevronDown,
    ArrowUp,
    Search,
    ChevronLeft,
    ChevronRight,
    Mail
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays } from "date-fns";


import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnsubscribedLead {
    email: string;
    type: string;
    from: string;
    date: string;
    name?: string | null;
}

export default function UnsubscribedPage() {
    const { leads: allLeads, loadingLeads, refreshLeads } = useData();
    const [unsubscribed, setUnsubscribed] = useState<UnsubscribedLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 30), // Default to 30 days for unsubscribes
        to: new Date(),
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchUnsubscribed = async () => {
        setLoading(true);
        try {
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(dateRange.to || dateRange.from);
            to.setHours(23, 59, 59, 999);
            await refreshLeads(from, to);
        } catch (e: any) {
            console.error("Unsubscribed fetch error", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (loadingLeads) return;

        const filtered = allLeads.filter((lead: any) => 
            lead._table === 'icp_tracker' && 
            lead.email_unsubscribed && 
            String(lead.email_unsubscribed).toLowerCase() === 'yes'
        );

        const mapped = filtered.map((l: any) => ({
            email: l.email || "No Email",
            type: "Unsubscribed",
            from: l.sender_email || "Campaign",
            date: l["Email Last Contacted"] || l.updated_at || l.created_at || "N/A",
            name: (l.name && l.name !== "Unknown Lead") ? l.name : null
        }));

        setUnsubscribed(mapped);
        setLoading(false);
    }, [allLeads, loadingLeads]);


    // Filter
    const filteredResults = unsubscribed.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()));

        if (!matchesSearch) return false;

        // Local date filtering as secondary check
        if (dateRange?.from) {
            if (!u.date || u.date === "N/A") return false;
            const uDate = new Date(u.date);
            const from = new Date(dateRange.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(dateRange.to || dateRange.from);
            to.setHours(23, 59, 59, 999);
            if (uDate < from || uDate > to) return false;
        }

        return true;
    });

    const paginatedResults = filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateRange]);


    return (
        <TooltipProvider>
            <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
                {loading && <SPLoader />}
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <UserMinus className="h-6 w-6 text-rose-600" />
                            Unsubscribed Emails
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Users who opted out from ICP Tracker campaigns</p>

                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <DateRangePicker onUpdate={(values) => {
                            setDateRange(values.range);
                            if (values.range?.from) {
                                const from = new Date(values.range.from);
                                from.setHours(0, 0, 0, 0);
                                const to = new Date(values.range.to || values.range.from);
                                to.setHours(23, 59, 59, 999);
                                refreshLeads(from, to);
                            }
                        }} />
                        <Button
                            onClick={fetchUnsubscribed}
                            variant="outline"
                            className="gap-2 h-10 px-4 hover:bg-slate-50 transition-colors"
                            disabled={loading}
                        >
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                            {loading ? "Refreshing..." : "Refresh List"}
                        </Button>
                    </div>

                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Unsubscribed" value={filteredResults.length.toString()} />
                    <StatCard
                        title="Recent (30d)"
                        value={unsubscribed.length.toString()}
                        color="text-amber-600"
                        tooltip="Total records found in the system for this criteria."
                    />
                </div>

                {/* Search */}
                <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            className="pl-10"
                            placeholder="Search by recipient email or sender..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="space-y-4">
                    {!loading && paginatedResults.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                            <p className="text-slate-500">No unsubscribed leads found.</p>
                        </div>
                    ) : (
                        paginatedResults.map((lead, index) => (
                            <UnsubscribeCard key={index} lead={lead} />
                        ))
                    )}
                </div>

                {/* Pagination */}
                {filteredResults.length > itemsPerPage && (
                    <div className="flex items-center justify-between bg-white px-4 py-4 rounded-xl border border-border shadow-sm">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredResults.length)}</span> of {filteredResults.length} records
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium px-3 py-1 bg-slate-50 rounded-md border border-border">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </TooltipProvider>
    );
}

function StatCard({ title, value, color, tooltip }: any) {
    return (
        <Card className="border-border shadow-sm bg-white">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
                    {tooltip && (
                        <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                                <span className="cursor-pointer">
                                    <Info className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-[200px] text-xs">{tooltip}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <span className={`text-2xl font-bold ${color || 'text-slate-900'}`}>{value}</span>
            </CardContent>
        </Card>
    );
}

function UnsubscribeCard({ lead }: { lead: UnsubscribedLead }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-white border border-border rounded-xl shadow-sm transition-all hover:shadow-md">
            <CollapsibleTrigger asChild>
                <div className="p-4 flex items-center gap-4 cursor-pointer group">
                    <div className="h-10 w-10 shrink-0 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100">
                        <UserMinus className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4">
                            <h4 className="font-bold text-slate-900 truncate">{lead.name || lead.email}</h4>
                            <p className="text-xs text-slate-500 truncate">{lead.name ? lead.email : 'Opt-out Recipient'}</p>
                            {lead.from && lead.from !== "Campaign" && (
                                <p className="text-[10px] text-slate-400 truncate">Sender: {lead.from}</p>
                            )}
                        </div>


                        <div className="md:col-span-3">
                            <Badge variant="outline" className={`font-bold bg-amber-50 text-amber-700 border-amber-200`}>
                                {lead.type}
                            </Badge>
                        </div>
                        <div className="md:col-span-5 text-right">
                            <span className="text-xs text-slate-400 font-medium">{lead.date}</span>
                        </div>
                    </div>

                    <div className="shrink-0 p-1 rounded-full text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600 transition-colors">
                        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-4 pb-4 pt-0 border-t border-border bg-slate-50/30 rounded-b-xl">
                    <div className="pt-4 flex justify-end">
                        <Button variant="ghost" className="text-slate-500 hover:text-slate-900 flex items-center gap-1">
                            View Details <ArrowUp className="h-3 w-3 rotate-45" />
                        </Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
