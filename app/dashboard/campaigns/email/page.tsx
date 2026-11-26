"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search, ChevronLeft, ChevronRight, RefreshCw, Mail, Send, Reply, UserMinus, AlertCircle, X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SPLoader } from "@/components/sp-loader";
import { CampaignBadge, campaignColorClasses } from "@/components/dashboard/campaign-badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignDateRange } from "@/context/CampaignDateContext";
import {
    campaignColor,
    type OutreachLead, type OutreachLeadListItem, type ChannelStats,
} from "@/lib/services/campaigns";

function statusBadgeClass(status: string | null | undefined) {
    const s = (status || '').toLowerCase();
    if (s.includes('unsubscribed') || s.includes('not_interested')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('bounced')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('synced') || s.includes('sent')) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

const LEADS_PER_PAGE = 15;

export default function CampaignEmailPage() {
    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();
    const [leads, setLeads] = useState<OutreachLeadListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [stats, setStats] = useState<ChannelStats | null>(null);
    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const searchQuery = useDebouncedValue(searchInput, 350);
    const [currentPage, setCurrentPage] = useState(1);
    const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('pageSize', String(LEADS_PER_PAGE));
            params.set('channel', 'email');
            if (searchQuery) params.set('search', searchQuery);
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            campaignFilter.forEach(id => params.append('campaignId', id));
            statusFilter.forEach(s => params.append('status', s));

            const res = await fetch(`/api/campaigns/leads?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setLeads(json.data || []);
            setTotalCount(json.totalCount || 0);
        } catch (err) {
            console.error("Failed to fetch campaign email data:", err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, campaignFilter, statusFilter, fromIso, toIso]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        const params = new URLSearchParams({ channel: 'email' });
        if (fromIso) params.set('from', fromIso);
        if (toIso) params.set('to', toIso);
        fetch(`/api/campaigns/channel-stats?${params.toString()}`).then(r => r.json()).then(json => {
            setStats(json.stats || null);
            setCampaignOptions(json.campaignOptions || []);
        }).catch(err => console.error("Failed to fetch email channel stats:", err));
    }, [fromIso, toIso]);

    const toggleCampaignFilter = (value: string) => {
        setCampaignFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };
    const toggleStatusFilter = (value: string) => {
        setStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const hasActiveFilters = campaignFilter.length > 0 || statusFilter.length > 0 || !!searchInput;
    const resetFilters = () => { setCampaignFilter([]); setStatusFilter([]); setSearchInput(""); };

    useEffect(() => { setCurrentPage(1); }, [searchQuery, campaignFilter, statusFilter, fromIso, toIso]);

    const totalPages = Math.ceil(totalCount / LEADS_PER_PAGE) || 1;

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`h-full flex flex-col p-4 space-y-3 relative ${loading ? 'h-[calc(100vh-6rem)] overflow-hidden' : 'overflow-hidden min-h-[400px]'}`}>
            {loading && <SPLoader />}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Campaign Emails</h1>
                    <p className="text-slate-500 text-xs">Email sequence activity across all campaigns</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker value={dateRange} onUpdate={({ range, label }) => setDateRange(range, label)} />
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchLeads}>
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
                <StatBox label="Enrolled" value={stats?.enrolled ?? 0} icon={Mail} color="indigo" />
                <StatBox label="Sent" value={stats?.emailSent ?? 0} icon={Send} color="blue" />
                <StatBox label="Replied" value={stats?.emailReplied ?? 0} icon={Reply} color="cyan" />
                <StatBox label="Unsubscribed" value={stats?.unsubscribed ?? 0} icon={UserMinus} color="rose" />
                <StatBox label="Bounced" value={stats?.bounced ?? 0} icon={AlertCircle} color="amber" />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search by name, email, company..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${campaignFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            {campaignFilter.length > 0 ? `Campaign (${campaignFilter.length})` : 'Campaign'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        {campaignOptions.map(opt => (
                            <DropdownMenuItem key={opt.id} onClick={() => toggleCampaignFilter(opt.id)}>
                                {opt.name} {campaignFilter.includes(opt.id) && "✓"}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${statusFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            {statusFilter.length > 0 ? `Status (${statusFilter.length})` : 'Status'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        {['Sent', 'Not Sent', 'Replied', 'Unsubscribed', 'Bounced'].map(opt => (
                            <DropdownMenuItem key={opt} onClick={() => toggleStatusFilter(opt)}>
                                {opt} {statusFilter.includes(opt) && "✓"}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                        <X className="h-3 w-3" /> Reset
                    </Button>
                )}
            </div>

            <Card className="border-border overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase sticky top-0 z-10">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5">Campaign</th>
                                    <th className="px-3 py-2.5">Full Name</th>
                                    <th className="px-3 py-2.5">Email</th>
                                    <th className="px-3 py-2.5 text-center">Sequence Progress</th>
                                    <th className="px-3 py-2.5">Last Subject</th>
                                    <th className="px-3 py-2.5 text-center">Replied</th>
                                    <th className="px-3 py-2.5 text-center">Unsubscribed</th>
                                    <th className="px-3 py-2.5 text-center">Bounced</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {!loading && leads.length === 0 ? (
                                    <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    leads.map((lead) => {
                                        const color = campaignColor(lead.campaignId);
                                        return (
                                            <tr
                                                key={lead.id}
                                                className={`transition-colors cursor-pointer hover:brightness-95 ${campaignColorClasses(color).split(' ')[0]}`}
                                                onClick={() => setSelectedLeadId(lead.id)}
                                            >
                                                <td className="px-3 py-2"><CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} /></td>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{lead.fullName}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.email || "—"}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(lead.emailSentCount / 10) * 100}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-600">{lead.emailSentCount}/10</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[220px] truncate">{lead.lastEmailSubject || "—"}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.emailReplied ? <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 border-none text-[9px] font-bold">YES ({lead.emailReplyCount})</Badge> : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.unsubscribed ? <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none text-[9px] font-bold">YES</Badge> : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.bounced ? <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[9px] font-bold">YES</Badge> : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-slate-50/50 flex items-center justify-between shrink-0">
                        <p className="text-[11px] text-slate-500"><span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> leads</p>
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

            <Dialog open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6">
                    <DialogHeader className="sr-only"><DialogTitle>Email Detail</DialogTitle></DialogHeader>
                    {selectedLeadId && <EmailDetail leadId={selectedLeadId} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function sanitizeEmailHtml(html: string): string {
    if (!html) return "";
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"')
        .replace(/<a\b([^>]*?)>/gi, '<a $1 target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">');
}

function EmailDetail({ leadId }: { leadId: string }) {
    const [lead, setLead] = useState<OutreachLead | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/campaigns/leads/${leadId}`)
            .then(r => r.json())
            .then(json => { if (!cancelled) setLead(json.data || null); })
            .catch(err => console.error("Failed to fetch lead detail:", err))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [leadId]);

    if (loading || !lead) {
        return <div className="py-16 text-center text-sm text-slate-400">Loading lead…</div>;
    }

    const visibleSteps = Array.from({ length: Math.max(lead.emailStepStatuses.length, lead.emailSteps.length) }, (_, idx) => ({
        idx,
        step: lead.emailStepStatuses[idx] || null,
        body: lead.emailSteps[idx] || null,
    })).filter(s => Boolean(s.step || (s.body && s.body.trim())));

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between pr-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{lead.fullName}</h2>
                    <p className="text-sm text-slate-500">{lead.email}</p>
                </div>
                <CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} />
            </div>

            {lead.emailReplies.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Replies ({lead.emailReplies.length})</h3>
                    <div className="space-y-2">
                        {lead.emailReplies.map((r, idx) => (
                            <div key={idx} className="rounded-lg border border-cyan-200/80 bg-cyan-50/40 p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-900">{r.from_name || r.from_email}</span>
                                    <span className="text-[10px] text-slate-400">{r.received_at ? new Date(r.received_at).toLocaleString() : ""}</span>
                                </div>
                                {r.classification && <Badge variant="outline" className="text-[9px] uppercase font-bold mb-1.5 bg-white">{r.classification.replace(/_/g, ' ')}</Badge>}
                                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">
                    Sequence Steps {visibleSteps.length > 0 ? `(${visibleSteps.length})` : ""}
                </h3>
                <div className="space-y-3">
                    {visibleSteps.map(({ idx, step, body }) => (
                        <div key={idx} className="rounded-lg bg-slate-50/80 border border-border overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2.5 bg-white border-b border-border">
                                <div className="min-w-0">
                                    <span className="font-bold text-slate-800 block truncate">
                                        Step {idx + 1}: {step?.subject || "Outreach Email"}
                                    </span>
                                    {step?.sender && (
                                        <span className="text-[10px] text-slate-400">From: {step.sender}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {step?.status && (
                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold ${statusBadgeClass(step.status)}`}>
                                            {step.status}
                                        </Badge>
                                    )}
                                    <span className="text-[11px] text-slate-400">
                                        {step?.sent_at ? new Date(step.sent_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}
                                    </span>
                                </div>
                            </div>
                            {body && body.trim() && (
                                <div className="p-3 text-xs text-slate-700 leading-relaxed bg-slate-50/50">
                                    {body.includes("<") ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(body) }}
                                            className="space-y-1.5 [&_div]:min-h-[0.75rem]"
                                        />
                                    ) : (
                                        <p className="whitespace-pre-wrap">{body}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {visibleSteps.length === 0 && (
                        <p className="text-xs text-slate-400">
                            {lead.emailReplies.length > 0
                                ? "Reply recorded above; outbound sequence step details were not synced for this historical lead."
                                : "No email steps sent yet."}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        blue: 'bg-blue-50 text-blue-600',
        cyan: 'bg-cyan-50 text-cyan-600',
        rose: 'bg-rose-50 text-rose-600',
        amber: 'bg-amber-50 text-amber-600',
    };
    return (
        <Card className="border-border bg-white shadow-sm">
            <CardContent className="p-3 flex items-center justify-between">
                <div>
                    <p className="text-lg font-bold text-slate-900">{value.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                </div>
                <div className={`p-2 rounded-lg ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
            </CardContent>
        </Card>
    );
}
