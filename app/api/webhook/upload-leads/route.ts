import { NextResponse } from "next/server";

// Proxies a multipart/form-data lead upload (file + source + upload_id +
// campaign_id/campaign_key + source_file) straight through to the n8n
// webhook — the body is forwarded as-is since it must stay multipart, not JSON.
export async function POST(request: Request) {
    try {
        const webhookUrl = process.env.UPLOAD_LEADS_WEBHOOK_URL || "https://n8n.srv1010832.hstgr.cloud/webhook/scalepods-leadupload";

        const formData = await request.formData();

        const response = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
        });

        const text = await response.text();
        let data: any = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

        if (!response.ok) {
            return NextResponse.json(data || { error: "Failed to trigger upload webhook" }, { status: response.status });
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error("Upload leads proxy error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
