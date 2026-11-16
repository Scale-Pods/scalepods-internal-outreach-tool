"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    MessageCircle,
    Send,
    Reply,
    RefreshCw,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    AlertCircle,
    Flame,
    Sparkles,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { CampaignBadge } from "@/components/dashboard/campaign-badge";
import { CampaignWhatsAppChatDetail } from "@/components/dashboard/campaign-whatsapp-chat-detail";
import type { CampaignWaLead } from "@/lib/services/campaign-whatsapp";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";

export default function CampaignWhatsAppChatPage() {
    const router = useRouter();

    const [leads, setLeads] = useState<CampaignWaLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
    const [replyStatusFilter, setReplyStatusFilter] = useState<string[]>([]);

    const [selectedLead, setSelectedLead] = useState<CampaignWaLead | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=whatsapp');
            if (res.ok) {
                const json = await res.json();
                setCampaignOptions((json.campaignOptions || []).map((c: any) => ({
                    id: String(c.campaign_id),
                    name: c.campaign_name,
                })));
            }
        } catch (e) {
            console.error("Failed to fetch campaign options:", e);
        }
    }, []);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', '1');
            params.set('pageSize', '200'); // fetch all active for client-side responsive search & filtering
            if (dateRange.from) {
                params.set('from', startOfDay(dateRange.from).toISOString());
                params.set('to', endOfDay(dateRange.to || dateRange.from).toISOString());
            }
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/whatsapp/leads?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch leads");
            const json = await res.json();
            setLeads(json.data || []);
        } catch (err) {
            console.error("Failed to fetch WhatsApp chat leads:", err);
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    // Filter leads
    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matches =
                    lead.fullName.toLowerCase().includes(q) ||
                    (lead.mobileNumber && lead.mobileNumber.toLowerCase().includes(q)) ||
                    (lead.companyName && lead.companyName.toLowerCase().includes(q));
                if (!matches) return false;
            }

            if (replyStatusFilter.length > 0) {
                const matchesReply =
                    (replyStatusFilter.includes("Replied") && lead.hasReplied) ||
                    (replyStatusFilter.includes("No Reply") && !lead.hasReplied);
                if (!matchesReply) return false;
            }

            return true;
        });
    }, [leads, searchQuery, replyStatusFilter]);

    // Paginated leads
    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage) || 1;
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return filteredLeads.slice(start, start + leadsPerPage);
    }, [filteredLeads, currentPage]);

    // Statistics
    const stats = useMemo(() => {
        let sentCount = 0;
        let repliedCount = 0;
        let failedCount = 0;
        filteredLeads.forEach(l => {
            sentCount += l.messagesSentCount;
            if (l.hasReplied) repliedCount++;
            if (String(l.whatsappStatus || '').toUpperCase().includes('FAILED')) failedCount++;
        });
        return {
            total: filteredLeads.length,
            sentCount,
            repliedCount,
            failedCount,
        };
    }, [filteredLeads]);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setDateRange({
                from: new Date(range.range.from),
                to: new Date(range.range.to || range.range.from),
            });
            setCurrentPage(1);
        }
    };

    const toggleCampaign = (id: string) => {
        setSelectedCampaigns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
        setCurrentPage(1);
    };

    const toggleReplyFilter = (val: string) => {
        setReplyStatusFilter(prev =>
            prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
        );
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchQuery("");
        setSelectedCampaigns([]);
        setReplyStatusFilter([]);
        setCurrentPage(1);
    };

    const hasActiveFilters =
        !!searchQuery || selectedCampaigns.length > 0 || replyStatusFilter.length > 0;

    const openChat = (lead: CampaignWaLead) => {
        setSelectedLead(lead);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-6 pb-12 pt-4 px-6 relative min-h-[500px]">
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <MessageCircle className="h-6 w-6 text-emerald-600" />
                        Campaign WhatsApp Chat Center
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Unified conversation timeline of bot outreach and customer replies
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Campaign filter */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                                <Filter className="h-3.5 w-3.5 text-slate-500" />
                                {selectedCampaigns.length === 0
                                    ? "All Campaigns"
                                    : `${selectedCampaigns.length} Campaign${selectedCampaigns.length > 1 ? 's' : ''}`}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white p-1">
                            <DropdownMenuItem
                                className="text-xs font-bold cursor-pointer"
                                onClick={() => setSelectedCampaigns([])}
                            >
                                All Campaigns
                            </DropdownMenuItem>
                            {campaignOptions.map(c => (
                                <DropdownMenuItem
                                    key={c.id}
                                    className="text-xs cursor-pointer flex items-center justify-between"
                                    onClick={() => toggleCampaign(c.id)}
                                >
                                    <span className="truncate">{c.name}</span>
                                    {selectedCampaigns.includes(c.id) && (
                                        <Badge className="h-4 px-1 text-[9px] bg-cyan-600">Active</Badge>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Date Picker */}
                    <DateRangePicker onUpdate={handleDateUpdate} />

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 font-bold"
                        >
                            <X className="h-3.5 w-3.5" /> Reset
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={fetchLeads}>
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Quick Sub-navigation banner */}
            <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp')}
                >
                    Overview
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/chat')}
                >
                    Chat
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/leads')}
                >
                    Leads
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/analytics')}
                >
                    Analytics
                </Button>
            </div>

            {/* Status Summary & Filter bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-border shadow-sm bg-white p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-semibold uppercase">Total In Chat</span>
                        <Users className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}</div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-semibold uppercase">Messages Sent</span>
                        <Send className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{stats.sentCount}</div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-600 font-semibold uppercase">Replied Leads</span>
                        <Reply className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{stats.repliedCount}</div>
                </Card>

                <Card className="border-border shadow-sm bg-white p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-rose-600 font-semibold uppercase">Failed Delivery</span>
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{stats.failedCount}</div>
                </Card>
            </div>

            {/* Search and reply filter controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search lead by name, phone, or company..."
                        className="pl-9 h-9 text-xs bg-white border-slate-200"
                        value={searchQuery}
                        onChange={e => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={replyStatusFilter.includes("Replied") ? "secondary" : "outline"}
                        size="sm"
                        className={`h-8 text-xs font-semibold ${
                            replyStatusFilter.includes("Replied")
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ""
                        }`}
                        onClick={() => toggleReplyFilter("Replied")}
                    >
                        Replied ({leads.filter(l => l.hasReplied).length})
                    </Button>
                    <Button
                        variant={replyStatusFilter.includes("No Reply") ? "secondary" : "outline"}
                        size="sm"
                        className={`h-8 text-xs font-semibold ${
                            replyStatusFilter.includes("No Reply")
                                ? "bg-slate-100 text-slate-700 border-slate-300"
                                : ""
                        }`}
                        onClick={() => toggleReplyFilter("No Reply")}
                    >
                        No Reply ({leads.filter(l => !l.hasReplied).length})
                    </Button>
                </div>
            </div>

            {/* Leads Table */}
            <Card className="border-border shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Lead / Mobile</th>
                                <th className="px-4 py-3">Campaign</th>
                                <th className="px-4 py-3">Latest Message Preview</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Sent</th>
                                <th className="px-4 py-3 text-center">Replies</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                        No WhatsApp chat leads match your filter criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedLeads.map(lead => {
                                    const latestMsg = lead.timeline[lead.timeline.length - 1];
                                    return (
                                        <tr
                                            key={lead.id}
                                            onClick={() => openChat(lead)}
                                            className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                    {lead.fullName}
                                                    {lead.isPositive && (
                                                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                                    )}
                                                    {lead.isPf && (
                                                        <Flame className="h-3.5 w-3.5 text-purple-500" />
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-500">{lead.mobileNumber}</div>
                                                {lead.companyName && (
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                        {lead.companyName}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <CampaignBadge
                                                    campaignId={lead.campaignId}
                                                    campaignName={lead.campaignName}
                                                />
                                            </td>

                                            <td className="px-4 py-3 max-w-xs">
                                                {latestMsg ? (
                                                    <div>
                                                        <span
                                                            className={`text-[9px] font-bold uppercase tracking-wider ${
                                                                latestMsg.type === 'user'
                                                                    ? 'text-cyan-600'
                                                                    : 'text-emerald-600'
                                                            }`}
                                                        >
                                                            {latestMsg.type === 'user' ? 'Customer:' : 'Bot:'}
                                                        </span>
                                                        <p className="text-[11px] text-slate-700 truncate mt-0.5">
                                                            {latestMsg.content}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">No message text</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] font-bold uppercase ${
                                                        lead.hasReplied
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : lead.whatsappStatus === 'FAILED'
                                                            ? 'bg-red-50 text-red-700 border-red-200'
                                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}
                                                >
                                                    {lead.hasReplied ? 'Replied' : lead.whatsappStatus || 'Sent'}
                                                </Badge>
                                            </td>

                                            <td className="px-4 py-3 text-center font-semibold text-slate-700">
                                                {lead.messagesSentCount}
                                            </td>

                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                                {lead.repliesCount}
                                            </td>

                                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                    onClick={() => openChat(lead)}
                                                >
                                                    Open Chat
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-slate-500">
                        <div>
                            Showing {(currentPage - 1) * leadsPerPage + 1} to{" "}
                            {Math.min(currentPage * leadsPerPage, filteredLeads.length)} of{" "}
                            {filteredLeads.length} leads
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-2 font-semibold text-slate-700">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Chat Modal */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl p-6 h-[85vh] flex flex-col bg-white">
                    <VisuallyHidden.Root>
                        <DialogTitle>
                            {selectedLead ? `WhatsApp Chat with ${selectedLead.fullName}` : "WhatsApp Chat Details"}
                        </DialogTitle>
                        <DialogDescription>
                            Conversation history and lead details
                        </DialogDescription>
                    </VisuallyHidden.Root>
                    <CampaignWhatsAppChatDetail
                        lead={selectedLead}
                        onClose={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

