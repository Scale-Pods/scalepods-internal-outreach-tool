import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: Request) {
    try {
        const ACCESS_KEY_ID = process.env.MAQSAM_ACCESS_KEY_ID;
        const ACCESS_SECRET = process.env.MAQSAM_ACCESS_SECRET;

        if (!ACCESS_KEY_ID || !ACCESS_SECRET) {
            return NextResponse.json({ error: "Maqsam credentials missing" }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const limit = searchParams.get("limit") || "50";

        // Maqsam CDR endpoint (based on common patterns, may need adjustment)
        const endpoint = "/v1/calls";
        const method = "GET";
        const timestamp = new Date().toISOString();

        const payload = `${method}${endpoint}${timestamp}`;

        const signature = crypto
            .createHmac("sha256", ACCESS_SECRET)
            .update(payload)
            .digest("base64");

        const response = await fetch(`https://api.maqsam.com${endpoint}?limit=${limit}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-ACCESS-KEY": ACCESS_KEY_ID,
                "X-TIMESTAMP": timestamp,
                "X-SIGNATURE": signature,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: `Maqsam API error: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();

        // Normalize data for the dashboard
        // Based on search results, Maqsam likely returns direction as "inbound" / "outbound"
        const calls = (data.data || data || []).map((call: any) => ({
            id: call.id || call.uuid,
            startedAt: call.created_at || call.start_time,
            duration: call.duration || 0,
            direction: call.direction || (call.type === 'incoming' ? 'inbound' : 'outbound'),
            status: call.status,
            from: call.from,
            to: call.to,
            source: 'maqsam'
        }));

        return NextResponse.json(calls);

    } catch (err: any) {
        console.error("Maqsam Calls Error:", err);
        return NextResponse.json({
            error: err.message,
        }, { status: 500 });
    }
}
