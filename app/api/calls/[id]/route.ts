import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// --- High-Fidelity Summary Extraction ---
function extractCallSummary(vc: any) {
    if (!vc) return "";

    // 1. Primary Source
    let summary = vc.analysis?.summary || vc.transcript_summary || "";

    // 2. Structured Data Scan
    if (!summary && (vc.analysis?.structuredData || vc.analysis?.structured_data)) {
        const sd = vc.analysis.structuredData || vc.analysis.structured_data;
        const entries = Array.isArray(sd) ? sd : Object.values(sd || {});
        for (const item of entries) {
            if (typeof item === 'object' && item !== null) {
                const name = (item.name || item.label || item.propertyName || "").toLowerCase();
                // Priority scan for keywords
                if (name.includes('summary') || name.includes('evaluation') || name.includes('call summary')) {
                    summary = item.result || item.value || item.response || "";
                    if (summary) break;
                }
            }
        }
    }

    // 3. Artifact Backup (as a last resort)
    if (!summary && vc.artifact?.messages) {
        const artMsgs = vc.artifact.messages;
        for (const msg of artMsgs) {
            if (msg.role === 'assistant' && (msg.content?.toLowerCase().includes('summary') || msg.name?.toLowerCase().includes('summary'))) {
                summary = msg.content;
                break;
            }
        }
    }

    return summary;
}


export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
        const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

        if (!supabaseUrl || !secretKey) {
            return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
        }

        const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/vapi_call_logs?id=eq.${id}&select=*`;
        const headers = { 
            "apikey": secretKey, 
            "Authorization": `Bearer ${secretKey}`,
            "Content-Type": "application/json"
        };

        const res = await fetch(url, { headers });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const db = data[0];
                return NextResponse.json({
                    id: db.id,
                    name: db.customer_name,
                    startedAt: db.started_at,
                    durationSeconds: db.duration_seconds,
                    cost: db.cost_usd > 0 ? `$${db.cost_usd.toFixed(3)}` : "$0.00",
                    costValue: db.cost_usd,
                    source: db.source,
                    status: db.status,
                    phone: db.customer_phone,
                    customer_number: db.customer_phone,
                    callSummary: db.summary,
                    audio_url: db.recording_url,
                    transcript: db.transcript,
                    type: db.type,
                    assistantId: db.assistantId,
                    vapi_account: db.vapi_account,
                    createdAt: db.created_at
                });
            }
        }

        return NextResponse.json({ error: "Call not found" }, { status: 404 });
    } catch (error) {
        console.error("Individual call fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch call details" }, { status: 500 });
    }
}

