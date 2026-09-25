"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Search, RefreshCw, MessageSquare, User, Send, ExternalLink,
} from "lucide-react";
import { SPLoader } from "@/components/sp-loader";
import { LINKEDIN_ACCOUNTS, type LinkedInConversationThread } from "@/lib/services/linkedin-sheets";
import { LinkedInAccountBadge } from "@/components/dashboard/linkedin-account-badge";

export default function LinkedInChatPage() {
    const [threads, setThreads] = useState<LinkedInConversationThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedThread, setSelectedThread] = useState<LinkedInConversationThread | null>(null);
    const [accountFilter, setAccountFilter] = useState<string[]>([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/linkedin/conversations");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setThreads(json.threads || []);
        } catch (err) {
            console.error("Failed to fetch LinkedIn conversations:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleAccountFilter = (value: string) => {
        setAccountFilter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    };

    const filteredThreads = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return threads.filter(t => {
            if (accountFilter.length > 0 && !accountFilter.includes(t.accountId.trim())) return false;
            if (!q) return true;
            const name = t.lead?.companyName || t.personId;
            const haystack = `${name} ${t.lead?.title || ''} ${t.messages.map(m => m.message).join(' ')}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [threads, searchQuery, accountFilter]);

    if (loading) return <SPLoader />;

    return (
        <div className="space-y-6 pb-10 pt-6 relative min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LinkedIn Chats</h1>
                    <p className="text-slate-500 text-sm mt-1">Conversations synced from the &quot;Conversations&quot; Google Sheet</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 h-10 px-4">
                    <RefreshCw className="h-4 w-4" /> Refresh Chat
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input className="pl-10 bg-white" placeholder="Search by company, title, or message..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={`h-10 gap-1.5 text-xs font-bold px-4 ${accountFilter.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}`}>
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
            </div>

            <Card className="border-border shadow-sm bg-white overflow-hidden">
                {filteredThreads.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">No LinkedIn conversations found.</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Account</th>
                                <th className="px-4 py-3">Lead</th>
                                <th className="px-4 py-3 text-center">Messages</th>
                                <th className="px-4 py-3">Last Message</th>
                                <th className="px-4 py-3 text-right">Last Contacted</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredThreads.map((thread, idx) => {
                                const lastMsg = thread.messages[thread.messages.length - 1];
                                return (
                                    <tr key={`${thread.chatId}-${idx}`} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedThread(thread)}>
                                        <td className="px-4 py-3">
                                            <LinkedInAccountBadge accountId={thread.accountId} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-900 group-hover:text-blue-700">
                                                {thread.lead?.companyName || thread.personId}
                                            </div>
                                            <div className="text-xs text-slate-500">{thread.lead?.title || thread.providerId}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-700">{thread.messages.length}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[320px] truncate">{lastMsg?.message || "—"}</td>
                                        <td className="px-4 py-3 text-right text-slate-500 text-xs text-nowrap">
                                            {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </Card>

            <Dialog open={!!selectedThread} onOpenChange={(open) => !open && setSelectedThread(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>LinkedIn Chat Detail</DialogTitle></DialogHeader>
                    {selectedThread && <LinkedInChatDetail thread={selectedThread} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function LinkedInChatDetail({ thread }: { thread: LinkedInConversationThread }) {
    const lead = thread.lead;
    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden max-h-[85vh]">
            <div className="flex items-center justify-between shrink-0 pr-12">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">{lead?.companyName || thread.personId}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span>{lead?.title || thread.providerId}</span>
                        <LinkedInAccountBadge accountId={thread.accountId} />
                    </div>
                </div>
                {lead?.linkedIn && (
                    <a
                        href={lead.linkedIn.startsWith('http') ? lead.linkedIn : `https://${lead.linkedIn}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-bold"
                    >
                        View Profile <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                <div className="lg:col-span-2 flex flex-col bg-white border border-border rounded-xl shadow-sm overflow-hidden h-full min-h-0">
                    <div className="bg-slate-50/50 border-b border-border p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversation Timeline</h3>
                        <div className="text-[10px] text-slate-400 font-bold">{thread.messages.length} Messages</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {thread.messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                <MessageSquare className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No messages found for this conversation.</p>
                            </div>
                        ) : (
                            thread.messages.map((msg, idx) => (
                                <div key={idx} className="flex flex-col items-end">
                                    <div className="max-w-[85%] rounded-2xl p-4 shadow-sm bg-blue-600 text-white rounded-tr-none">
                                        <div className="flex items-center justify-between mb-2 gap-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-100">
                                                {msg.object || "Message"}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{msg.message}</p>
                                    </div>
                                    {msg.sentAt && (
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {new Date(msg.sentAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 h-full pb-4">
                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                                    <p className="font-medium text-slate-900 mt-1">{lead?.email || "—"}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                                    <p className="font-medium text-slate-900 mt-1">
                                        {lead ? [lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—" : "—"}
                                    </p>
                                </div>
                                {lead?.status && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                                        <Badge className="mt-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[10px] font-bold uppercase block w-fit">
                                            {lead.status}
                                        </Badge>
                                    </div>
                                )}
                                {lead?.connectionStatus && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Connection Status</span>
                                        <Badge className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold uppercase block w-fit">
                                            {lead.connectionStatus}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900">Activity Stats</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <StatBox label="Total Messages" value={thread.messages.length} icon={MessageSquare} />
                                <StatBox label="Sequence Step" value={lead?.sequenceStep || "—"} icon={Send} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, icon: Icon }: any) {
    return (
        <div className="p-2 px-3 bg-slate-50 rounded-lg border border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{value}</span>
        </div>
    );
}
