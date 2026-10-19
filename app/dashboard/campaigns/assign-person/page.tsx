"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronLeft, UserPlus, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Search,
} from "lucide-react";
import { CampaignBadge } from "@/components/dashboard/campaign-badge";
import { SPLoader } from "@/components/sp-loader";

interface CampaignSummary {
    campaignId: number | string;
    campaignName: string;
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

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/campaigns/dashboard");
            const json = await res.json();
            setCampaigns(json.campaigns || []);
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
        const q = searchQuery.toLowerCase();
        if (!q) return campaigns;
        return campaigns.filter(c => c.campaignName.toLowerCase().includes(q) || String(c.campaignId).includes(q));
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
                setRowStates(prev => ({ ...prev, [key]: "error" }));
                setRowErrors(prev => ({ ...prev, [key]: json?.error || (Array.isArray(json?.errors) ? json.errors.join(", ") : "Failed to assign.") }));
                return;
            }

            setRowStates(prev => ({ ...prev, [key]: "success" }));
            setNames(prev => ({ ...prev, [key]: "" }));
        } catch (err: any) {
            console.error("Assign person failed:", err);
            setRowStates(prev => ({ ...prev, [key]: "error" }));
            setRowErrors(prev => ({ ...prev, [key]: err.message || "Network error." }));
        }
    };

    return (
        <div className="space-y-6 pb-10 pt-6 px-6">
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

            {loading ? (
                <SPLoader />
            ) : (
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
                                                        <CampaignBadge campaignId={campaign.campaignId} campaignName={campaign.campaignName} />
                                                        <p className="text-xs font-semibold text-slate-900 mt-1">{campaign.campaignName}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-slate-700">{campaign.totalLeads.toLocaleString()}</td>
                                                    <td className="px-4 py-3">
                                                        <Input
                                                            className="h-9 max-w-xs bg-white"
                                                            placeholder="Enter name..."
                                                            value={names[key] || ""}
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
            )}
        </div>
    );
}
