"use client";

import React from "react";
import { usePathname } from "next/navigation";

export default function WhatsappLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // If it's the specific chat page, make it a standalone view without the sidebar padding
    const isSpecificChat = pathname.startsWith("/dashboard/whatsapp/chat/") && pathname !== "/dashboard/whatsapp/chat";
    
    if (isSpecificChat) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
                <main className="w-full max-w-5xl h-[90vh] bg-card rounded-2xl shadow-xl overflow-hidden border border-border p-2 sm:p-6 flex flex-col relative">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <>
            {children}
        </>
    );
}
