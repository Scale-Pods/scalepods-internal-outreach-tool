"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, AlertCircle, Loader2, RefreshCw, Mail, MessageCircle, ChevronLeft, ChevronRight, Search, Filter, Mic, Info, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPLoader } from "@/components/sp-loader";
import { useMemo } from "react";
import { useData } from "@/context/DataContext";

// Styled HTML wrapper for email previews
const EmailContentStyle = () => (
    <style dangerouslySetInnerHTML={{ __html: `
        .email-prose {
            font-size: 11px;
            line-height: 1.6;
            color: #334155;
        }
        .email-prose h1, .email-prose h2, .email-prose h3 {
            font-weight: bold;
            margin-top: 8px;
            margin-bottom: 4px;
        }
        .email-prose p {
            margin-bottom: 8px;
        }
        .email-prose hr {
            margin: 8px 0;
            border: 0;
            border-top: 1px solid #e2e8f0;
        }
        .email-prose a {
            color: #2563eb;
            text-decoration: underline;
        }
    `}} />
);

interface Lead {
    id: string;
    name: string;
    phone: string;
    email: string;
    replied: string;
    current_loop: string;
    source_loop: string;
    stages_passed: string[];
    stage_data: Record<string, any>;
    _table?: string;
    email_replied?: string;
    whatsapp_replied?: string;
    last_contacted?: string;
}

