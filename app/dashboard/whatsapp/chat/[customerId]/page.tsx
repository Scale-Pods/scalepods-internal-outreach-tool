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
                const res = await fetch(`/api/public/chat/${encodeURIComponent(decodedCustomerId)}`);
                if (res.ok) {
                    const data = await res.json();
                    setLead(data.lead || null);
                } else {
                    setLead(null);
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
