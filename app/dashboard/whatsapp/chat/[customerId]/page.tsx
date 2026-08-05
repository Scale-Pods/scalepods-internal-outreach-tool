"use client";

import { use, useEffect, useState } from "react";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import type { NormalizedWaLead } from "@/lib/services/whatsapp-outreach";

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = use(params);
    const decodedCustomerId = decodeURIComponent(customerId);
    const [lead, setLead] = useState<NormalizedWaLead | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLead = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/whatsapp/outreach');
                if (res.ok) {
                    const data = await res.json();
                    const allLeads: NormalizedWaLead[] = [...(data.cold?.leads || []), ...(data.hot?.leads || []), ...(data.hubspotWa?.leads || [])];
                    const searchVal = decodedCustomerId.toLowerCase().trim();
                    const found = allLeads.find(l => {
                        if (l.id.toLowerCase() === searchVal) return true;
                        const normalized = l.phone.replace(/\D/g, '');
                        const searchNormalized = searchVal.replace(/\D/g, '');
                        return !!searchNormalized && normalized === searchNormalized;
                    });
                    setLead(found || null);
                }
            } catch (err) {
                console.error("Error fetching lead:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLead();
    }, [decodedCustomerId]);

    return (
        <div className="flex-1 w-full h-full">
            <WhatsAppChatDetail lead={lead} loading={loading} />
        </div>
    );
}
