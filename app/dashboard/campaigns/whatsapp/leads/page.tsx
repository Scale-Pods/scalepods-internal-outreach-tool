"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    MessageCircle,
    RefreshCw,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    Sparkles,
    Flame,
    Building,
    Calendar,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignDateRange } from "@/context/CampaignDateContext";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { CampaignLabel } from "@/components/dashboard/campaign-badge";
import { CampaignWhatsAppChatDetail } from "@/components/dashboard/campaign-whatsapp-chat-detail";
import type { CampaignWaLead } from "@/lib/services/campaign-whatsapp";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from "next/navigation";

const LEADS_PER_PAGE = 15;

export default function CampaignWhatsAppLeadsPage() {
    const router = useRouter();
    const { dateRange, setDateRange, fromIso, toIso } = useCampaignDateRange();

    const [leads, setLeads] = useState<CampaignWaLead[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [campaignOptions, setCampaignOptions] = useState<{ id: string; name: string; alias?: string | null }[]>([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
    const [replyStatus, setReplyStatus] = useState<string>("all"); // 'all' | 'replied' | 'not_replied'
    const [leadTagFilter, setLeadTagFilter] = useState<string>("all"); // 'all' | 'pf' | 'positive'

    const [selectedLead, setSelectedLead] = useState<CampaignWaLead | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const fetchCampaignOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/campaigns/channel-stats?channel=whatsapp');
            if (res.ok) {
                const json = await res.json();
                setCampaignOptions((json.campaignOptions || []).map((c: any) => ({
                    id: String(c.id || c.campaign_id),
                    name: c.name || c.campaign_name || `Campaign ${c.id || c.campaign_id}`,
                    alias: c.alias || null,
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
            params.set('page', String(currentPage));
            params.set('pageSize', String(LEADS_PER_PAGE));
            if (searchInput.trim()) params.set('search', searchInput.trim());
            if (replyStatus !== 'all') params.set('replyStatus', replyStatus);
            if (leadTagFilter !== 'all') params.set('leadStatus', leadTagFilter);
            if (fromIso) params.set('from', fromIso);
            if (toIso) params.set('to', toIso);
            selectedCampaigns.forEach(c => params.append('campaignId', c));

            const res = await fetch(`/api/campaigns/whatsapp/leads?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch leads");
            const json = await res.json();
            setLeads(json.data || []);
            setTotalCount(json.totalCount || 0);
        } catch (err) {
            console.error("Failed to fetch WhatsApp leads:", err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchInput, replyStatus, leadTagFilter, fromIso, toIso, selectedCampaigns]);

    useEffect(() => {
        fetchCampaignOptions();
    }, [fetchCampaignOptions]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const handleDateUpdate = (range: any) => {
        if (range?.range?.from) {
            setDateRange(range.range, range.label);
        } else {
            setDateRange(undefined);
        }
        setCurrentPage(1);
    };

    const toggleCampaign = (id: string) => {
        setSelectedCampaigns(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchInput("");
        setSelectedCampaigns([]);
        setReplyStatus("all");
        setLeadTagFilter("all");
        setDateRange(undefined);
        setCurrentPage(1);
    };

    const hasActiveFilters =
        !!searchInput ||
        selectedCampaigns.length > 0 ||
        replyStatus !== "all" ||
        leadTagFilter !== "all";

    const totalPages = Math.ceil(totalCount / LEADS_PER_PAGE) || 1;

    const openChat = (lead: CampaignWaLead) => {
        setSelectedLead(lead);
        setDialogOpen(true);
    };

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`space-y-6 pb-8 sm:pb-12 pt-4 px-1 sm:px-4 md:px-6 relative ${loading ? 'h-[calc(100dvh-5rem)] overflow-hidden' : 'min-h-[500px]'}`}>
            {loading && <SPLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" />
                        Campaign WhatsApp Leads
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        All contacts reached via WhatsApp campaigns with response tracking
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto">
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
                                onClick={() => {
                                    setSelectedCampaigns([]);
                                    setCurrentPage(1);
                                }}
                            >
                                All Campaigns
                            </DropdownMenuItem>
                            {campaignOptions.map(c => (
                                <DropdownMenuItem
                                    key={c.id}
                                    className="text-xs cursor-pointer flex items-center justify-between gap-2"
                                    onClick={() => toggleCampaign(c.id)}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="truncate font-medium">{c.name}</span>
                                        {c.alias && <span className="text-[10px] text-slate-400 truncate">Alias: {c.alias}</span>}
                                    </div>
                                    {selectedCampaigns.includes(c.id) && (
                                        <Badge className="h-4 px-1 text-[9px] bg-cyan-600 shrink-0">Active</Badge>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Date Picker */}
                    <DateRangePicker value={dateRange} onUpdate={handleDateUpdate} />

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
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-semibold text-slate-600 hover:text-cyan-600 hover:bg-cyan-50"
                    onClick={() => router.push('/dashboard/campaigns/whatsapp/chat')}
                >
                    Chat
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
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

            {/* Search and Filter options */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Search lead by name, phone, email, or company..."
                        className="pl-9 h-9 text-xs bg-white border-slate-200"
                        value={searchInput}
                        onChange={e => {
                            setSearchInput(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                    {searchInput && (
                        <button
                            onClick={() => {
                                setSearchInput("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Reply filter buttons */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
                        <button
                            onClick={() => {
                                setReplyStatus("all");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                replyStatus === "all"
                                    ? "bg-slate-100 text-slate-800"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            All Replies
                        </button>
                        <button
                            onClick={() => {
                                setReplyStatus("replied");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                replyStatus === "replied"
                                    ? "bg-emerald-50 text-emerald-700 font-bold"
                                    : "text-slate-500 hover:text-emerald-700"
                            }`}
                        >
                            Replied
                        </button>
                        <button
                            onClick={() => {
                                setReplyStatus("not_replied");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                replyStatus === "not_replied"
                                    ? "bg-slate-100 text-slate-700 font-bold"
                                    : "text-slate-500 hover:text-slate-700"
                            }`}
                        >
                            No Reply
                        </button>
                    </div>

                    {/* Tag filter buttons */}
                    <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-white">
                        <button
                            onClick={() => {
                                setLeadTagFilter("all");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded ${
                                leadTagFilter === "all"
                                    ? "bg-slate-100 text-slate-800"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            All Tags
                        </button>
                        <button
                            onClick={() => {
                                setLeadTagFilter("positive");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                                leadTagFilter === "positive"
                                    ? "bg-amber-50 text-amber-700 font-bold"
                                    : "text-slate-500 hover:text-amber-700"
                            }`}
                        >
                            <Sparkles className="h-3 w-3" /> Positive
                        </button>
                        <button
                            onClick={() => {
                                setLeadTagFilter("pf");
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                                leadTagFilter === "pf"
                                    ? "bg-purple-50 text-purple-700 font-bold"
                                    : "text-slate-500 hover:text-purple-700"
                            }`}
                        >
                            <Flame className="h-3 w-3" /> PF
                        </button>
                    </div>
                </div>
            </div>

            {/* Leads Table */}
            <Card className="border-border shadow-sm bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Campaign</th>
                                <th className="px-4 py-3">Lead Name</th>
                                <th className="px-4 py-3">Mobile Number</th>
                                <th className="px-4 py-3">Company</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Sent</th>
                                <th className="px-4 py-3 text-center">Replies</th>
                                <th className="px-4 py-3">Tags</th>
                                <th className="px-4 py-3">Last Contacted</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {leads.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                                        No WhatsApp campaign leads found.
                                    </td>
                                </tr>
                            ) : (
                                leads.map(lead => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => openChat(lead)}
                                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-3">
                                            <CampaignLabel
                                                campaignId={lead.campaignId}
                                                campaignName={lead.campaignName}
                                                alias={lead.campaignAlias}
                                                compact
                                            />
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900">{lead.fullName}</div>
                                            {lead.email && (
                                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                                    {lead.email}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {lead.mobileNumber || '-'}
                                        </td>

                                        <td className="px-4 py-3 text-slate-600">
                                            {lead.companyName ? (
                                                <div className="flex items-center gap-1 truncate max-w-[140px]">
                                                    <Building className="h-3 w-3 text-slate-400 shrink-0" />
                                                    <span>{lead.companyName}</span>
                                                </div>
                                            ) : (
                                                '-'
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <Badge
                                                variant="outline"
                                                className={`text-[9px] font-bold uppercase ${
                                                    lead.hasReplied
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : (lead.whatsappStatus || '').toUpperCase() === 'FAILED'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : (lead.whatsappStatus || '').toUpperCase() === 'BLOCKED'
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                        : (lead.whatsappStatus || '').toUpperCase() === 'DELIVERED' || (lead.whatsappStatus || '').toUpperCase() === 'READ'
                                                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                                        : (lead.whatsappStatus || '').toUpperCase() === 'SENT'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}
                                            >
                                                {lead.hasReplied
                                                    ? 'Replied'
                                                    : lead.whatsappStatus
                                                    ? lead.whatsappStatus
                                                    : lead.messagesSentCount > 0
                                                    ? 'Sent'
                                                    : 'Not Sent'}
                                            </Badge>
                                        </td>

                                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                                            {lead.messagesSentCount}
                                        </td>

                                        <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                            {lead.repliesCount}
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {lead.isPositive && (
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[9px] font-bold uppercase gap-0.5">
                                                        <Sparkles className="h-2.5 w-2.5" /> Positive
                                                    </Badge>
                                                )}
                                                {lead.isPf && (
                                                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[9px] font-bold uppercase gap-0.5">
                                                        <Flame className="h-2.5 w-2.5" /> PF
                                                    </Badge>
                                                )}
                                                {!lead.isPositive && !lead.isPf && (
                                                    <span className="text-[10px] text-slate-400">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap">
                                            {lead.lastContactedAt ? (
                                                new Date(lead.lastContactedAt).toLocaleDateString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })
                                            ) : (
                                                '-'
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                onClick={() => openChat(lead)}
                                            >
                                                View Chat
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                        <div>
                            Showing {(currentPage - 1) * LEADS_PER_PAGE + 1} to{" "}
                            {Math.min(currentPage * LEADS_PER_PAGE, totalCount)} of {totalCount} leads
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
                <DialogContent className="max-w-4xl p-4 sm:p-6 h-[90dvh] lg:h-[85dvh] flex flex-col bg-white overflow-hidden">
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

