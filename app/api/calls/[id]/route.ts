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
        const elApiKey = process.env.ELEVENLABS_API_KEY;
        const vapiPrivKey = process.env.VAPI_PRIVATE_KEY;
        const { id } = await context.params;

        // Fetch Leads for name resolution
        const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
        const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
        const leadsMap = new Map<string, string>();
        if (supabaseUrl && secretKey) {
            try {
                const headers = { "apikey": secretKey, "Authorization": `Bearer ${secretKey}` };
                const tables = ["nr_wf", "followup", "nurture"];
                const results = await Promise.all(tables.map(t => fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${t}?select=name,phone`, { headers }).then(r => r.json())));
                results.forEach(data => {
                    if (Array.isArray(data)) {
                        data.forEach(l => {
                            const clean = String(l.phone || "").replace(/\D/g, '');
                            if (clean && l.name) leadsMap.set(clean, l.name);
                        });
                    }
                });
            } catch (e) { }
        }

        const vapiPhoneMap = new Map<string, string>();
        // Manual Overrides (User Provided) for high-fidelity identification
        vapiPhoneMap.set('4a7e7a31-0bbc-4fde-831e-2489119ee226', '17624000439');
        vapiPhoneMap.set('e66fe46b-9fe2-4628-a32b-08ced680bc04', '97144396291');
        vapiPhoneMap.set('4baf3613-ba3d-4860-9ea1-62156686b6f1', '447462179309');
        vapiPhoneMap.set('66dff692-d2a5-47d4-bbe0-245509dc7404', '14782159151');
        vapiPhoneMap.set('d91ba874-2522-4d62-adf6-681f2a0bf4fe', '97148714150');

        if (vapiPrivKey) {
            try {
                const res = await fetch('https://api.vapi.ai/phone-number', {
                    headers: { 'Authorization': `Bearer ${vapiPrivKey}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    (Array.isArray(data) ? data : (data.data || [])).forEach((p: any) => {
                        if (p.id && (p.number || p.phoneNumber)) vapiPhoneMap.set(p.id, String(p.number || p.phoneNumber).replace(/\D/g, ''));
                    });
                }
            } catch (e) { }
        }

        const resolveName = (rawName: string, phone: string) => {
            const cleanPhone = String(phone || "").replace(/\D/g, '');
            if (leadsMap.has(cleanPhone)) return leadsMap.get(cleanPhone);
            if (rawName && /^\d+$/.test(rawName.replace(/\D/g, '')) && rawName.length > 5) return "Guest";
            return rawName || "Guest";
        };

        // Since Vapi is currently the primary provider, try it first for speed
        if (vapiPrivKey) {
            try {
                const vapiRes = await fetch(`https://api.vapi.ai/call/${id}`, {
                    headers: { 'Authorization': `Bearer ${vapiPrivKey}`, 'Content-Type': 'application/json' }
                });

                if (vapiRes.ok) {
                    const data = await vapiRes.json();
                    const customer = data.customer || {};
                    const isInbound = data.type === 'inbound';

                    // GUEST NUMBER ALWAYS COMES FROM CUSTOMER (STRICT)
                    let customerPhone = String(customer.number || "Unknown").replace(/\D/g, '');
                    if (customerPhone.length > 15) customerPhone = "Unknown";

                    // BOT NUMBER ALWAYS COMES FROM PHONENUMBER OBJECT OR CACHE
                    const rawAssistant = data.phoneNumber?.number || vapiPhoneMap.get(data.phoneNumberId) || data.phoneNumberId || "Unknown";
                    let assistantPhone = String(rawAssistant).replace(/\D/g, '');
                    if (assistantPhone.length > 15) assistantPhone = "Internal-Line";

                    return NextResponse.json({
                        ...data,
                        id: data.id,
                        name: resolveName(customer.name, customerPhone),
                        startedAt: data.startedAt,
                        durationSeconds: data.durationSeconds || 0,
                        cost: typeof data.cost === 'number' ? `$${data.cost.toFixed(3)}` : (data.cost || "$0.00"),
                        phoneNumber: assistantPhone, // Bot
                        customer_number: customerPhone, // Guest
                        phone: customerPhone !== "Unknown" ? `+${customerPhone}` : "Unknown", // Add 'phone' for modal compatibility
                        type: data.type || "Unknown",
                        isInbound,
                        source: 'vapi',
                        callSummary: extractCallSummary(data),
                        audio_url: data.recordingUrl
                    });
                }
            } catch (err) { }
        }

        // Fallback to ElevenLabs
        if (elApiKey) {
            try {
                const elResponse = await fetch(`${ELEVENLABS_BASE_URL}/convai/conversations/${id}`, {
                    headers: { 'xi-api-key': elApiKey, 'Content-Type': 'application/json' }
                });

                if (elResponse.ok) {
                    const data = await elResponse.json();
                    const dynamicVars = data.conversation_initiation_client_data?.dynamic_variables || {};
                    const durationSeconds = data.metadata?.call_duration_secs || data.call_duration_secs || data.analysis?.call_duration_secs || 0;
                    const phone = String(data.metadata?.caller_number || dynamicVars.caller_number || "Unknown").replace(/\D/g, '');
                    const rawName = data.metadata?.user_name || data.metadata?.name || dynamicVars.user_name || dynamicVars.name || "Guest";

                    return NextResponse.json({
                        ...data,
                        id: data.conversation_id,
                        name: resolveName(rawName, phone),
                        durationSeconds,
                        phoneNumber: phone,
                        source: 'elevenlabs',
                        audio_url: `${ELEVENLABS_BASE_URL}/convai/conversations/${id}/audio`
                    });
                }
            } catch (err) { }
        }

        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch conversation details" }, { status: 500 });
    }
}
