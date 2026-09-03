"use client";

import { SPLoader } from "@/components/sp-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Mail,
    Search,
    ChevronLeft,
    ChevronRight,
    Snowflake,
    Flame,
} from "lucide-react";
import { useState, useEffect } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { NormalizedLeadRow, LeadType } from "@/lib/services/email-outreach";

interface BounceEntry {
    email: string;
    name: string | null;
    leadType: LeadType;
    date: string;
}

export default function BouncedEmailsPage() {
    const [coldLeads, setColdLeads] = useState<NormalizedLeadRow[]>([]);
    const [hotLeads, setHotLeads] = useState<NormalizedLeadRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<"all" | LeadType>("all");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchData = async (range?: { from: Date; to?: Date }) => {
        setLoading(true);
        try {
            const r = range || dateRange;
            const from = new Date(r.from);
            from.setHours(0, 0, 0, 0);
            const to = r.to ? new Date(r.to) : new Date(from);
            to.setHours(23, 59, 59, 999);

            const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
            const res = await fetch(`/api/email/outreach?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setColdLeads(json.cold?.leads || []);
            setHotLeads(json.hot?.leads || []);
        } catch (e) {
            console.error("Bounces fetch error", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const bounces: BounceEntry[] = [...coldLeads, ...hotLeads]
        .filter(l => l.bounced)
        .map(l => ({
            email: l.email,
            name: l.fullName !== "Unknown Lead" ? l.fullName : null,
            leadType: l.leadType,
            date: l.lastContacted || l.createdAt || "N/A",
        }));

    const filteredBounces = bounces.filter(b => {
        if (filterType !== "all" && b.leadType !== filterType) return false;

        const matchesSearch = b.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.name && b.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;

        // Date range is applied server-side (fetchData passes from/to to
        // the API), so coldLeads/hotLeads are already scoped.

        return true;
    });

    const paginatedBounces = filteredBounces.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredBounces.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateRange, filterType]);

    const coldCount = bounces.filter(b => b.leadType === 'cold').length;
    const hotCount = bounces.filter(b => b.leadType === 'hot').length;

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            {loading && <SPLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bounced Emails</h1>
                    <p className="text-sm text-slate-500 mt-1">email_bounced across ENRICHED_LEADS, master_cold_leads & hubspot_lead</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <DateRangePicker onUpdate={(values) => {
                        if (!values.range?.from) return;
                        setDateRange(values.range);
                        fetchData(values.range as { from: Date; to?: Date });
                    }} />
                    <Button onClick={() => fetchData()} variant="outline" className="gap-2 h-10 px-4 hover:bg-slate-50 transition-colors" disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        {loading ? "Refreshing..." : "Refresh List"}
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Total Bounces" value={bounces.length.toString()} />
                <StatCard title="Cold Bounces" value={coldCount.toString()} color="text-blue-600" />
                <StatCard title="Hot Bounces" value={hotCount.toString()} color="text-orange-600" />
            </div>

            {/* Search + type filter */}
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-10"
                        placeholder="Search by recipient email or name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                    <button onClick={() => setFilterType('all')} className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/50')}>All</button>
                    <button onClick={() => setFilterType('cold')} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'cold' ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100/50')}><Snowflake className="h-3 w-3" /> Cold</button>
                    <button onClick={() => setFilterType('hot')} className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all", filterType === 'hot' ? 'bg-orange-500 text-white' : 'text-orange-600 hover:bg-orange-100/50')}><Flame className="h-3 w-3" /> Hot</button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {!loading && paginatedBounces.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                        <p className="text-slate-500">No bounces found.</p>
                    </div>
                ) : (
                    paginatedBounces.map((bounce, index) => <BounceCard key={index} bounce={bounce} />)
                )}
            </div>

            {/* Pagination */}
            {filteredBounces.length > itemsPerPage && (
                <div className="flex items-center justify-between bg-white px-4 py-4 rounded-xl border border-border shadow-sm">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredBounces.length)}</span> of {filteredBounces.length} bounces
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-3 py-1 bg-slate-50 rounded-md border border-border">Page {currentPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatDate(raw: string): string {
    if (!raw || raw === "N/A") return "N/A";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return format(d, "MMM dd, yyyy • p");
}

function StatCard({ title, value, color }: { title: string; value: string; color?: string }) {
    return (
        <Card className="border-border shadow-sm bg-white">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</span>
                <span className={`text-2xl font-bold ${color || 'text-slate-900'}`}>{value}</span>
            </CardContent>
        </Card>
    );
}

function BounceCard({ bounce }: { bounce: BounceEntry }) {
    return (
        <div className="bg-white border border-border rounded-xl shadow-sm hover:shadow-md transition-all p-4 flex items-center gap-4">
            <div className="h-10 w-10 shrink-0 bg-red-50 text-red-600 rounded-lg flex items-center justify-center border border-red-100">
                <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5">
                    <h4 className="font-bold text-slate-900 truncate">{bounce.name || bounce.email}</h4>
                    <p className="text-xs text-slate-500 truncate">{bounce.name ? bounce.email : 'Bounced Recipient'}</p>
                </div>
                <div className="md:col-span-3">
                    <Badge
                        variant="outline"
                        className={cn(
                            "font-bold gap-1",
                            bounce.leadType === 'cold' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"
                        )}
                    >
                        {bounce.leadType === 'cold' ? <Snowflake className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                        {bounce.leadType === 'cold' ? 'Cold' : 'Hot'}
                    </Badge>
                </div>
                <div className="md:col-span-4 text-right">
                    <span className="text-xs text-slate-400 font-medium">{formatDate(bounce.date)}</span>
                </div>
            </div>
        </div>
    );
}
