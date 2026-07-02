import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Since we don't have the exact webhook URL for the execution step provided in the instructions,
        // we fallback to the same webhook or expect LINKEDIN_EXECUTE_WEBHOOK_URL
        const webhookUrl = process.env.LINKEDIN_EXECUTE_WEBHOOK_URL || process.env.LINKEDIN_SCRAPPER_WEBHOOK_URL;

        if (!webhookUrl) {
            return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 });
        }
        
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
