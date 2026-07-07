import { NextResponse } from 'next/server';
import crypto from 'crypto';
import RATES_DATA from '../../../context/rates.json';


// --- Improved Helper: Number Normalization ---
function cleanPhoneNumber(num: any): string {
    if (!num) return "Unknown";
    const str = String(num).replace(/\s+/g, '').replace(/\+/g, '').replace(/\D/g, '');
    // Standard phone numbers are between 5 and 20 digits to accommodate all international formats.
    if (!str || str.length < 5 || str.length > 22) return "Unknown";
    return str;
}

// --- Improved Helper: Longest Prefix Matching ---
function getRateInfo(phoneNumber: string) {
    const cleaned = cleanPhoneNumber(phoneNumber);
    if (cleaned === "Unknown") return null;

    // Sort prefixes by length desc for priority
    const matches = RATES_DATA.filter(r => cleaned.startsWith(String(r.Prefix)));
    if (matches.length === 0) return null;
    matches.sort((a, b) => String(b.Prefix).length - String(a.Prefix).length);
    return matches[0];
}

function getCountryName(phoneNumber: string) {
    const rate = getRateInfo(phoneNumber);
    return rate?.Country || "Unknown";
}

function calculateTelephonyCost(durationSecs: number, phoneNumber: string, isInbound: boolean, providerNumber?: string) {
    if (isInbound) return durationSecs > 0 ? 0.02 : 0;
    if (!durationSecs || durationSecs <= 0) return 0;

    const pClean = (providerNumber || "").replace(/\D/g, '');
    const tClean = (phoneNumber || "").replace(/\D/g, '');

    const botIsUS = pClean.startsWith('1');
    const botIsUK = pClean.startsWith('44');
    const targetIsUAE = tClean.startsWith('971');
    const targetIsUS = tClean.startsWith('1');
    const targetIsUK = tClean.startsWith('44');

    // 🚀 Custom Twilio Partner Rates (Manual Overrides)
    if (botIsUS || botIsUK) {
        // US/UK call to UAE
        if (targetIsUAE) return (durationSecs / 60) * 0.2426;

        // US to US local
        if (botIsUS && targetIsUS) return (durationSecs / 60) * 0.013;

        // UK to UK local
        if (botIsUK && targetIsUK) return (durationSecs / 60) * 0.0305;

        // Fallback for Twilio international calls if no specific rule above is matched
        return (durationSecs / 60) * 0.05;
    }

    // Default rate lookup from rates.json for other regions/providers
    const rate = getRateInfo(tClean);
    return (durationSecs / 60) * (rate?.Rate ?? 0);
}

function calculateCostValue(durationSecs: number, phoneNumber: string, isInbound: boolean) {
    return calculateTelephonyCost(durationSecs, phoneNumber, isInbound);
}

function getMaqsamSignature(method: string, endpoint: string, timestamp: string, accessSecret: string) {
    const payload = `${method}${endpoint}${timestamp}`;
    return crypto
        .createHmac("sha256", accessSecret)
        .update(payload)
        .digest("base64");
}

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

// --- 1. Leads Cache (Supabase) ---
async function fetchLeadsCache() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !secretKey) return new Map();

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = { "apikey": secretKey, "Authorization": `Bearer ${secretKey}` };
    const leadsMap = new Map<string, string>();

    try {
        const tables = ["nr_wf", "followup", "nurture"];
        const results = await Promise.all(tables.map(t => fetch(`${baseUrl}/${t}?select=name,phone`, { headers }).then(r => r.json())));

        results.forEach(data => {
            if (Array.isArray(data)) {
                data.forEach(l => {
                    const clean = cleanPhoneNumber(l.phone);
                    if (clean !== "Unknown" && l.name) leadsMap.set(clean, l.name);
                });
            }
        });
    } catch (e) { console.error("Leads cache error:", e); }
    return leadsMap;
}

