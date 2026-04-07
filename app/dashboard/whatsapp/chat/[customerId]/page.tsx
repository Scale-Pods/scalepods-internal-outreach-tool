"use client";

import { use } from "react";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = use(params);

    const decodedCustomerId = decodeURIComponent(customerId);

    return (
        <div className="flex-1 w-full h-full">
            <WhatsAppChatDetail customerId={decodedCustomerId} />
        </div>
    );
}
