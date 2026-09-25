"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search, ChevronLeft, ChevronRight, RefreshCw, ExternalLink,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SPLoader } from "@/components/sp-loader";
import { LINKEDIN_ACCOUNTS, getAccountMeta, type LinkedInLead } from "@/lib/services/linkedin-sheets";
import { LinkedInAccountBadge } from "@/components/dashboard/linkedin-account-badge";

const STATUS_STYLES: Record<string, string> = {
    connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    default: "bg-slate-100 text-slate-600 border-slate-200",
};

function statusStyle(status: string) {
    const key = status.trim().toLowerCase();
    return STATUS_STYLES[key] || STATUS_STYLES.default;
}

/** A lead counts as "accepted / connected" only when both Status and Connection Status are filled in. */
function isAcceptedConnection(lead: LinkedInLead) {
    return !!lead.status.trim() && !!lead.connectionStatus.trim();
}

export default function LinkedInLeadsPage() {
    const [leads, setLeads] = useState<LinkedInLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 15;
    const [connectionFilter, setConnectionFilter] = useState<string[]>([]);
    const [accountFilter, setAccountFilter] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/linkedin/leads");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setLeads(json.data || []);
        } catch (err) {
            console.error("Failed to fetch LinkedIn leads:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const connectionStatusOptions = useMemo(() => {
        const set = new Set<string>();
        leads.forEach(l => { if (l.connectionStatus) set.add(l.connectionStatus.trim()); });
        return Array.from(set);
    }, [leads]);

    const toggleConnectionFilter = (value: string) => {
        setConnectionFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const toggleAccountFilter = (value: string) => {
        setAccountFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const hasActiveFilters = connectionFilter.length > 0 || accountFilter.length > 0 || !!searchQuery;

    const resetFilters = () => {
        setConnectionFilter([]);
        setAccountFilter([]);
        setSearchQuery("");
    };

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const q = searchQuery.toLowerCase();
            if (q) {
                const haystack = `${lead.companyName} ${lead.email} ${lead.title} ${lead.city} ${lead.country}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (connectionFilter.length > 0 && !connectionFilter.includes(lead.connectionStatus.trim())) return false;
            if (accountFilter.length > 0 && !accountFilter.includes(lead.accountId.trim())) return false;
            return true;
        });
    }, [leads, searchQuery, connectionFilter, accountFilter]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, connectionFilter, accountFilter]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage) || 1;
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    if (loading) return <SPLoader />;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">LinkedIn Leads</h1>
                    <p className="text-slate-500 text-xs">Synced from the &quot;Leads&quot; Google Sheet</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 border border-emerald-300" /> Accepted / Connected</span>
                        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-200 border border-rose-300" /> No Status / Not Connected</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchData}>
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search by company, email, title, location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${accountFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            {accountFilter.length > 0 ? `Account (${accountFilter.length})` : 'Account'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        {LINKEDIN_ACCOUNTS.map(acc => (
                            <DropdownMenuItem key={acc.accountId} onClick={() => toggleAccountFilter(acc.accountId)}>
                                {acc.name} {accountFilter.includes(acc.accountId) && "✓"}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${connectionFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            {connectionFilter.length > 0 ? `Connection (${connectionFilter.length})` : 'Connection Status'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {connectionStatusOptions.length === 0 ? (
                            <DropdownMenuItem disabled>No values found</DropdownMenuItem>
                        ) : connectionStatusOptions.map(opt => (
                            <DropdownMenuItem key={opt} onClick={() => toggleConnectionFilter(opt)}>
                                {opt} {connectionFilter.includes(opt) && "✓"}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                        Reset
                    </Button>
                )}
            </div>

            <Card className="border-border overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase sticky top-0 z-10">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5">Account</th>
                                    <th className="px-3 py-2.5">Company Name</th>
                                    <th className="px-3 py-2.5">Company Website</th>
                                    <th className="px-3 py-2.5">Email</th>
                                    <th className="px-3 py-2.5">LinkedIn</th>
                                    <th className="px-3 py-2.5">Title</th>
                                    <th className="px-3 py-2.5">City</th>
                                    <th className="px-3 py-2.5">State</th>
                                    <th className="px-3 py-2.5">Country</th>
                                    <th className="px-3 py-2.5">Person ID</th>
                                    <th className="px-3 py-2.5">Company Phone Number</th>
                                    <th className="px-3 py-2.5">Provider ID</th>
                                    <th className="px-3 py-2.5 text-center">Status</th>
                                    <th className="px-3 py-2.5 text-center">Connection Status</th>
                                    <th className="px-3 py-2.5 text-center">Sequence Step</th>
                                    <th className="px-3 py-2.5">Next Action Due</th>
                                    <th className="px-3 py-2.5">Last Action Sent At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLeads.length === 0 ? (
                                    <tr><td colSpan={17} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => {
                                    const accepted = isAcceptedConnection(lead);
                                    return (
                                        <tr
                                            key={`${lead.personId}-${index}`}
                                            className={`transition-colors ${accepted ? 'bg-emerald-50 hover:bg-emerald-100/70' : 'bg-rose-50 hover:bg-rose-100/70'}`}
                                        >
                                            <td className="px-3 py-2">
                                                <LinkedInAccountBadge accountId={lead.accountId} />
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{lead.companyName || "—"}</td>
                                            <td className="px-3 py-2 text-[11px]">
                                                {lead.companyWebsite ? (
                                                    <a href={lead.companyWebsite.startsWith('http') ? lead.companyWebsite : `https://${lead.companyWebsite}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-0.5 whitespace-nowrap">
                                                        {lead.companyWebsite} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                                    </a>
                                                ) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.email || "—"}</td>
                                            <td className="px-3 py-2">
                                                {lead.linkedIn ? (
                                                    <a
                                                        href={lead.linkedIn.startsWith('http') ? lead.linkedIn : `https://${lead.linkedIn}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5 whitespace-nowrap"
                                                    >
                                                        Profile <ExternalLink className="h-2.5 w-2.5" />
                                                    </a>
                                                ) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{lead.title || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{lead.city || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{lead.state || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{lead.country || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">{lead.personId || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.companyPhoneNumber || "—"}</td>
                                            <td className="px-3 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">{lead.providerId || "—"}</td>
                                            <td className="px-3 py-2 text-center">
                                                {lead.status ? (
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap ${statusStyle(lead.status)}`}>
                                                        {lead.status}
                                                    </Badge>
                                                ) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {lead.connectionStatus ? (
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap ${statusStyle(lead.connectionStatus)}`}>
                                                        {lead.connectionStatus}
                                                    </Badge>
                                                ) : "—"}
                                            </td>
                                            <td className="px-3 py-2 text-center font-bold text-slate-700 text-xs whitespace-nowrap">{lead.sequenceStep || "—"}</td>
                                            <td className="px-3 py-2 text-slate-400 text-[11px] whitespace-nowrap">{lead.nextActionDue || "—"}</td>
                                            <td className="px-3 py-2 text-slate-400 text-[11px] whitespace-nowrap">{lead.lastActionSentAt || "—"}</td>
                                        </tr>
                                    );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-slate-50/50 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">{filteredLeads.length}</span> leads
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-7 w-7 p-0"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                                <span className="text-[11px] font-bold text-slate-600 px-2">{currentPage}/{totalPages}</span>
                                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-7 w-7 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
