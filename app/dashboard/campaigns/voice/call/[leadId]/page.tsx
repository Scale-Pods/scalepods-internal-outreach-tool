"use client";

import { use, useEffect, useState } from "react";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { PhoneOff } from "lucide-react";

export default function SharedCampaignCallPage({ params }: { params: Promise<{ leadId: string }> }) {
    const { leadId } = use(params);
    const decodedLeadId = decodeURIComponent(leadId);

    const [call, setCall] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const fetchCall = async () => {
            setLoading(true);
            setNotFound(false);
            try {
                const res = await fetch(`/api/public/campaign-call/${encodeURIComponent(decodedLeadId)}`);
                if (res.ok) {
                    const data = await res.json();
                    const c = data.call;
                    const lead = data.lead;
                    setCall(c ? {
                        id: c.vapiCallId || c.id,
                        leadId: lead?.id || null,
                        vapiCallId: c.vapiCallId,
                        type: c.isInbound ? 'inbound' : 'outbound',
                        name: c.leadName || lead?.name,
                        phone: c.phone || lead?.phone,
                        startedAt: c.callDate,
                        durationSeconds: c.durationSeconds,
                        status: c.status,
                        cost: c.costUsd !== null && c.costUsd !== undefined ? `$${c.costUsd.toFixed(2)}` : 'N/A',
                        callSummary: c.summary,
                        audio_url: c.recordingUrl,
                        transcript: c.transcript,
                        note: c.note,
                        campaignName: c.campaignName,
                        callNumber: c.callNumber,
                    } : null);
                    if (!c) setNotFound(true);
                } else {
                    setNotFound(true);
                }
            } catch (err) {
                console.error("Error fetching shared call:", err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };
        fetchCall();
    }, [decodedLeadId]);

    if (loading) {
        return (
            <div className="flex-1 w-full h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-400">
                <p className="font-medium">Loading call details...</p>
            </div>
        );
    }

    if (notFound || !call) {
        return (
            <div className="flex-1 w-full h-[70vh] flex flex-col items-center justify-center gap-3 text-slate-400">
                <PhoneOff className="h-12 w-12 opacity-20" />
                <p className="font-medium">This call could not be found</p>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full">
            <CallDetailsModal
                open={true}
                onOpenChange={() => {}}
                call={call}
                isPublic
            />
        </div>
    );
}
