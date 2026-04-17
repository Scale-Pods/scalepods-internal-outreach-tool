"use client";

import React from "react";

export default function VoiceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="h-full overflow-hidden">
            {children}
        </div>
    );
}
