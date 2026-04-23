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

    const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/vapi_call_logs?started_at=gte.${from.toISOString()}&started_at=lte.${to.toISOString()}&order=started_at.desc`;
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
            return list.map((db: any) => ({
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
                raw: db.raw_data
            }));
        }
    } catch (e) {
        console.error("Archive fetch error:", e);
    }
    return [];
}

async function syncToSupabase(liveCalls: any[]) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!supabaseUrl || !secretKey || !liveCalls.length) return;

    // 1. Filter for the last 7 days only (keeps it lightweight)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCalls = liveCalls.filter(c => c.startedAt && new Date(c.startedAt) >= sevenDaysAgo);

    if (recentCalls.length === 0) return;

    const tableUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/vapi_call_logs`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    };

    // 2. Map to DB schema
    const records = recentCalls.map(c => ({
        id: c.id,
        started_at: c.startedAt,
        customer_phone: c.phone || c.customer_number || "Unknown",
        customer_name: c.name || "Guest",
        duration_seconds: c.durationSeconds || 0,
        status: c.status || "answered",
        cost_usd: c.costValue || 0,
        source: c.source || "vapi",
        transcript: c.raw?.artifact?.messages || c.raw?.transcript || null,
        summary: c.callSummary || "",
        recording_url: c.audio_url || c.raw?.recordingUrl || null,
        raw_data: c.raw
    }));

    // 3. Split into chunks of 70 (prevents DB overload)
    for (let i = 0; i < records.length; i += 70) {
        const chunk = records.slice(i, i + 70);
        try {
            await fetch(tableUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(chunk)
            });
        } catch (err) {
            console.error("Sync chunk error:", err);
        }
    }
}

async function fetchElevenLabs(fromDate: Date, toDate: Date, leadsCache: Map<string, string>) {
    const elApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elApiKey) return [];
    
    try {
        const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?page_size=100`, {
            headers: { 'xi-api-key': elApiKey }
        });
        if (res.ok) {
            const data = await res.json();
            const list = data.conversations || [];
            
            return list.filter((c: any) => {
                const start = new Date(c.start_time_unix * 1000);
                return start >= fromDate && start <= toDate;
            }).map((c: any) => {
                const phone = String(c.metadata?.caller_number || "").replace(/\D/g, '') || "Unknown";
                const name = leadsCache.get(phone) || c.metadata?.user_name || "Guest";
                return {
                    id: c.conversation_id,
                    name: name,
                    startedAt: new Date(c.start_time_unix * 1000).toISOString(),
                    durationSeconds: c.call_duration_secs || 0,
                    cost: "$0.00",
                    costValue: 0,
                    source: 'elevenlabs',
                    status: 'answered',
                    phone: phone !== "Unknown" ? `+${phone}` : "Unknown",
                    customer_number: phone !== "Unknown" ? `+${phone}` : "Unknown",
                    audio_url: `https://api.elevenlabs.io/v1/convai/conversations/${c.conversation_id}/audio`,
                    raw: c
                };
            });
        }
    } catch (e) {
        console.error("ElevenLabs fetch error:", e);
    }
    return [];
}

