"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search, ChevronLeft, ChevronRight, RefreshCw, Mail, Send, Reply, UserMinus, AlertCircle, X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
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
    type OutreachLead,
} from "@/lib/services/campaigns";

function statusBadgeClass(status: string | null | undefined) {
    const s = (status || '').toLowerCase();
    if (s.includes('unsubscribed') || s.includes('not_interested')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('bounced')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('synced') || s.includes('sent')) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
}

export default function CampaignEmailPage() {
    const [leads, setLeads] = useState<OutreachLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 15;
    const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/campaigns/leads");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setLeads(json.data || []);
        } catch (err) {
            console.error("Failed to fetch campaign email data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Email channel scope: leads enrolled in email outreach
    const emailLeads = useMemo(() => leads.filter(l => l.outreachChannels.includes('email')), [leads]);

    const stats = useMemo(() => {
        const sent = emailLeads.filter(l => countEmailStepsSent(l) > 0).length;
        const replied = emailLeads.filter(hasEmailReply).length;
        const unsubscribed = emailLeads.filter(l => l.unsubscribed).length;
        const bounced = emailLeads.filter(l => l.bounced).length;
        return { sent, replied, unsubscribed, bounced, total: emailLeads.length };
    }, [emailLeads]);

    const campaignOptions = useMemo(() => {
        const map = new Map<string, string>();
        emailLeads.forEach(l => {
            const key = String(l.campaignId ?? 'unknown');
            if (!map.has(key)) map.set(key, l.campaignName || `Campaign ${key}`);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [emailLeads]);

    const toggleCampaignFilter = (value: string) => {
        setCampaignFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };
    const toggleStatusFilter = (value: string) => {
        setStatusFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const hasActiveFilters = campaignFilter.length > 0 || statusFilter.length > 0 || !!searchQuery;
    const resetFilters = () => { setCampaignFilter([]); setStatusFilter([]); setSearchQuery(""); };

    const filteredLeads = useMemo(() => {
        return emailLeads.filter(lead => {
            const q = searchQuery.toLowerCase();
            if (q) {
                const haystack = `${lead.fullName} ${lead.email} ${lead.companyName}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (campaignFilter.length > 0 && !campaignFilter.includes(String(lead.campaignId ?? 'unknown'))) return false;
            if (statusFilter.length > 0) {
                const sentCount = countEmailStepsSent(lead);
                const replied = hasEmailReply(lead);
                const matches =
                    (statusFilter.includes('Sent') && sentCount > 0) ||
                    (statusFilter.includes('Replied') && replied) ||
                    (statusFilter.includes('Unsubscribed') && lead.unsubscribed) ||
                    (statusFilter.includes('Bounced') && lead.bounced) ||
                    (statusFilter.includes('Not Sent') && sentCount === 0);
                if (!matches) return false;
            }
            return true;
        }).sort((a, b) => countEmailStepsSent(b) - countEmailStepsSent(a));
    }, [emailLeads, searchQuery, campaignFilter, statusFilter]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, campaignFilter, statusFilter]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage) || 1;
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    if (loading) return <SPLoader />;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Campaign Emails</h1>
                    <p className="text-slate-500 text-xs">Email sequence activity across all campaigns, from &quot;outreach_leads&quot;</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchData}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
                <StatBox label="Enrolled" value={stats.total} icon={Mail} color="indigo" />
                <StatBox label="Sent" value={stats.sent} icon={Send} color="blue" />
                <StatBox label="Replied" value={stats.replied} icon={Reply} color="cyan" />
                <StatBox label="Unsubscribed" value={stats.unsubscribed} icon={UserMinus} color="rose" />
                <StatBox label="Bounced" value={stats.bounced} icon={AlertCircle} color="amber" />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search by name, email, company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
                                {filteredLeads.length === 0 ? (
                                    <tr><td colSpan={8} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    paginatedLeads.map((lead) => {
                                        const color = campaignColor(lead.campaignId);
                                        const sentCount = countEmailStepsSent(lead);
                                        const replied = hasEmailReply(lead);
                                        const latest = latestEmailStatus(lead);
                                        return (
                                            <tr
                                                key={lead.id}
                                                className={`transition-colors cursor-pointer hover:brightness-95 ${campaignColorClasses(color).split(' ')[0]}`}
                                                onClick={() => setSelectedLead(lead)}
                                            >
                                                <td className="px-3 py-2"><CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} /></td>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{lead.fullName}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.email || "—"}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(sentCount / 10) * 100}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-600">{sentCount}/10</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] max-w-[220px] truncate">{latest?.subject || "—"}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {replied ? <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 border-none text-[9px] font-bold">YES ({lead.emailReplies.length})</Badge> : <span className="text-slate-300 text-[10px]">—</span>}
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
                        <p className="text-[11px] text-slate-500"><span className="font-bold text-slate-900">{filteredLeads.length}</span> leads</p>
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

            <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6">
                    <DialogHeader className="sr-only"><DialogTitle>Email Detail</DialogTitle></DialogHeader>
                    {selectedLead && <EmailDetail lead={selectedLead} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmailDetail({ lead }: { lead: OutreachLead }) {
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
                            <div key={idx} className="rounded-lg border border-border bg-slate-50/60 p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-900">{r.from_name || r.from_email}</span>
                                    <span className="text-[10px] text-slate-400">{r.received_at ? new Date(r.received_at).toLocaleString() : ""}</span>
                                </div>
                                {r.classification && <Badge variant="outline" className="text-[9px] uppercase font-bold mb-1.5">{r.classification.replace(/_/g, ' ')}</Badge>}
                                <p className="text-xs text-slate-600 whitespace-pre-wrap">{r.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Sequence Steps</h3>
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
                    {countEmailStepsSent(lead) === 0 && <p className="text-xs text-slate-400">No email steps sent yet.</p>}
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
