"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, RefreshCw, MessageCircle, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SPLoader } from "@/components/sp-loader";
import { CampaignBadge, campaignColorClasses } from "@/components/dashboard/campaign-badge";
import { campaignColor, type OutreachLead } from "@/lib/services/campaigns";

function statusBadgeClass(status: string | null | undefined) {
    const s = (status || '').toLowerCase();
    if (s.includes('unsubscribed') || s.includes('opt')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (s.includes('replied')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (s.includes('sent') || s.includes('delivered')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
}

export default function CampaignWhatsAppPage() {
    const [leads, setLeads] = useState<OutreachLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 15;
    const [campaignFilter, setCampaignFilter] = useState<string[]>([]);
    const [scope, setScope] = useState<'enrolled' | 'active'>('enrolled');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/campaigns/leads");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setLeads(json.data || []);
        } catch (err) {
            console.error("Failed to fetch campaign WhatsApp data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const waLeads = useMemo(() => leads.filter(l => l.outreachChannels.includes('whatsapp')), [leads]);

    const stats = useMemo(() => {
        const active = waLeads.filter(l => !!l.whatsappStatus).length;
        return { enrolled: waLeads.length, active, notStarted: waLeads.length - active };
    }, [waLeads]);

    const campaignOptions = useMemo(() => {
        const map = new Map<string, string>();
        waLeads.forEach(l => {
            const key = String(l.campaignId ?? 'unknown');
            if (!map.has(key)) map.set(key, l.campaignName || `Campaign ${key}`);
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [waLeads]);

    const toggleCampaignFilter = (value: string) => {
        setCampaignFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const hasActiveFilters = campaignFilter.length > 0 || !!searchQuery || scope === 'active';
    const resetFilters = () => { setCampaignFilter([]); setSearchQuery(""); setScope('enrolled'); };

    const filteredLeads = useMemo(() => {
        return waLeads.filter(lead => {
            const q = searchQuery.toLowerCase();
            if (q) {
                const haystack = `${lead.fullName} ${lead.mobileNumber} ${lead.companyName}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (campaignFilter.length > 0 && !campaignFilter.includes(String(lead.campaignId ?? 'unknown'))) return false;
            if (scope === 'active' && !lead.whatsappStatus) return false;
            return true;
        });
    }, [waLeads, searchQuery, campaignFilter, scope]);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, campaignFilter, scope]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage) || 1;
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    if (loading) return <SPLoader />;

    return (
        <div className="h-full flex flex-col overflow-hidden p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Campaign WhatsApp</h1>
                    <p className="text-slate-500 text-xs">WhatsApp channel activity across all campaigns, from &quot;outreach_leads&quot;</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={fetchData}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 shrink-0">
                <StatBox label="Enrolled" value={stats.enrolled} color="indigo" />
                <StatBox label="Active" value={stats.active} color="emerald" />
                <StatBox label="Not Started" value={stats.notStarted} color="slate" />
            </div>

            {stats.active === 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shrink-0">
                    No WhatsApp activity recorded yet — leads are enrolled (<span className="font-bold">{stats.enrolled}</span>) but <code className="font-mono">whatsapp_status</code> hasn&apos;t started populating in the sheet/table.
                </div>
            )}

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input className="pl-8 h-8 text-sm bg-white border-border" placeholder="Search by name, mobile, company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-0.5">
                    <button onClick={() => setScope('enrolled')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${scope === 'enrolled' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>All Enrolled</button>
                    <button onClick={() => setScope('active')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${scope === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active Only</button>
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
                                    <th className="px-3 py-2.5">Mobile</th>
                                    <th className="px-3 py-2.5 text-center">WhatsApp Status</th>
                                    <th className="px-3 py-2.5">Last Contacted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredLeads.length === 0 ? (
                                    <tr><td colSpan={5} className="px-3 py-12 text-center text-slate-400 text-sm">No leads found.</td></tr>
                                ) : (
                                    paginatedLeads.map((lead) => {
                                        const color = campaignColor(lead.campaignId);
                                        return (
                                            <tr key={lead.id} className={`transition-colors ${campaignColorClasses(color).split(' ')[0]}`}>
                                                <td className="px-3 py-2"><CampaignBadge campaignId={lead.campaignId} campaignName={lead.campaignName} /></td>
                                                <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{lead.fullName}</td>
                                                <td className="px-3 py-2 text-slate-500 text-[11px] whitespace-nowrap">{lead.mobileNumber || "—"}</td>
                                                <td className="px-3 py-2 text-center">
                                                    {lead.whatsappStatus ? (
                                                        <Badge variant="outline" className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${statusBadgeClass(lead.whatsappStatus)}`}>{lead.whatsappStatus}</Badge>
                                                    ) : <span className="text-slate-300 text-[10px]">Not started</span>}
                                                </td>
                                                <td className="px-3 py-2 text-slate-400 text-[11px]">{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"}</td>
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
        </div>
    );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate: 'bg-slate-100 text-slate-500',
    };
    return (
        <Card className="border-border bg-white shadow-sm">
            <CardContent className="p-3 flex items-center justify-between">
                <div>
                    <p className="text-lg font-bold text-slate-900">{value.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{label}</p>
                </div>
                <div className={`p-2 rounded-lg ${colorMap[color]}`}><MessageCircle className="h-4 w-4" /></div>
            </CardContent>
        </Card>
    );
}
