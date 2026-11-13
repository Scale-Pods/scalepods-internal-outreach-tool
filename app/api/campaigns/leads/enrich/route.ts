import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const webhookUrl = process.env.LEADS_ENRICH_PIPELINE_WEBHOOK_URL || "https://n8n.srv1010832.hstgr.cloud/webhook/leads/enrich-pipeline";

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

        if (!response.ok) {
            return NextResponse.json(data || { error: "Failed to trigger leads enrichment webhook" }, { status: response.status });
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error("Leads enrichment proxy error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
