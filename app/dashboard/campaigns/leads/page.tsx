"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search, ChevronLeft, ChevronRight, RefreshCw, Mail, MessageCircle, Mic, X,
    Send, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SPLoader } from "@/components/sp-loader";
import { CampaignBadge, campaignColorClasses } from "@/components/dashboard/campaign-badge";
import {
    countEmailStepsSent, hasEmailReply, latestEmailStatus, campaignColor,
    type OutreachLead, type OutreachLeadListItem,
} from "@/lib/services/campaigns";

function statusBadgeClass(status: string | null | undefined) {
    const s = (status || '').toLowerCase();
    if (s.includes('unsubscribed') || s.includes('not_interested')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('bounced')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('synced') || s.includes('sent')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s === 'contacted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
}

// Debounce a fast-changing value (search input) so we don't fire a request
// per keystroke.
function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

const LEADS_PER_PAGE = 15;

function LeadsPageInner() {
    const searchParams = useSearchParams();
    const [leads, setLeads] = useState<OutreachLeadListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const searchQuery = useDebouncedValue(searchInput, 350);
    const [currentPage, setCurrentPage] = useState(1);
    const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingToEnrichment, setSendingToEnrichment] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // All known campaigns for the filter dropdown — lightweight (comes from
    // the dashboard aggregate endpoint), so it doesn't need the leads list.
    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(currentPage));
            params.set('pageSize', String(LEADS_PER_PAGE));
            if (searchQuery) params.set('search', searchQuery);
            campaignFilter.forEach(id => params.append('campaignId', id));

            const res = await fetch(`/api/campaigns/leads?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setLeads(json.data || []);
            setTotalCount(json.totalCount || 0);
        } catch (err) {
            console.error("Failed to fetch campaign leads:", err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, campaignFilter]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    useEffect(() => {
        fetch('/api/campaigns/dashboard').then(r => r.json()).then(json => {
            setCampaignOptions((json.campaigns || []).map((c: any) => ({ id: String(c.campaignId), name: c.campaignName })));
        }).catch(err => console.error("Failed to fetch campaign options:", err));
    }, []);

    // Pre-select campaign from ?campaignId= query param (set by the Dashboard's campaign cards)
    useEffect(() => {
        const cid = searchParams.get('campaignId');
        if (cid) setCampaignFilter([cid]);
    }, [searchParams]);

    const toggleCampaignFilter = (value: string) => {
        setCampaignFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const hasActiveFilters = campaignFilter.length > 0 || !!searchInput;

    const resetFilters = () => {
        setCampaignFilter([]);
        setSearchInput("");
    };

    useEffect(() => { setCurrentPage(1); }, [searchQuery, campaignFilter]);

    // Clear selection only when the result set itself changes — not on page
    // change, so selections persist across pagination.
    useEffect(() => { setSelectedIds(new Set()); }, [searchQuery, campaignFilter]);

    useEffect(() => {
        if (toast.show) {
            const t = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
            return () => clearTimeout(t);
        }
    }, [toast.show]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const pageIds = leads.map(l => l.id);
        const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) pageIds.forEach(id => next.delete(id));
            else pageIds.forEach(id => next.add(id));
            return next;
        });
    };

    const handleSendToEnrichment = async () => {
        if (selectedIds.size === 0) return;
        setSendingToEnrichment(true);
        try {
            const res = await fetch('/api/campaigns/leads/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_ids: Array.from(selectedIds) }),
            });
            if (res.ok) {
                setToast({ show: true, message: `Successfully sent ${selectedIds.size} lead(s) to enrichment!`, type: 'success' });
                setSelectedIds(new Set());
            } else {
                const text = await res.text();
                setToast({ show: true, message: `Failed to send leads: ${res.status} ${text || res.statusText}`, type: 'error' });
            }
        } catch (err) {
            console.error("Failed to send leads to enrichment:", err);
            setToast({ show: true, message: 'Failed to send leads to enrichment.', type: 'error' });
        } finally {
            setSendingToEnrichment(false);
        }
    };

    const totalPages = Math.ceil(totalCount / LEADS_PER_PAGE) || 1;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3 relative min-h-[400px]">
            {loading && <SPLoader />}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Campaign Leads</h1>
                    <p className="text-slate-500 text-xs">Synced from the &quot;outreach_leads&quot; table — Email, WhatsApp &amp; Voice in one view</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchLeads}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search by name, email, company, location..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-8 gap-1.5 text-xs font-bold ${campaignFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
                            {campaignFilter.length > 0 ? `Campaign (${campaignFilter.length})` : 'Campaign'}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        {campaignOptions.length === 0 ? (
                            <DropdownMenuItem disabled>No campaigns found</DropdownMenuItem>
                        ) : campaignOptions.map(opt => (
                            <DropdownMenuItem key={opt.id} onClick={() => toggleCampaignFilter(opt.id)}>
                                {opt.name} {campaignFilter.includes(opt.id) && "✓"}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2">
                        <X className="h-3 w-3" /> Reset
                    </Button>
                )}

                {selectedIds.size > 0 && (
                    <Button
                        size="sm"
                        disabled={sendingToEnrichment}
                        onClick={handleSendToEnrichment}
                        className="h-8 gap-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                        {sendingToEnrichment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send to Enrichment ({selectedIds.size})
                    </Button>
                )}
            </div>

            <Card className="border-border overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
                <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                    <div className="overflow-auto flex-1 min-h-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase sticky top-0 z-10">
                                <tr className="border-b border-border">
                                    <th className="px-3 py-2.5 w-10">
                                        <Checkbox
                                            checked={leads.length > 0 && leads.every(l => selectedIds.has(l.id))}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-3 py-2.5">Campaign</th>
                                    <th className="px-3 py-2.5">Full Name</th>
                                    <th className="px-3 py-2.5">Email</th>
                                    <th className="px-3 py-2.5">LinkedIn</th>
                                    <th className="px-3 py-2.5">Lead Status</th>
                                    <th className="px-3 py-2.5 text-center"><Mail className="h-3 w-3 inline" /> Email</th>
                                    <th className="px-3 py-2.5 text-center"><MessageCircle className="h-3 w-3 inline" /> WhatsApp</th>
                                    <th className="px-3 py-2.5 text-center"><Mic className="h-3 w-3 inline" /> Voice</th>
                                    <th className="px-3 py-2.5 text-center">Unsubscribed</th>
                                    <th className="px-3 py-2.5 text-center">Bounced</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {!loading && leads.length === 0 ? (
                                    <tr><td colSpan={11} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    leads.map((lead) => {
                                        const color = campaignColor(lead.campaignId);
                                        return (
                                            <tr
                                                key={lead.id}
                                                className={`transition-colors cursor-pointer hover:brightness-95 ${campaignColorClasses(color).split(' ')[0]}`}
                                                onClick={() => setSelectedLeadId(lead.id)}
                                            >
                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedIds.has(lead.id)}
                                                        onCheckedChange={() => toggleSelect(lead.id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} />
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{lead.fullName}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.email || "—"}</td>
                                                <td className="px-3 py-2 text-[11px]">
                                                    {lead.linkedinUrl ? (
                                                        <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline">Profile</a>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {lead.leadStatus ? (
                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 whitespace-nowrap ${statusBadgeClass(lead.leadStatus)}`}>
                                                            {lead.leadStatus}
                                                        </Badge>
                                                    ) : "—"}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.emailSentCount > 0 ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <span className="font-bold text-blue-700 text-xs">{lead.emailSentCount}/10</span>
                                                            {lead.emailReplied && <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 border-none text-[9px] font-bold">REPLIED</Badge>}
                                                        </span>
                                                    ) : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.whatsappStatus ? (
                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${statusBadgeClass(lead.whatsappStatus)}`}>{lead.whatsappStatus}</Badge>
                                                    ) : <span className="text-slate-300 text-[10px]">—</span>}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.voiceStatus ? (
                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${statusBadgeClass(lead.voiceStatus)}`}>{lead.voiceStatus}</Badge>
                                                    ) : <span className="text-slate-300 text-[10px]">—</span>}
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
                        <p className="text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> leads
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

            <Dialog open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6">
                    <DialogHeader className="sr-only"><DialogTitle>Lead Detail</DialogTitle></DialogHeader>
                    {selectedLeadId && <LeadDetail leadId={selectedLeadId} />}
                </DialogContent>
            </Dialog>

            {toast.show && (
                <div className={`fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-3 ${
                    toast.type === 'success'
                        ? 'bg-emerald-900 border-emerald-700 text-emerald-100'
                        : 'bg-red-900 border-red-700 text-red-100'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                    {toast.message}
                    <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 hover:opacity-70">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

function LeadDetail({ leadId }: { leadId: string }) {
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

    const latestStatus = latestEmailStatus(lead);
    const sentCount = countEmailStepsSent(lead);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between pr-8">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{lead.fullName}</h2>
                    <p className="text-sm text-slate-500">{lead.designation ? `${lead.designation} @ ` : ""}{lead.companyName || "—"}</p>
                </div>
                <CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <DetailField label="Email" value={lead.email} />
                <DetailField label="Personal Email" value={lead.personalEmail} />
                <DetailField label="Mobile" value={lead.mobileNumber} />
                <DetailField label="Location" value={[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || null} />
                <DetailField label="Lead Status" value={lead.leadStatus} />
                <DetailField label="LinkedIn" value={lead.linkedinUrl} isLink />
            </div>

            <div className="grid grid-cols-3 gap-3">
                <ChannelStatusCard label="Email" icon={Mail} status={latestStatus?.status || (sentCount > 0 ? 'sent' : null)} detail={`${sentCount}/10 steps sent`} />
                <ChannelStatusCard label="WhatsApp" icon={MessageCircle} status={lead.whatsappStatus} detail={lead.outreachChannels.includes('whatsapp') ? 'Enabled' : 'Not enabled'} />
                <ChannelStatusCard label="Voice" icon={Mic} status={lead.voiceStatus} detail={lead.outreachChannels.includes('voice') ? 'Enabled' : 'Not enabled'} />
            </div>

            {lead.emailReplies.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Email Replies ({lead.emailReplies.length})</h3>
                    <div className="space-y-2">
                        {lead.emailReplies.map((r, idx) => (
                            <div key={idx} className="rounded-lg border border-border bg-slate-50/60 p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-900">{r.from_name || r.from_email}</span>
                                    <span className="text-[10px] text-slate-400">{r.received_at ? new Date(r.received_at).toLocaleString() : ""}</span>
                                </div>
                                {r.classification && (
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold mb-1.5">{r.classification.replace(/_/g, ' ')}</Badge>
                                )}
                                <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">{r.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Email Sequence</h3>
                <div className="space-y-1.5">
                    {lead.emailStepStatuses.map((step, idx) => {
                        if (!step) return null;
                        return (
                            <div key={idx} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-slate-50 border border-border">
                                <span className="font-bold text-slate-700">Step {idx + 1}: {step.subject || "—"}</span>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold ${statusBadgeClass(step.status)}`}>{step.status}</Badge>
                                    <span className="text-slate-400">{step.sent_at ? new Date(step.sent_at).toLocaleDateString() : ""}</span>
                                </div>
                            </div>
                        );
                    })}
                    {sentCount === 0 && <p className="text-xs text-slate-400">No email steps sent yet.</p>}
                </div>
            </div>
        </div>
    );
}

function DetailField({ label, value, isLink = false }: { label: string; value: string | null | undefined; isLink?: boolean }) {
    return (
        <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
            {value ? (
                isLink ? (
                    <a href={value} target="_blank" rel="noreferrer" className="block text-blue-600 hover:underline mt-0.5 text-sm truncate">{value}</a>
                ) : (
                    <p className="font-medium text-slate-900 mt-0.5 text-sm">{value}</p>
                )
            ) : (
                <p className="text-slate-300 mt-0.5 text-sm">—</p>
            )}
        </div>
    );
}

function ChannelStatusCard({ label, icon: Icon, status, detail }: { label: string; icon: any; status: string | null | undefined; detail: string }) {
    const active = !!status;
    return (
        <div className={`p-3 rounded-lg border ${active ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-slate-50'}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold text-slate-700">{label}</span>
            </div>
            <p className={`text-[11px] font-bold uppercase ${active ? 'text-emerald-700' : 'text-slate-400'}`}>{status || 'Not Started'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>
        </div>
    );
}

export default function CampaignLeadsPage() {
    return (
        <Suspense fallback={<SPLoader />}>
            <LeadsPageInner />
        </Suspense>
    );
}
