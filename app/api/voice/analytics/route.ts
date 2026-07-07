import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const COLD_LEADS_ACCOUNT = "Scalepods Internal outreach - cold leads";
const HUBSPOT_LEADS_ACCOUNT = "hubspot leads";

// Normalize phone: strip all non-digits
function cleanPhone(num: any): string {
    if (!num) return "";
    return String(num).replace(/\D/g, '');
}

// Add + prefix if missing (for matching customer_phone stored with +)
function normalizeCustomerPhone(num: any): string {
    if (!num) return "";
    const str = String(num).trim();
    return str.startsWith('+') ? str.replace(/\D/g, '') : str.replace(/\D/g, '');
}

// Phone suffix match (last 9 digits)
function phonesMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    const ca = a.replace(/\D/g, '');
    const cb = b.replace(/\D/g, '');
    if (!ca || !cb) return false;
    return ca === cb ||
        (ca.length > 8 && cb.length > 8 && ca.slice(-9) === cb.slice(-9));
}

const POSITIVE_SENTIMENTS = [
    "expression of interest",
    "callback- plan postponed",
    "callback plan postponed",
    "callback-plan postponed",
    "positive",
];

function isPositiveSentiment(val: any): boolean {
    if (!val) return false;
    const lower = String(val).trim().toLowerCase();
    return POSITIVE_SENTIMENTS.some(s => lower.includes(s));
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const providerFilter = searchParams.get('provider') || 'all';

        // Default to last 7 days
        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);

        let toDate = toParam ? new Date(toParam) : new Date();
        toDate.setHours(23, 59, 59, 999);

        const fromStr = fromDate.toISOString();
        const toStr = toDate.toISOString();

        // 1. Fetch ALL Call Logs in date range with vapi_account
        let callsQuery = supabaseAdmin
            .from('vapi_call_logs')
            .select('id, customer_phone, duration_seconds, status, source, created_at, vapi_account')
            .gte('created_at', fromStr)
            .lte('created_at', toStr)
            .order('created_at', { ascending: false });

        if (providerFilter !== 'all') {
            callsQuery = callsQuery.eq('source', providerFilter);
        }

        const { data: rawCalls, error: callsError } = await callsQuery;
        if (callsError) throw callsError;
        const allCalls = rawCalls || [];

        // Bifurcate calls by vapi_account
        const coldCalls = allCalls.filter(c =>
            (c.vapi_account || '').toLowerCase().trim() === COLD_LEADS_ACCOUNT.toLowerCase()
        );
        const hubspotCalls = allCalls.filter(c =>
            (c.vapi_account || '').toLowerCase().trim() === HUBSPOT_LEADS_ACCOUNT.toLowerCase()
        );

        // Build a set of normalized customer phones for each segment
        const coldPhones = new Set(coldCalls.map(c => normalizeCustomerPhone(c.customer_phone)));
        const hubspotPhones = new Set(hubspotCalls.map(c => normalizeCustomerPhone(c.customer_phone)));

        // ── 2. Fetch ENRICHED_LEADS for Cold Leads positive response rate ──────
        // Match on company_phone_number, use voice_sentiment + voice2_sentiment
        const { data: enrichedRaw, error: enrichedErr } = await supabaseAdmin
            .from('ENRICHED_LEADS')
            .select('company_phone_number, voice_sentiment, voice2_sentiment');

        if (enrichedErr) console.error("ENRICHED_LEADS fetch error:", enrichedErr);
        const enrichedLeads = enrichedRaw || [];

        // ── 3. Fetch hubspot_lead for Hot Leads positive response rate ──────────
        // Match on company_phone_number, use v1_sentiment, v2_sentiment, v3_sentiment
        const { data: hubspotLeadsRaw, error: hubspotLeadsErr } = await supabaseAdmin
            .from('hubspot_lead')
            .select('company_phone_number, v1_sentiment, v2_sentiment, v3_sentiment');

        if (hubspotLeadsErr) console.error("hubspot_lead fetch error:", hubspotLeadsErr);
        const hubspotLeads = hubspotLeadsRaw || [];

        // ── 4. Calculate stats helper ─────────────────────────────────────────
        function calcCallStats(calls: any[]) {
            const total = calls.length;
            const pickedUp = calls.filter(c => (c.duration_seconds || 0) > 18).length;
            const completed = calls.filter(c => {
                const s = String(c.status || '').toLowerCase();
                return s.includes('assistant-ended-call') || s.includes('customer-ended-call') ||
                    s.includes('assistant ended call') || s.includes('customer ended call');
            }).length;

            return {
                totalCalls: total,
                pickUpRate: total > 0 ? (pickedUp / total) * 100 : 0,
                completionRate: total > 0 ? (completed / total) * 100 : 0,
            };
        }

        // ── 5. Cold leads positive response rate ─────────────────────────────
        // Match ENRICHED_LEADS.company_phone_number against cold call phones
        // User requested to match company_phone_number + '+' with customer_phone + '+'
        function toStrictPlusPhone(num: any) {
            if (!num) return "";
            let s = String(num).replace(/\D/g, '');
            return s ? '+' + s : "";
        }

        const strictColdPhones = new Set(coldCalls.map(c => toStrictPlusPhone(c.customer_phone)));
        
        const coldMatchedLeads = enrichedLeads.filter(l => {
            const lPhone = toStrictPlusPhone(l.company_phone_number);
            return lPhone && strictColdPhones.has(lPhone);
        });

        const coldLeadsWithSentiment = coldMatchedLeads.filter(l =>
            (l.voice_sentiment && String(l.voice_sentiment).trim() !== '') ||
            (l.voice2_sentiment && String(l.voice2_sentiment).trim() !== '')
        );
        const coldPositive = coldLeadsWithSentiment.filter(l =>
            isPositiveSentiment(l.voice_sentiment) || isPositiveSentiment(l.voice2_sentiment)
        ).length;

        // ── 6. Hubspot leads positive response rate ───────────────────────────
        // Match hubspot_lead.company_phone_number against hubspot call phones
        const strictHubspotPhones = new Set(hubspotCalls.map(c => toStrictPlusPhone(c.customer_phone)));
        
        const hubspotMatchedLeads = hubspotLeads.filter(l => {
            const lPhone = toStrictPlusPhone(l.company_phone_number);
            return lPhone && strictHubspotPhones.has(lPhone);
        });

        const hubspotLeadsWithSentiment = hubspotMatchedLeads.filter(l =>
            (l.v1_sentiment && String(l.v1_sentiment).trim() !== '') ||
            (l.v2_sentiment && String(l.v2_sentiment).trim() !== '') ||
            (l.v3_sentiment && String(l.v3_sentiment).trim() !== '')
        );
        const hubspotPositive = hubspotLeadsWithSentiment.filter(l =>
            isPositiveSentiment(l.v1_sentiment) || 
            isPositiveSentiment(l.v2_sentiment) || 
            isPositiveSentiment(l.v3_sentiment)
        ).length;

        // ── 7. Assemble stats ─────────────────────────────────────────────────
        const allCallStats = calcCallStats(allCalls);
        const coldCallStats = calcCallStats(coldCalls);
        const hubspotCallStats = calcCallStats(hubspotCalls);

        const coldStats = {
            ...coldCallStats,
            positiveRate: coldLeadsWithSentiment.length > 0 ? (coldPositive / coldLeadsWithSentiment.length) * 100 : 0,
        };

        const hubspotStats = {
            ...hubspotCallStats,
            positiveRate: hubspotLeadsWithSentiment.length > 0 ? (hubspotPositive / hubspotLeadsWithSentiment.length) * 100 : 0,
        };

        // Legacy: combined stats (used by older parts)
        const icpStats = coldStats;
        const enrichedStats = hubspotStats;

        return NextResponse.json({
            icpStats,        // backward compat: cold leads stats
            enrichedStats,   // backward compat: hubspot leads stats
            coldStats,
            hubspotStats,
            allStats: allCallStats,
        });

    } catch (error: any) {
        console.error("Voice analytics API error:", error);
        return NextResponse.json({ error: error.message || "Failed to calculate analytics" }, { status: 500 });
    }
}
