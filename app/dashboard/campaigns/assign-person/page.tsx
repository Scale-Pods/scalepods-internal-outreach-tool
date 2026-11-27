"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronLeft, UserPlus, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Search,
} from "lucide-react";
import { CampaignLabel } from "@/components/dashboard/campaign-badge";
import { SPLoader } from "@/components/sp-loader";

interface CampaignSummary {
    campaignId: number | string;
    campaignName: string;
    campaignAlias?: string | null;
    totalLeads: number;
}

type RowState = "idle" | "sending" | "success" | "error";

export default function AssignPersonPage() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const [names, setNames] = useState<Record<string, string>>({});
    const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(prev => (prev?.message === message ? null : prev)), 4000);
    };

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const [dashRes, aliasRes] = await Promise.all([
                fetch("/api/campaigns/dashboard"),
                fetch("/api/campaigns/aliases"),
            ]);
            const dashJson = await dashRes.json().catch(() => ({}));
            const aliasJson = await aliasRes.json().catch(() => ({}));

            const aliasMap: Record<string, string> = aliasJson?.aliases || {};
            const summaryList: CampaignSummary[] = dashJson.campaigns || [];
            const summaryById = new Map(summaryList.map(c => [String(c.campaignId), c]));

            // Merge Campaigns 1–10 (from /api/campaigns/aliases) with any additional campaigns from dashboard summary
            const mergedMap = new Map<string, CampaignSummary>();
            for (const c of aliasJson?.campaigns || []) {
                const key = String(c.campaignId);
                const dashMatch = summaryById.get(key);
                mergedMap.set(key, {
                    campaignId: c.campaignId,
                    campaignName: c.campaignId !== null && c.campaignId !== undefined
                        ? `ScalePods Internal Outreach ${c.campaignId}`
                        : (dashMatch?.campaignName || c.campaignName),
                    campaignAlias: c.alias || dashMatch?.campaignAlias || aliasMap[key] || null,
                    totalLeads: dashMatch?.totalLeads ?? c.totalLeads ?? 0,
                });
            }
            for (const s of summaryList) {
                const key = String(s.campaignId);
                if (!mergedMap.has(key)) {
                    mergedMap.set(key, {
                        ...s,
                        campaignName: s.campaignId !== null && s.campaignId !== undefined
                            ? `ScalePods Internal Outreach ${s.campaignId}`
                            : s.campaignName,
                        campaignAlias: s.campaignAlias || aliasMap[key] || null,
                    });
                }
            }

            const finalList = Array.from(mergedMap.values()).sort((a, b) => Number(a.campaignId) - Number(b.campaignId));
            setCampaigns(finalList);

            // Pre-fill each row's input with its current saved alias
            const prefilled: Record<string, string> = {};
            for (const c of finalList) {
                prefilled[String(c.campaignId)] = c.campaignAlias || "";
            }
            setNames(prefilled);
        } catch (err) {
            console.error("Failed to fetch campaigns:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const filteredCampaigns = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return campaigns;
        return campaigns.filter(c =>
            c.campaignName.toLowerCase().includes(q) ||
            String(c.campaignId).toLowerCase().includes(q) ||
            (c.campaignAlias || "").toLowerCase().includes(q)
        );
    }, [campaigns, searchQuery]);

    const handleAssign = async (campaign: CampaignSummary) => {
        const key = String(campaign.campaignId);
        const person = (names[key] || "").trim();
        if (!person) {
            setRowStates(prev => ({ ...prev, [key]: "error" }));
            setRowErrors(prev => ({ ...prev, [key]: "Enter a name first." }));
            return;
        }

        setRowStates(prev => ({ ...prev, [key]: "sending" }));
        setRowErrors(prev => ({ ...prev, [key]: "" }));

        try {
            const res = await fetch("/api/webhook/assign-person", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaign_id: campaign.campaignId,
                    person,
                }),
            });

            const json = await res.json().catch(() => ({}));

            if (!res.ok || json?.success === false) {
                const errMsg = json?.error || (Array.isArray(json?.errors) ? json.errors.join(", ") : "Failed to assign.");
                setRowStates(prev => ({ ...prev, [key]: "error" }));
                setRowErrors(prev => ({ ...prev, [key]: errMsg }));
                showToast(errMsg, "error");
                return;
            }

            setRowStates(prev => ({ ...prev, [key]: "success" }));
            setCampaigns(prev => prev.map(c => (String(c.campaignId) === key ? { ...c, campaignAlias: person } : c)));
            setNames(prev => ({ ...prev, [key]: person }));
            showToast(`Campaign ${campaign.campaignId} alias updated to "${person}"`, "success");
        } catch (err: any) {
            console.error("Assign person failed:", err);
            setRowStates(prev => ({ ...prev, [key]: "error" }));
            const errMsg = err.message || "Network error.";
            setRowErrors(prev => ({ ...prev, [key]: errMsg }));
            showToast(errMsg, "error");
        }
    };

    useEffect(() => {
        if (loading) {
            const main = document.querySelector('main');
            if (main) main.scrollTop = 0;
        }
    }, [loading]);

    return (
        <div className={`space-y-5 sm:space-y-6 pb-8 sm:pb-10 pt-4 sm:pt-6 px-1 sm:px-4 md:px-6 relative ${loading ? 'h-[calc(100dvh-5rem)] overflow-hidden' : 'min-h-[500px]'}`}>
            {loading && <SPLoader />}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 -ml-2" onClick={() => router.push("/dashboard/campaigns")}>
                    <ChevronLeft className="h-4 w-4" /> Back to Campaigns
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                        <UserPlus className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assign Person</h1>
                        <p className="text-sm text-slate-500">Assign a person to each campaign</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchCampaigns} className="gap-2 h-10 px-4 w-fit">
                    <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input className="pl-10 bg-white" placeholder="Search campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <Card className="border-border overflow-hidden shadow-sm">
                    <CardContent className="p-0">
                        <div className="overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                                    <tr className="border-b border-border">
                                        <th className="px-4 py-3">Campaign</th>
                                        <th className="px-4 py-3 text-center">Leads</th>
                                        <th className="px-4 py-3">Name</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredCampaigns.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">No campaigns found.</td></tr>
                                    ) : (
                                        filteredCampaigns.map(campaign => {
                                            const key = String(campaign.campaignId);
                                            const state = rowStates[key] || "idle";
                                            return (
                                                <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <CampaignLabel
                                                            campaignId={campaign.campaignId}
                                                            campaignName={campaign.campaignName}
                                                            alias={campaign.campaignAlias}
                                                            showUnassigned
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-slate-700">{campaign.totalLeads.toLocaleString()}</td>
                                                    <td className="px-4 py-3">
                                                        <Input
                                                            className="h-9 min-w-[160px] w-full max-w-xs bg-white"
                                                            placeholder="Enter alias / person name..."
                                                            value={names[key] ?? ""}
                                                            onChange={(e) => setNames(prev => ({ ...prev, [key]: e.target.value }))}
                                                            onKeyDown={(e) => { if (e.key === "Enter") handleAssign(campaign); }}
                                                        />
                                                        {state === "error" && rowErrors[key] && (
                                                            <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {rowErrors[key]}</p>
                                                        )}
                                                        {state === "success" && (
                                                            <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Assigned</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            size="sm"
                                                            className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                                                            disabled={state === "sending" || !(names[key] || "").trim()}
                                                            onClick={() => handleAssign(campaign)}
                                                        >
                                                            {state === "sending" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                                            Assign
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            {toast && (
                <div
                    role="status"
                    className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2.5 text-xs font-semibold ${
                        toast.type === "success"
                            ? "bg-emerald-950 text-emerald-100 border-emerald-700"
                            : "bg-rose-950 text-rose-100 border-rose-700"
                    }`}
                >
                    {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-rose-400" />}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