export async function GET(req: Request) {
    try {
        const vapiPrivKey = process.env.VAPI_PRIVATE_KEY || "";
        const [leadsCache, vapiPhoneCache] = await Promise.all([
            fetchLeadsCache(),
            fetchVapiPhonesCache(vapiPrivKey)
        ]);

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        
        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);
        
        let toDate = toParam ? new Date(toParam) : new Date();
        toDate.setHours(23, 59, 59, 999);

        // --- 1. Fetch from live APIs (Vapi / ElevenLabs / Maqsam) ---
        
        // 1.1. Twilio Telephony Aggregation (for Vapi cost calculation)
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        let twilioLookup: Map<string, any> = new Map();

        try {
            if (twilioSid && twilioToken) {
                const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json?PageSize=1000`, {
                    headers: { 'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64') }
                });
                if (twRes.ok) {
                    const twData = await twRes.json();
                    (twData.calls || []).forEach((c: any) => {
                        const to = cleanPhoneNumber(c.to);
                        const from = cleanPhoneNumber(c.from);
                        const key = `${to}_${from}_${new Date(c.start_time).getTime().toString().substring(0, 7)}`;
                        twilioLookup.set(key, c);
                    });
                }
            }
        } catch (e) { console.error("Twilio fetch fail:", e); }

        // Fetching Live and Archived Data in Parallel
        const [vapiCalls, maqsamCalls, elevenLabsCalls, archivedCalls] = await Promise.all([
            fetchVapiLive(fromDate, toDate, vapiPrivKey, vapiPhoneCache, leadsCache, twilioLookup),
            fetchMaqsamLive(),
            fetchElevenLabs(fromDate, toDate, leadsCache),
            fetchArchive(fromDate, toDate)
        ]);

        const liveResults = [...vapiCalls, ...maqsamCalls, ...elevenLabsCalls];

        // --- 2. MERGE & DEDUPLICATE ---
        // Use a Map with 'id' as key. Prioritize live API data if it exists in both.
        const mergedMap = new Map<string, any>();
        
        // Add archived data first (safely)
        if (Array.isArray(archivedCalls)) {
            archivedCalls.forEach(call => {
                if (call && call.id) {
                    mergedMap.set(String(call.id), call);
                }
            });
        }
        
        // Overwrite with live data (ensures latest versions/live statuses)
        if (Array.isArray(liveResults)) {
            liveResults.forEach(call => {
                if (call && call.id) {
                    mergedMap.set(String(call.id), call);
                }
            });
        }

        const finalResults = Array.from(mergedMap.values()).sort((a, b) => {
            const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
            const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
            return timeB - timeA;
        });

        // --- 3. Trigger Sync: Background Sync for last 7 days ---
        syncToSupabase(liveResults).catch(err => console.error("Background sync failed:", err));

        return NextResponse.json(finalResults);

    } catch (globalErr) {
        console.error("Global calls API error:", globalErr);
        return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
    }
}

// --- Helper for Vapi Live Fetching ---
async function fetchVapiLive(fromDate: Date, toDate: Date, vapiPrivKey: string, vapiPhoneCache: Map<string, string>, leadsCache: Map<string, string>, twilioLookup: Map<string, any>) {
    if (!vapiPrivKey) return [];
    let allVapiCalls: any[] = [];
    try {
        const vapiAgentId = process.env.VAPI_AGENT_ID;
        const batchSize = 100;
        let lastCreatedAt = null;
        let hasMore = true;

        while (hasMore) {
            let url = `https://api.vapi.ai/call?limit=${batchSize}`;
            if (vapiAgentId) url += `&assistantId=${vapiAgentId}`;
            if (fromDate) url += `&createdAtGe=${fromDate.toISOString()}`;
            if (toDate) url += `&createdAtLe=${toDate.toISOString()}`;
            if (lastCreatedAt) url += `&createdAtLe=${lastCreatedAt}`;

            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${vapiPrivKey}` } });
            if (!res.ok) break;
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.data || []);
            if (list.length === 0) break;

            const newList = list.filter((c: any) => !allVapiCalls.find(e => e.id === c.id));
            if (newList.length === 0) break;

            allVapiCalls = [...allVapiCalls, ...newList];
            lastCreatedAt = list[list.length - 1].createdAt;
            if (list.length < batchSize || allVapiCalls.length > 2000) hasMore = false;
        }

        return allVapiCalls.map(vc => {
            const isInbound = vc.type === 'inbound';
            const customer = vc.customer || {};
            const phoneRaw = cleanPhoneNumber(customer.number);
            let safeDuration = vc.durationSeconds ?? vc.duration ?? 0;
            if (safeDuration === 0 && vc.endedAt && vc.startedAt) {
                safeDuration = (new Date(vc.endedAt).getTime() - new Date(vc.startedAt).getTime()) / 1000;
            }

            const assistantNumRaw = vc.phoneNumber?.number || vapiPhoneCache.get(vc.phoneNumberId) || vc.phoneNumberId || "Unknown";
            let assistantPhone = cleanPhoneNumber(assistantNumRaw);
            const vapiTimeKey = `${phoneRaw}_${assistantPhone}_${new Date(vc.startedAt).getTime().toString().substring(0, 7)}`;
            const twMatched = twilioLookup.get(vapiTimeKey);

            let telephonyCost = twMatched ? Math.abs(parseFloat(twMatched.price || 0)) : calculateTelephonyCost(safeDuration, phoneRaw, isInbound, assistantPhone);
            const totalCost = (vc.cost || 0) + (telephonyCost || 0);

            let name = customer.name || "Guest";
            const resolved = leadsCache.get(phoneRaw);
            if (resolved) name = resolved;

            return {
                id: vc.id,
                name: name,
                startedAt: vc.startedAt,
                durationSeconds: safeDuration,
                cost: totalCost > 0 ? `$${totalCost.toFixed(3)}` : "$0.00",
                costValue: totalCost,
                type: isInbound ? "Inbound" : "Outbound",
                isInbound,
                phone: phoneRaw !== "Unknown" ? `+${phoneRaw}` : "Unknown",
                customer_number: phoneRaw !== "Unknown" ? `+${phoneRaw}` : "Unknown",
                source: 'vapi',
                status: vc.status === 'completed' ? 'answered' : (vc.status || 'answered'),
                callSummary: extractCallSummary(vc),
                raw: vc
            };
        }).filter(Boolean);
    } catch (e) { console.error("Vapi fetch error:", e); return []; }
}

async function fetchMaqsamLive() {
    const mKey = process.env.MAQSAM_ACCESS_KEY_ID;
    const mSecret = process.env.MAQSAM_ACCESS_SECRET;
    if (!mKey || !mSecret) return [];

    try {
        const auth = Buffer.from(`${mKey}:${mSecret}`).toString('base64');
        const res = await fetch(`https://api.maqsam.com/v2/calls?limit=100`, {
            headers: { "Authorization": `Basic ${auth}`, "Accept": "application/json" }
        });
        if (res.ok) {
            const data = await res.json();
            const list = data.data || data.message || [];
            return list.map((mc: any) => {
                const direction = (mc.direction || "").toLowerCase();
                const isInbound = direction === 'inbound' || direction === 'incoming';
                const phone = cleanPhoneNumber(isInbound ? (mc.callerNumber || mc.from) : (mc.calleeNumber || mc.to));
                const cost = parseFloat(mc.cost || mc.price || 0) || calculateTelephonyCost(mc.duration || 0, phone, isInbound);
                return {
                    id: String(mc.id || mc.uuid),
                    name: "Guest",
                    startedAt: mc.timestamp ? new Date(mc.timestamp * 1000).toISOString() : (mc.created_at || new Date().toISOString()),
                    durationSeconds: parseInt(mc.duration || 0),
                    cost: cost > 0 ? `$${cost.toFixed(3)}` : "$0.00",
                    costValue: cost,
                    type: isInbound ? "Inbound" : "Outbound",
                    isInbound,
                    phone: phone !== "Unknown" ? `+${phone}` : "Unknown",
                    customer_number: phone !== "Unknown" ? `+${phone}` : "Unknown",
                    source: 'maqsam',
                    status: (mc.status === 'answered' || mc.state === 'completed') ? 'answered' : (mc.status || 'answered'),
                    raw: mc
                };
            });
        }
    } catch (e) { console.error("Maqsam fetch error:", e); }
    return [];
}