// --- 2. Vapi Phone Cache ---
async function fetchVapiPhonesCache(vapiPrivKey: string) {
    const phoneMap = new Map<string, string>();

    // 🚀 Manual Overrides (User Provided)
    phoneMap.set('4a7e7a31-0bbc-4fde-831e-2489119ee226', '17624000439');
    phoneMap.set('e66fe46b-9fe2-4628-a32b-08ced680bc04', '97144396291');
    phoneMap.set('4baf3613-ba3d-4860-9ea1-62156686b6f1', '447462179309');
    phoneMap.set('66dff692-d2a5-47d4-bbe0-245509dc7404', '14782159151');
    phoneMap.set('d91ba874-2522-4d62-adf6-681f2a0bf4fe', '97148714150');

    if (!vapiPrivKey) return phoneMap;

    try {
        const res = await fetch('https://api.vapi.ai/phone-number', {
            headers: { 'Authorization': `Bearer ${vapiPrivKey}` }
        });
        if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            list.forEach((p: any) => {
                if (p.id && (p.number || p.phoneNumber)) {
                    const clean = cleanPhoneNumber(p.number || p.phoneNumber);
                    if (clean !== "Unknown") phoneMap.set(p.id, clean);
                }
            });
        }
    } catch (e) { console.error("Vapi phone cache error:", e); }
    return phoneMap;
}

// --- 3. Supabase Archive Logic ---
async function fetchArchive(from: Date, to: Date) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !secretKey) return [];

    // Use created_at for filtering as requested
    const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/vapi_call_logs?created_at=gte.${from.toISOString()}&created_at=lte.${to.toISOString()}&order=created_at.desc&limit=10000`;
    const headers = { 
        "apikey": secretKey, 
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    try {
        const res = await fetch(url, { headers });
        if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            return list.map((db: any) => {
                const duration = db.duration_seconds || 0;
                // Agent Cost from vapi_call_logs
                const agentCost = db.cost_usd || 0;
                
                // Estimate Telephony Cost (Twilio)
                const telCost = calculateTelephonyCost(duration, db.customer_phone, db.type === 'inbound');
                
                // Total Cost is Agent + Telephony
                const totalCost = agentCost + telCost;

                const isInbound = (db.type || '').toLowerCase() === 'inbound';
                // Classify account type based on vapi_account column
                const vapiAcc = (db.vapi_account || '').toLowerCase().trim();
                let accountType: 'cold' | 'hubspot' | 'other' = 'other';
                if (vapiAcc === 'scalepods internal outreach - cold leads') accountType = 'cold';
                else if (vapiAcc === 'hubspot leads') accountType = 'hubspot';

                return {
                    id: db.id,
                    name: db.customer_name,
                    startedAt: db.started_at,
                    durationSeconds: duration,
                    cost: totalCost > 0 ? `$${totalCost.toFixed(3)}` : "$0.00",
                    costValue: totalCost,
                    breakdown: {
                        agent: agentCost,
                        telephony: telCost
                    },
                    source: db.source,
                    status: db.status,
                    phone: db.customer_phone,
                    customer_number: db.customer_phone,
                    callSummary: db.summary,
                    audio_url: db.recording_url,
                    transcript: db.transcript,
                    type: db.type,
                    isInbound,
                    assistantId: db.assistantId,
                    vapi_account: db.vapi_account,
                    accountType,
                    createdAt: db.created_at,
                    country: getCountryName(db.customer_phone)
                };
            });

        }
    } catch (e) {
        console.error("Archive fetch error:", e);
    }
    return [];
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        
        // Default to last 7 days using created_at logic
        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);
        
        let toDate = toParam ? new Date(toParam) : new Date();
        toDate.setHours(23, 59, 59, 999);

        // Fetch exclusively from archive
        const results = await fetchArchive(fromDate, toDate);

        return NextResponse.json(results);

    } catch (globalErr) {
        console.error("Global calls API error:", globalErr);
        return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
}


