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
        
        // Default to last 7 days if no range provided
        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);
        
        let toDate = toParam ? new Date(toParam) : new Date();
        if (!toParam) toDate.setHours(23, 59, 59, 999); // Only set end of day if it's the default "now" 
        else toDate.setHours(23, 59, 59, 999); // Safe to normalize to end of day if we expect day-level granularity

        // --- 1.2. Twilio Telephony Aggregation ---
        // Fetch real-time billing data from Twilio (BYOC carrier)
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        let twilioLookup: Map<string, any> = new Map();

        try {
            if (twilioSid && twilioToken) {
                console.log(`[TwilioSync] Syncing billing for account: ${twilioSid}`);
                const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json?PageSize=500`, {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
                    }
                });
                if (twRes.ok) {
                    const twData = await twRes.json();
                    const callArray = twData.calls || [];
                    console.log(`[TwilioSync] Successfully fetched ${callArray.length} billing records`);
                    callArray.forEach((c: any) => {
                        const to = cleanPhoneNumber(c.to);
                        const from = cleanPhoneNumber(c.from);
                        const key = `${to}_${from}_${new Date(c.start_time).getTime().toString().substring(0, 7)}`;
                        twilioLookup.set(key, c);
                    });
                } else {
                    console.error(`[TwilioSync] Failed: ${twRes.status} ${twRes.statusText}`);
                }
            }
        } catch (e) {
            console.error("Twilio fetch fail:", e);
        }

        // --- 1.5. Vapi Aggregation ---
        let vapiNormalized: any[] = [];
        try {
            const vapiPrivKey = process.env.VAPI_PRIVATE_KEY;
            if (vapiPrivKey) {
                let allVapiCalls: any[] = [];
                let hasMoreVapi = true;
                const vapiAgentId = process.env.VAPI_AGENT_ID;
                const batchSize = 100;
                let lastCreatedAt = null;

                while (hasMoreVapi) {
                    let vapiListUrl = `https://api.vapi.ai/call?limit=${batchSize}`;
                    if (vapiAgentId) vapiListUrl += `&assistantId=${vapiAgentId}`;
                    
                    if (fromDate) vapiListUrl += `&createdAtGe=${fromDate.toISOString()}`;
                    if (toDate) vapiListUrl += `&createdAtLe=${toDate.toISOString()}`;
                    
                    if (lastCreatedAt) {
                        vapiListUrl += `&createdAtLe=${lastCreatedAt}`;
                    }

                    const vapiRes = await fetch(vapiListUrl, {
                        headers: { 'Authorization': `Bearer ${vapiPrivKey}`, 'Content-Type': 'application/json' }
                    });

                    if (!vapiRes.ok) break;
                    const vapiListData = await vapiRes.json();
                    const list = Array.isArray(vapiListData) ? vapiListData : (vapiListData.data || []);

                    if (list.length === 0) break;

                    const newList = list.filter((c: any) => !allVapiCalls.find((existing: any) => existing.id === c.id));
                    if (newList.length === 0) break;

                    allVapiCalls = [...allVapiCalls, ...newList];

                    const oldestCall = list[list.length - 1];
                    lastCreatedAt = oldestCall.createdAt;

                    if (list.length < batchSize) hasMoreVapi = false;
                    if (allVapiCalls.length > 5000) break; 
                }

                vapiNormalized = allVapiCalls.map((vc: any) => {
                    const isInbound = vc.type === 'inbound';
                    const customer = vc.customer || {};
                    const phoneRaw = cleanPhoneNumber(customer.number);
                    const durationPref = vc.durationSeconds ?? vc.duration ?? 0;
                    if (!vc.startedAt) return null;
                    const startedAt = vc.startedAt;
                    const endedAt = vc.endedAt;

                    let safeDuration = durationPref;
                    if (safeDuration === 0 && endedAt && startedAt) {
                        safeDuration = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
                    }

                    const rateEntry: any = getRateInfo(phoneRaw);
                    const agentCost = vc.cost || 0;

                    const assistantNumRaw = vc.phoneNumber?.number || vapiPhoneCache.get(vc.phoneNumberId) || vc.phoneNumberId || vc.phoneCallProviderId || "Unknown";
                    let vapiAssistantNum = cleanPhoneNumber(assistantNumRaw);

                    if (vapiAssistantNum === "Unknown" && (vc.phoneNumberId || vc.phoneCallProviderId)) {
                        vapiAssistantNum = "Internal-Line";
                    }

                    const vapiTimeKey = `${phoneRaw}_${vapiAssistantNum}_${new Date(startedAt).getTime().toString().substring(0, 7)}`;
                    const twMatched = twilioLookup.get(vapiTimeKey);

                    let vapiTelephonyCost = 0;
                    if (twMatched) {
                        vapiTelephonyCost = Math.abs(parseFloat(twMatched.price || 0));
                        if (isNaN(vapiTelephonyCost)) vapiTelephonyCost = 0;
                    }

                    // Always calculate fallback if we don't have a Twilio match
                    if (vapiTelephonyCost === 0) {
                        vapiTelephonyCost = calculateTelephonyCost(safeDuration, phoneRaw, isInbound, vapiAssistantNum);
                    }

                    // Sum both Vapi's reported cost and our calculated telephony cost
                    // Vapi (Platform/AI) + Telephony (Carrier) = Total Unified Cost
                    const vapiTotalCost = agentCost + vapiTelephonyCost;

                    let vapiName = customer.name || "Guest";
                    if (vapiName === "Guest" || !vapiName || (vapiName && /^\d+$/.test(vapiName.replace(/\D/g, '')) && vapiName.length > 5)) {
                        const metadata = vc.metadata || {};
                        const overrides = vc.assistantOverrides?.variableValues || {};
                        vapiName = metadata.customerName || metadata.name || overrides.customerName || overrides.name || "Guest";
                    }

                    const resolvedFromLead = leadsCache.get(phoneRaw);
                    if (resolvedFromLead) vapiName = resolvedFromLead;

                    if (vapiName && /^\d+$/.test(vapiName.replace(/\D/g, '')) && vapiName.length > 5) {
                        vapiName = "Guest";
                    }

                    return {
                        id: vc.id,
                        name: vapiName,
                        startedAt: startedAt,
                        durationSeconds: safeDuration,
                        cost: vapiTotalCost > 0 ? `$${vapiTotalCost.toFixed(3)}` : "$0.00",
                        costValue: vapiTotalCost,
                        breakdown: {
                            // Agent cost is now exactly what Vapi reports (Platform fee)
                            agent: agentCost,
                            telephony: vapiTelephonyCost,
                            total: vapiTotalCost
                        },
                        type: isInbound ? "Inbound" : "Outbound",
                        isInbound,
                        phone: phoneRaw !== "Unknown" ? `+${phoneRaw}` : "Unknown",
                        country: rateEntry?.Country || "Unknown",
                        source: 'vapi',
                        status: vc.status === 'completed' ? 'answered' : (vc.status || 'answered'),
                        phoneNumber: vapiAssistantNum,
                        customer_number: phoneRaw !== "Unknown" ? `+${phoneRaw}` : "Unknown",
                        callSummary: extractCallSummary(vc),
                        raw: vc
                    };
                }).filter(Boolean);
            }
        } catch (e) {
            console.error("Vapi aggregation fail:", e);
        }

        // --- 2. Maqsam Aggregation ---
        let maqsamNormalized: any[] = [];
        try {
            const mKey = process.env.MAQSAM_ACCESS_KEY_ID;
            const mSecret = process.env.MAQSAM_ACCESS_SECRET;
            const mBase = process.env.MAQSAM_BASE_URL || 'maqsam.com';

            if (mKey && mSecret) {
                const method = "GET";
                const fetchMaqsam = async (endpoint: string, useBasic: boolean) => {
                    const timestamp = new Date().toISOString();
                    const mUrl = `https://api.${mBase}${endpoint}`;
                    const headers: any = { "Accept": "application/json" };
                    if (useBasic) {
                        headers["Authorization"] = `Basic ${Buffer.from(`${mKey}:${mSecret}`).toString('base64')}`;
                    } else {
                        const payload = `${method}${endpoint}${timestamp}`;
                        headers["X-ACCESS-KEY"] = mKey;
                        headers["X-TIMESTAMP"] = timestamp;
                        headers["X-SIGNATURE"] = crypto.createHmac("sha256", mSecret).update(payload).digest("base64");
                    }
                    return fetch(mUrl, { method, headers });
                };

                let allMaqsamCalls: any[] = [];
                let mPage = 1;
                let hasMoreMaqsam = true;
                const MAX_M_PAGES = 50; // Batch fetch up to 5000 calls to stay accurate across channels

                while (hasMoreMaqsam && mPage <= MAX_M_PAGES) {
                    let mRes = await fetchMaqsam(`/v2/calls?page=${mPage}&limit=100`, true);
                    if (!mRes.ok) {
                        mRes = await fetchMaqsam("/v1/account/calls", false); // Fallback to older API
                        hasMoreMaqsam = false;
                    }

                    if (mRes.ok) {
                        const mData = await mRes.json();
                        const mcList = Array.isArray(mData.message) ? mData.message : (mData.data || mData.calls || []);
                        if (mcList.length === 0) break;

                        allMaqsamCalls = [...allMaqsamCalls, ...mcList];
                        if (mcList.length < 100) hasMoreMaqsam = false;
                        mPage++;
                    } else break;
                }

                maqsamNormalized = allMaqsamCalls.map((mc: any) => {
                    const direction = (mc.direction || "").toLowerCase();
                    const isInbound = direction === 'inbound' || direction === 'incoming';
                    const callerNum = cleanPhoneNumber(mc.callerNumber || mc.caller || mc.from);
                    const calleeNum = cleanPhoneNumber(mc.calleeNumber || mc.callee || mc.to);
                    const phoneRaw = isInbound ? callerNum : calleeNum;

                    const nameValue = isInbound ? (mc.caller || mc.contact_name) : (mc.callee || mc.contact_name);
                    const isNotNumber = nameValue && !nameValue.match(/^\+?\d+$/);

                    const mcDuration = parseInt(mc.duration || 0);
                    // Priority: Native cost from Maqsam > Internal Rate calculation
                    const nativePrice = parseFloat(mc.price || mc.cost || 0);
                    const internalRate = calculateTelephonyCost(mcDuration, phoneRaw, isInbound);
                    const mCostTelephony = nativePrice > 0 ? nativePrice : internalRate;
                    const mCostTotal = mCostTelephony;

                    return {
                        id: (mc.id || mc.uuid || Math.random()).toString(),
                        name: isNotNumber ? nameValue : "Guest",
                        startedAt: mc.timestamp ? new Date(mc.timestamp * 1000).toISOString() : (mc.start_time || mc.created_at || new Date().toISOString()),
                        durationSeconds: mcDuration,
                        cost: mCostTotal > 0 ? `$${mCostTotal.toFixed(3)}` : "$0.00",
                        costValue: mCostTotal,
                        breakdown: {
                            agent: 0,
                            telephony: mCostTelephony,
                            total: mCostTotal
                        },
                        type: isInbound ? "Inbound" : (mc.type === 'campaign' ? "Campaign" : "Outbound"),
                        isInbound,
                        phone: phoneRaw !== "Unknown" ? `+${phoneRaw}` : "Unknown",
                        country: getRateInfo(phoneRaw)?.Country || "Unknown",
                        source: 'maqsam',
                        status: (mc.state === 'completed' || mc.state === 'serviced' || mc.status === 'answered') ? 'answered' : (mc.state || mc.status || 'answered')
                    };
                });
            }
        } catch (e) {
            console.error("Maqsam aggregation fail:", e);
        }

        // --- 3. Final Aggregation ---
        const final = [...maqsamNormalized, ...vapiNormalized].sort((a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );

        return NextResponse.json(final);

    } catch (globalErr) {
        console.error("Global calls API error:", globalErr);
        return NextResponse.json({ error: "Aggregation failed" }, { status: 500 });
    }
}