function LeadOverviewDialog({ lead, isOpen, onClose }: { lead: Lead, isOpen: boolean, onClose: () => void }) {
    const { calls } = useData();
    const leadCalls = calls.filter(c => {
        const p1 = String(c.phone || c.customer_number || "").replace(/\D/g, '');
        const p2 = String(lead.phone || "").replace(/\D/g, '');
        return p1 && p2 && (p1 === p2 || p1.endsWith(p2) || p2.endsWith(p1));
    });

    const hasWA = lead.stages_passed.some(s => s.toLowerCase().includes('whatsapp'));
    const hasEmail = lead.stages_passed.some(s => s.toLowerCase().includes('email'));
    const hasVoice = leadCalls.length > 0 || lead.stages_passed.some(s => s.toLowerCase().includes('voice'));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl bg-white border-zinc-200">
                <DialogHeader>
                    <div className="flex items-center justify-between pr-6">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg">
                                {lead.name.charAt(0)}
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold text-slate-900">{lead.name}</DialogTitle>
                                <p className="text-slate-500 text-sm flex items-center gap-2">
                                    {lead.email} • {lead.phone}
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className={`h-6 ${lead._table === 'meta_lead_tracker' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                            {lead._table === 'meta_lead_tracker' ? 'Meta Ads' : 'ICP Tracker'}
                        </Badge>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-4 mt-6">
                    {/* Channel Cards */}
                    <div className={`p-4 rounded-xl border transition-all ${hasEmail ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <Mail className={`h-4 w-4 ${hasEmail ? 'text-blue-600' : 'text-slate-400'}`} />
                            {hasEmail ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-slate-300" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</h4>
                        <p className="text-sm font-semibold mt-1">{hasEmail ? 'Contacted' : 'Not Sent'}</p>
                    </div>

                    <div className={`p-4 rounded-xl border transition-all ${hasWA ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <MessageCircle className={`h-4 w-4 ${hasWA ? 'text-emerald-600' : 'text-slate-400'}`} />
                            {hasWA ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-slate-300" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp</h4>
                        <p className="text-sm font-semibold mt-1">{hasWA ? 'Contacted' : 'Not Sent'}</p>
                    </div>

                    <div className={`p-4 rounded-xl border transition-all ${hasVoice ? 'bg-purple-50/50 border-purple-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <Mic className={`h-4 w-4 ${hasVoice ? 'text-purple-600' : 'text-slate-400'}`} />
                            {hasVoice ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-slate-300" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voice</h4>
                        <p className="text-sm font-semibold mt-1">{hasVoice ? `${leadCalls.length} Call(s)` : 'No Calls'}</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Recent Communication Detail</h3>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {lead.stages_passed.length === 0 && leadCalls.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-sm italic">
                                No contact logs found for this lead.
                            </div>
                        )}
                        
                        {lead.stages_passed.slice().reverse().map((stage, i) => {
                            const val = lead.stage_data?.[stage];
                            const isEmail = stage.toLowerCase().includes('email');
                            const isWA = stage.toLowerCase().includes('whatsapp');
                            
                            return (
                                <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 group">
                                    <div className="pt-0.5">
                                        {isEmail && <Mail className="h-4 w-4 text-blue-500" />}
                                        {isWA && <MessageCircle className="h-4 w-4 text-emerald-500" />}
                                        {!isEmail && !isWA && <Info className="h-4 w-4 text-slate-400" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-slate-700">{stage}</span>
                                            <span className="text-[10px] text-slate-400">Completed</span>
                                        </div>
                                        <div className="text-[11px] text-slate-600 leading-relaxed overflow-hidden">
                                            {isEmail && typeof val === 'string' && val.includes('<') ? (
                                                <div 
                                                    className="email-prose max-h-[120px] overflow-y-auto pr-2 custom-scrollbar" 
                                                    dangerouslySetInnerHTML={{ __html: val }} 
                                                />
                                            ) : (
                                                <div className="italic">
                                                    {typeof val === 'string' ? val : 'Data logged in system'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {leadCalls.map((call, i) => (
                            <div key={`call-${i}`} className="flex gap-3 p-3 rounded-lg bg-purple-50/30 border border-purple-100">
                                <Mic className="h-4 w-4 text-purple-500 pt-0.5" />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-purple-700">Voice AI Interaction</span>
                                        <span className="text-[10px] text-purple-400">{new Date(call.startedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        {call.analysis?.structuredData?.sentiment || "Call session completed"} • {Math.round(call.durationSeconds || 0)}s
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex justify-end mt-4">
                    <Button variant="ghost" className="text-slate-500 hover:text-slate-900 font-bold text-xs" onClick={onClose}>
                        CLOSE OVERVIEW
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// USA Stages (Day 0: WA+Email, Day 2: WA, Day 3: Voice1, Day 3: Voice2, Day 5: Email, Day 7: Email)
const USA_STAGES = [
    { id: 1, label: "Day 0: WhatsApp & Email", criteria: ["WhatsApp 1", "Email 1"] },
    { id: 2, label: "Day 2: WhatsApp", criteria: ["WhatsApp 2"] },
    { id: 3, label: "Day 3: Voice Call 1", criteria: ["Voice 1"] },
    { id: 4, label: "Day 4: Voice Call 2", criteria: ["Voice 2"] },
    { id: 5, label: "Day 5: Email", criteria: ["Email 2"] },
    { id: 6, label: "Day 7: Email", criteria: ["Email 3"] }
];

// Global Stages (Day 0: WA, Day 2: WA, Day 3: Voice1, Day 3: Voice2, Day 5: WA, Day 7: WA)
const GLOBAL_STAGES = [
    { id: 1, label: "Day 0: WhatsApp", criteria: ["WhatsApp 1"] },
    { id: 2, label: "Day 2: WhatsApp", criteria: ["WhatsApp 2"] },
    { id: 3, label: "Day 3: Voice Call 1", criteria: ["Voice 1"] },
    { id: 4, label: "Day 4: Voice Call 2", criteria: ["Voice 2"] },
    { id: 5, label: "Day 5: WhatsApp", criteria: ["WhatsApp 3"] },
    { id: 6, label: "Day 7: WhatsApp", criteria: ["WhatsApp 4"] }
];

const isUSALead = (phone: string) => {
    if (!phone) return false;
    const clean = phone.replace(/\D/g, '');
    return (clean.length === 10) || (clean.length === 11 && clean.startsWith('1'));
};

const getStagesForLead = (lead: Lead) => {
    return isUSALead(lead.phone) ? USA_STAGES : GLOBAL_STAGES;
};

function ProgressBreakdown({ lead }: { lead: Lead }) {
    const stages = getStagesForLead(lead);
    const stagesPassed = lead.stages_passed || [];

    const breakdown = stages.map(stage => {
        // Special logic: Day 0 requires ALL criteria (WhatsApp AND Email for USA). 
        // Other stages might have fallbacks (e.g. WA 3 OR Email 2), so ANY criteria is sufficient.
        const useAndLogic = stage.label.includes("Day 0") && stage.criteria.length > 1;
        const isMet = useAndLogic
            ? stage.criteria.every(c => stagesPassed.includes(c))
            : stage.criteria.some(c => stagesPassed.includes(c));
        return { name: stage.label, value: 1, isCompleted: isMet };
    });

    const completedCount = breakdown.filter(b => b.isCompleted).length;
    const progress = Math.round((completedCount / stages.length) * 100);

    const data = [
        { name: 'Completed', value: completedCount, color: '#10b981' }, // Emerald-500
        { name: 'Remaining', value: stages.length - completedCount, color: '#e2e8f0' } // Slate-200
    ];

    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="cursor-pointer group relative">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1.5">
                        <div className="flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                            <span className="font-medium">Stage {completedCount} of {stages.length}</span>
                            <ChevronRight className="h-3 w-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
                        </div>
                        <span className="font-bold text-slate-700">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-slate-100 group-hover:bg-blue-50 group-hover:ring-2 group-hover:ring-blue-100 transition-all" indicatorClassName="bg-gradient-to-r from-blue-500 to-blue-500" />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        View Journey
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>Lead Journey</span>
                        <Badge variant="outline" className="ml-2 bg-slate-50">
                            {isUSALead(lead.phone) ? "USA Flow" : "Global Flow"}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-6 py-4">
                    <div className="h-[160px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-2xl font-bold text-slate-900">{progress}%</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">Complete</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            {breakdown.map((step, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <div className={`h-2 w-2 rounded-full ${step.isCompleted ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                    <span className={step.isCompleted ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                                        {step.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}



// Restore LeadsPage component
export default function LeadsPage() {
    const { leads, loadingLeads, refreshLeads } = useData();
    const [templates, setTemplates] = useState<any[]>([]);
    const loadingTemplates = useState(false)[0]; // Placeholder for template loading if needed
    const [view, setView] = useState<"leads" | "templates">("leads");
    const [templateFilter, setTemplateFilter] = useState<"email" | "whatsapp">("email");
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [loopFilter, setLoopFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [regionFilter, setRegionFilter] = useState("all");
    const [channelFilter, setChannelFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [selectedLeadForOverview, setSelectedLeadForOverview] = useState<Lead | null>(null);

    // Reset page on view or filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [view, templateFilter, searchQuery, loopFilter, statusFilter, regionFilter, channelFilter, sourceFilter]);


    const loading = view === "leads" ? loadingLeads : false;

    const fetchTemplates = async () => {
        setError(null);
        try {
            const response = await fetch("/api/templates");
            if (!response.ok) {
                throw new Error("Failed to fetch templates");
            }
            const data = await response.json();
            setTemplates(data);
        } catch (err) {
            console.error(err);
            setError("Could not load templates. Please try again later.");
        }
    };

    useEffect(() => {
        if (view === "templates") {
            fetchTemplates();
        }
    }, [view]);

    // Filtering Logic
    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            // Search Query
            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                const matches =
                    lead.name?.toLowerCase().includes(search) ||
                    lead.email?.toLowerCase().includes(search) ||
                    lead.phone?.toLowerCase().includes(search);
                if (!matches) return false;
            }

            // Loop Filter
            if (loopFilter !== "all") {
                const s = (lead.source_loop || "").toLowerCase();
                const mapped = (s === 'nr_wf' || s === 'intro') ? 'intro' : s;
                if (!mapped.includes(loopFilter.toLowerCase())) return false;
            }

            // Status Filter
            if (statusFilter !== "all") {
                const isReplied = (lead.replied === "Yes" || (lead.email_replied && lead.email_replied !== "No") || (lead.whatsapp_replied && lead.whatsapp_replied !== "No"));
                if (statusFilter === "replied" && !isReplied) return false;
                if (statusFilter === "sent" && isReplied) return false;
            }

            // Region Filter
            if (regionFilter !== "all") {
                const isUSA = isUSALead(lead.phone);
                if (regionFilter === "usa" && !isUSA) return false;
                if (regionFilter === "global" && isUSA) return false;
            }

            // Channel Filter
            if (channelFilter !== "all") {
                const hasEmail = lead.email && lead.email !== "No Email" && lead.email.trim() !== "";
                const hasWP = lead.phone && lead.phone.trim() !== "";
                if (channelFilter === "email" && !hasEmail) return false;
                if (channelFilter === "whatsapp" && !hasWP) return false;
            }

            // Source Filter
            if (sourceFilter !== "all") {
                const table = (lead._table || "").toLowerCase();
                if (sourceFilter === 'meta' && !table.includes('meta')) return false;
                if (sourceFilter === 'icp' && !table.includes('icp')) return false;
            }

            return true;
        }).sort((a, b) => {
            // Sort by: contacted leads first (those with stages_passed)
            const aContacted = a.stages_passed.length > 0 ? 1 : 0;
            const bContacted = b.stages_passed.length > 0 ? 1 : 0;
            if (aContacted !== bContacted) return bContacted - aContacted;
            
            // Secondary sort: Recency
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [leads, searchQuery, loopFilter, statusFilter, regionFilter, channelFilter, sourceFilter]);


    if (error) {
        return (
            <div className="p-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative min-h-[500px]">
            <EmailContentStyle />
            {loading && leads.length === 0 && <SPLoader />}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
                    <p className="text-slate-500">Manage and track your leads across all loops.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={view === "leads" ? "outline" : "ghost"}
                        onClick={() => setView("leads")}
                        className={view === "leads" ? "bg-slate-50" : ""}
                    >
                        Leads
                    </Button>
                    <Button
                        variant={view === "templates" ? "outline" : "ghost"}
                        onClick={() => setView("templates")}
                        className={view === "templates" ? "bg-slate-50" : ""}
                    >
                        Templates
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => view === "leads" ? refreshLeads() : fetchTemplates()}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <div className="bg-white p-2 rounded-md border shadow-sm text-sm font-medium text-slate-600">
                        {view === "leads" ? `Total Leads: ${leads.length}` : `Templates: ${templates.length}`}
                    </div>
                </div>
            </div>

            <Card className="border-border shadow-sm">
                <CardHeader className="pb-4 border-border border-border">
                    <div className="flex items-center gap-2">
                        {view === "leads" ? <Users className="h-5 w-5 text-blue-600" /> : <AlertCircle className="h-5 w-5 text-purple-600" />}
                        <CardTitle>{view === "leads" ? "All Leads" : "Templates Library"}</CardTitle>
                    </div>
                    <CardDescription>
                        {view === "leads" ? "Real-time data from your Intro and Follow-up loops." : "Manage your messaging templates."}
                    </CardDescription>
                </CardHeader>

                {view === "leads" && (
                    <div className="p-4 bg-slate-50/50 border-border border-border flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search by name, email, or phone..."
                                className="pl-10 h-10 bg-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={loopFilter} onValueChange={setLoopFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-white">
                                    <SelectValue placeholder="Loop Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Loops</SelectItem>
                                    <SelectItem value="intro">Intro Loop</SelectItem>
                                    <SelectItem value="followup">Follow Up</SelectItem>
                                    <SelectItem value="nurture">Nurture Loop</SelectItem>

                                </SelectContent>
                            </Select>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-white">
                                    <SelectValue placeholder="Reply Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="replied">Replied</SelectItem>
                                    <SelectItem value="sent">Sent Only</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={regionFilter} onValueChange={setRegionFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-white">
                                    <SelectValue placeholder="Region" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Regions</SelectItem>
                                    <SelectItem value="usa">USA Leads</SelectItem>
                                    <SelectItem value="global">Global Leads</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={channelFilter} onValueChange={setChannelFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-white">
                                    <SelectValue placeholder="Channel" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Channels</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                <SelectTrigger className="w-[140px] h-10 bg-white">
                                    <SelectValue placeholder="Source" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sources</SelectItem>
                                    <SelectItem value="meta">Meta Ads</SelectItem>
                                    <SelectItem value="icp">ICP Tracker</SelectItem>
                                </SelectContent>
                            </Select>

                            {(searchQuery || loopFilter !== "all" || statusFilter !== "all" || regionFilter !== "all" || channelFilter !== "all" || sourceFilter !== "all") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-500 hover:text-rose-600 h-10 px-3"
                                    onClick={() => {
                                        setSearchQuery("");
                                        setLoopFilter("all");
                                        setStatusFilter("all");
                                        setRegionFilter("all");
                                        setChannelFilter("all");
                                        setSourceFilter("all");
                                    }}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <CardContent className="p-0">
                    {view === "leads" ? (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="w-[200px]">Name</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead className="text-center">Channel</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Current Loop</TableHead>
                                        <TableHead>Reply Status</TableHead>
                                        <TableHead className="w-[250px]">Progress</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading && leads.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                <div className="flex items-center justify-center gap-2 text-slate-500">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Loading leads...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredLeads.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                                                No leads matching these filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((lead, index) => {
                                            const isMeta = lead._table === 'meta_lead_tracker';
                                            return (
                                                <TableRow key={index} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => setSelectedLeadForOverview(lead)}>
                                                    <TableCell className="font-bold text-slate-900">
                                                        <div className="flex flex-col">
                                                            <span>{lead.name}</span>
                                                            <Badge variant="outline" className={`mt-1 h-4 w-fit px-1 text-[8px] uppercase tracking-tighter ${isMeta ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                                                {isMeta ? 'Meta Ads' : 'ICP Tracker'}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-slate-600 font-mono text-xs">{lead.phone}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1.5 opacity-80">
                                                            {lead.email && lead.email !== "No Email" && (
                                                                <Mail className="h-3.5 w-3.5 text-blue-500" />
                                                            )}
                                                            {lead.phone && (
                                                                <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={`text-xs ${lead.email === "No Email" ? "text-slate-300 italic" : "text-slate-600 font-medium"}`}>
                                                        {lead.email === "No Email" ? "No Email" : lead.email}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="bg-white text-slate-500 hover:bg-slate-50 border-slate-200 uppercase text-[9px] font-bold tracking-widest px-1.5">
                                                            {lead.source_loop?.toUpperCase() || 'CAMPAIGN'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={(lead.replied === "Yes" || (lead.email_replied && lead.email_replied !== "No") || (lead.whatsapp_replied && lead.whatsapp_replied !== "No")) ? "default" : "secondary"}
                                                            className={(lead.replied === "Yes" || (lead.email_replied && lead.email_replied !== "No") || (lead.whatsapp_replied && lead.whatsapp_replied !== "No")) ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-none font-bold capitalize text-[10px]" : "capitalize text-slate-400 bg-slate-50 border-slate-200 text-[10px]"}>
                                                            {(lead.email_replied && lead.email_replied !== "No") ? "Replied" : (lead.whatsapp_replied && lead.whatsapp_replied !== "No") ? "Replied" : lead.replied === "No" ? "Sent" : lead.replied}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <ProgressBreakdown lead={lead} />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                            <PaginationFooter
                                totalItems={filteredLeads.length}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Template Type Toggles */}
                            <div className="flex justify-center">
                                <div className="bg-slate-100 p-1 rounded-lg inline-flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setTemplateFilter("email")}
                                        className={`text-xs h-8 px-4 rounded-md transition-all ${templateFilter === "email" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
                                    >
                                        Email Templates
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setTemplateFilter("whatsapp")}
                                        className={`text-xs h-8 px-4 rounded-md transition-all ${templateFilter === "whatsapp" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
                                    >
                                        WhatsApp Templates
                                    </Button>
                                </div>
                            </div>

                            {loading && templates.length === 0 ? (
                                <div className="flex items-center justify-center h-24 text-slate-500 gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading templates...
                                </div>
                            ) : templates.filter(t => t.type === templateFilter).length === 0 ? (
                                <div className="text-center text-slate-500 py-10">No {templateFilter} templates found.</div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 gap-6 max-w-4xl mx-auto">
                                        {templates
                                            .filter(t => t.type === templateFilter)
                                            .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                            .map((template: any, idx) => (
                                                <Card key={template.id || idx} className="border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                                    <CardHeader className="bg-slate-50/50 border-border border-border py-3 px-4 flex flex-row items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-md ${template.type === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                                {template.type === 'email' ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                                                            </div>
                                                            <div className="font-semibold text-slate-700">
                                                                {template.name || `Template ${idx + 1}`}
                                                            </div>
                                                        </div>
                                                        {template.category && (
                                                            <Badge variant="secondary" className="text-xs bg-white border border-border">
                                                                {template.category}
                                                            </Badge>
                                                        )}
                                                    </CardHeader>
                                                    <CardContent className="p-6 bg-white prose prose-slate max-w-none">
                                                        <div className="whitespace-pre-wrap text-slate-700 font-sans leading-relaxed">
                                                            {typeof template.body === 'string' ? template.body :
                                                                typeof template.components === 'object' ? JSON.stringify(template.components, null, 2) :
                                                                    JSON.stringify(template, null, 2)}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                    </div>
                                    <PaginationFooter
                                        totalItems={templates.filter(t => t.type === templateFilter).length}
                                        currentPage={currentPage}
                                        itemsPerPage={itemsPerPage}
                                        onPageChange={setCurrentPage}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedLeadForOverview && (
                <LeadOverviewDialog
                    lead={selectedLeadForOverview}
                    isOpen={!!selectedLeadForOverview}
                    onClose={() => setSelectedLeadForOverview(null)}
                />
            )}
        </div>
    );
}

function PaginationFooter({ totalItems, currentPage, itemsPerPage, onPageChange }: any) {
    if (totalItems <= itemsPerPage) return null;

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    return (
        <div className="px-6 py-4 border-t border-border bg-slate-50/50 flex items-center justify-between">
            <p className="text-sm text-slate-500">
                Showing <span className="font-bold text-slate-900">{totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, totalItems)}</span> of {totalItems} items
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className="h-8 w-8 p-0 text-xs"
                                onClick={() => onPageChange(pageNum)}
                            >
                                {pageNum}
                            </Button>
                        );
                    })}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
