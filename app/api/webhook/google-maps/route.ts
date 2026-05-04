import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const webhookUrl = process.env.GOOGLE_MAPS_SCRAPPER_WEBHOOK_URL || "https://n8n.srv1010832.hstgr.cloud/webhook/scalepods_gmap";
        
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to trigger n8n webhook" }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Proxy error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
