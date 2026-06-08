import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper: Normalize phone numbers
function cleanPhone(num: any): string {
    if (!num) return "";
    return String(num).replace(/\D/g, '');
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

        // 1. Fetch Call Logs in date range (lightweight select)
        let callsQuery = supabaseAdmin
            .from('vapi_call_logs')
            .select('id, customer_phone, duration_seconds, status, source, created_at')
            .gte('created_at', fromStr)
            .lte('created_at', toStr)
            .order('created_at', { ascending: false });

        if (providerFilter !== 'all') {
            callsQuery = callsQuery.eq('source', providerFilter);
        }

        const { data: rawCalls, error: callsError } = await callsQuery;
        if (callsError) throw callsError;
        const allCalls = rawCalls || [];

        // 2. Fetch Leads in date range (using database-level OR filtering)
        const orConditions = [
            `and("Voice Last Contacted".gte.${fromStr},"Voice Last Contacted".lte.${toStr})`,
            `and(voice_last_contacted.gte.${fromStr},voice_last_contacted.lte.${toStr})`,
            `and(Voice_1_Date.gte.${fromStr},Voice_1_Date.lte.${toStr})`,
            `and(Voice_2_Date.gte.${fromStr},Voice_2_Date.lte.${toStr})`,
            `and(created_at.gte.${fromStr},created_at.lte.${toStr})`
        ].join(',');

        const [icpRes, enrichedRes] = await Promise.all([
            supabaseAdmin
                .from('icp_tracker')
                .select('id, voice_sentiment, voice2_sentiment, created_at, "Voice Last Contacted", voice_last_contacted, Voice_1_Date, Voice_2_Date, personal_phone, company_phone_number')
                .or(orConditions),
            supabaseAdmin
                .from('ENRICHED_LEADS')
                .select('id, voice_sentiment, voice2_sentiment, created_at, "Voice Last Contacted", voice_last_contacted, Voice_1_Date, Voice_2_Date, personal_phone, company_phone_number')
                .or(orConditions)
        ]);

        if (icpRes.error) throw icpRes.error;
        if (enrichedRes.error) throw enrichedRes.error;

        const icpLeads = icpRes.data || [];
        const enrichedLeads = enrichedRes.data || [];

        // 3. Helper to calculate stats
        const calculateStats = (leads: any[], sourceCalls: any[]) => {
            if (sourceCalls.length === 0 && leads.length === 0) {
                return { pickUpRate: 0, completionRate: 0, positiveRate: 0, totalCalls: 0 };
            }

            // Map phones to a Set
            const phoneSet = new Set<string>();
            leads.forEach(l => {
                const p1 = cleanPhone(l.phone);
                const p2 = cleanPhone(l.personal_phone);
                const p3 = cleanPhone(l.company_phone_number);
                if (p1) phoneSet.add(p1);
                if (p2) phoneSet.add(p2);
                if (p3) phoneSet.add(p3);
            });

            // Match calls by phone number
            const matchedCalls = sourceCalls.filter(c => {
                const cp = cleanPhone(c.customer_phone);
                if (!cp) return false;
                return Array.from(phoneSet).some(p => 
                    p === cp || 
                    (cp.length > 8 && p.endsWith(cp.slice(-9))) || 
                    (p.length > 8 && cp.endsWith(p.slice(-9)))
                );
            });

            const archiveCount = matchedCalls.length;
            const pickUpCount = matchedCalls.filter((c: any) => (c.duration_seconds || 0) > 18).length;
            
            const completionCount = matchedCalls.filter((c: any) => {
                const status = String(c.status || "").toLowerCase();
                return status.includes('assistant-ended-call') || 
                       status.includes('customer-ended-call') || 
                       status.includes('assistant ended call') || 
                       status.includes('customer ended call');
            }).length;

            const positiveCount = leads.filter((l: any) => {
                const s1 = String(l.voice_sentiment || "").trim();
                const s2 = String(l.voice2_sentiment || "").trim();
                const isPos = (s: string) => {
                    const lower = s.toLowerCase().trim();
                    return lower.includes('expression of interest') || 
                           lower.includes('callback- plan postponed') ||
                           lower.includes('callback plan postponed') ||
                           lower.includes('callback-plan postponed');
                };
                return isPos(s1) || isPos(s2);
            }).length;

            const leadsWithSentiment = leads.filter((l: any) => {
                const s1 = String(l.voice_sentiment || "").trim();
                const s2 = String(l.voice2_sentiment || "").trim();
                return s1 !== "" || s2 !== "";
            });
            const totalSentiment = leadsWithSentiment.length;

            const effectiveTotal = Math.max(archiveCount, leads.length);

            return {
                totalCalls: effectiveTotal,
                pickUpRate: archiveCount > 0 ? (pickUpCount / archiveCount) * 100 : 0,
                completionRate: archiveCount > 0 ? (completionCount / archiveCount) * 100 : 0,
                positiveRate: totalSentiment > 0 ? (positiveCount / totalSentiment) * 100 : 0
            };
        };

        const icpStats = calculateStats(icpLeads, allCalls);
        const enrichedStats = calculateStats(enrichedLeads, allCalls);

        return NextResponse.json({
            icpStats,
            enrichedStats
        });

    } catch (error: any) {
        console.error("Voice analytics API error:", error);
        return NextResponse.json({ error: error.message || "Failed to calculate analytics" }, { status: 500 });
    }
}
