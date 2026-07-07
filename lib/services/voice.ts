import { supabaseAdmin } from '@/lib/supabase';
import { format, getHours } from "date-fns";

// vapi_account values
export const COLD_LEADS_ACCOUNT = "Scalepods Internal outreach - cold leads";
export const HUBSPOT_LEADS_ACCOUNT = "hubspot leads";

function classifyAccount(vapiAccount: string | null | undefined): 'cold' | 'hubspot' | 'other' {
    const val = (vapiAccount || '').toLowerCase().trim();
    if (val === COLD_LEADS_ACCOUNT.toLowerCase()) return 'cold';
    if (val === HUBSPOT_LEADS_ACCOUNT.toLowerCase()) return 'hubspot';
    return 'other';
}

const POSITIVE_SENTIMENTS = [
    "expression of interest",
    "callback- plan postponed",
    "callback plan postponed",
    "callback-plan postponed",
];

function isPositiveSentiment(val: any): boolean {
    if (!val) return false;
    const lower = String(val).trim().toLowerCase();
    return POSITIVE_SENTIMENTS.some(s => lower.includes(s));
}

function buildMetrics(calls: any[]) {
    let totalDuration = 0, totalCost = 0, successCount = 0;
    let pickedUpCount = 0;
    let completedCount = 0;
    const dayMap = new Map<string, { count: number; display: string; totalDuration: number }>();
    const hourMap = new Array(24).fill(0);
    const statusBreakdown: Record<string, number> = {};

    calls.forEach((call: any) => {
        const duration = typeof call.duration_seconds === 'number' ? call.duration_seconds : 0;
        const cost = typeof call.cost_usd === 'number' ? call.cost_usd : 0;
        const rawStatus = (call.status || '').toLowerCase().trim();

        if (['done', 'ended', 'completed', 'success', 'answered'].includes(rawStatus)) successCount++;
        if (duration > 18) pickedUpCount++;
        if (rawStatus === 'customer-ended-call' || rawStatus === 'assistant-ended-call') completedCount++;

        totalDuration += duration;
        totalCost += cost;
        statusBreakdown[rawStatus] = (statusBreakdown[rawStatus] || 0) + 1;

        const dt = new Date(call.created_at);
        if (!isNaN(dt.getTime())) {
            const dayKey = format(dt, 'yyyy-MM-dd');
            const displayKey = format(dt, 'MMM dd');
            if (!dayMap.has(dayKey)) dayMap.set(dayKey, { count: 0, display: displayKey, totalDuration: 0 });
            const entry = dayMap.get(dayKey)!;
            entry.count++;
            entry.totalDuration += duration;
            hourMap[getHours(dt)]++;
        }
    });

    const total = calls.length;
    const dailyVolume = Array.from(dayMap.entries())
        .map(([dayKey, d]) => ({
            dayKey,
            name: d.display,
            calls: d.count,
            totalDuration: Math.round(d.totalDuration / 60)
        }))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

    const hourlyDistribution = hourMap
        .map((calls, hour) => ({ name: `${hour.toString().padStart(2, '0')}:00`, calls }))
        .filter((_, i) => i % 3 === 0);

    return {
        stats: {
            totalCalls: total,
            totalDuration,
            avgDuration: total > 0 ? totalDuration / total : 0,
            totalCost,
            avgCost: total > 0 ? totalCost / total : 0,
            successRate: total > 0 ? (successCount / total) * 100 : 0,
            successCount,
            pickupRate: total > 0 ? (pickedUpCount / total) * 100 : 0,
            pickedUpCount,
            completionRate: total > 0 ? (completedCount / total) * 100 : 0,
            completedCount,
        },
        dailyVolume,
        hourlyDistribution,
        statusBreakdown,
    };
}

export async function getVoiceStats(fromDate: Date, toDate: Date, providerFilter: string = "all") {
    try {
        const fromFull = new Date(fromDate);
        fromFull.setHours(0, 0, 0, 0);
        const toFull = new Date(toDate);
        toFull.setHours(23, 59, 59, 999);

        const fromStr = fromFull.toISOString();
        const toStr = toFull.toISOString();

        // ── 1. Fetch vapi_call_logs in the date range ──────────
        let query = supabaseAdmin
            .from('vapi_call_logs')
            .select('id, created_at, started_at, customer_phone, customer_name, duration_seconds, status, cost_usd, source, transcript, summary, recording_url, vapi_account, type, "assistantId"')
            .gte('created_at', fromStr)
            .lte('created_at', toStr)
            .order('created_at', { ascending: false });

        if (providerFilter !== "all") {
            query = query.eq('source', providerFilter);
        }

        const { data: filteredCallsRaw, error: callsErr } = await query;
        if (callsErr) console.error("vapi_call_logs fetch error:", callsErr);
        const filteredCalls = filteredCallsRaw || [];

        // Estimate lifetime VAPI cost
        const { data: allCostData } = await supabaseAdmin
            .from('vapi_call_logs')
            .select('cost_usd')
            .limit(50000);
        let lifetimeCostVapi = 0;
        (allCostData || []).forEach((c: any) => {
            lifetimeCostVapi += typeof c.cost_usd === 'number' ? c.cost_usd : 0;
        });

        // ── 2. Bifurcate by vapi_account ─────────────────────────────────────
        const coldCalls = filteredCalls.filter(c => classifyAccount((c as any).vapi_account) === 'cold');
        const hubspotCalls = filteredCalls.filter(c => classifyAccount((c as any).vapi_account) === 'hubspot');

        // ── 3. Build metrics for all / cold / hubspot ─────────────────────────
        const allMetrics = buildMetrics(filteredCalls);
        const coldMetrics = buildMetrics(coldCalls);
        const hubspotMetrics = buildMetrics(hubspotCalls);

        const total = filteredCalls.length;

        return {
            stats: {
                ...allMetrics.stats,
                totalCalls: total,
                lifetimeCostVapi,
                positiveResponseRate: 0,
                positiveSentimentCount: 0,
                totalSentimentCount: 0,
                // Bifurcated counts
                coldCallsCount: coldCalls.length,
                hubspotCallsCount: hubspotCalls.length,
            },
            dailyVolume: allMetrics.dailyVolume,
            hourlyDistribution: allMetrics.hourlyDistribution,
            statusBreakdown: allMetrics.statusBreakdown,
            // Bifurcated data for sub-views
            cold: {
                stats: coldMetrics.stats,
                dailyVolume: coldMetrics.dailyVolume,
                hourlyDistribution: coldMetrics.hourlyDistribution,
            },
            hubspot: {
                stats: hubspotMetrics.stats,
                dailyVolume: hubspotMetrics.dailyVolume,
                hourlyDistribution: hubspotMetrics.hourlyDistribution,
            },
            recentCalls: filteredCalls.map((c: any) => ({
                id: c.id,
                created_at: c.created_at,
                customer_phone: c.customer_phone || '—',
                customer_name: c.customer_name || '—',
                duration_seconds: c.duration_seconds || 0,
                status: c.status || 'unknown',
                cost_usd: c.cost_usd || 0,
                source: c.source || '—',
                summary: c.summary || null,
                recording_url: c.recording_url || null,
                transcript: c.transcript || null,
                vapi_account: c.vapi_account || null,
                accountType: classifyAccount(c.vapi_account),
            })),
        };
    } catch (e) {
        console.error("getVoiceStats Error:", e);
        return {
            stats: {
                totalCalls: 0, totalDuration: 0, avgDuration: 0,
                totalCost: 0, avgCost: 0, successRate: 0,
                lifetimeCostVapi: 0, successCount: 0,
                pickupRate: 0, pickedUpCount: 0,
                completionRate: 0, completedCount: 0,
                positiveResponseRate: 0, positiveSentimentCount: 0, totalSentimentCount: 0,
                coldCallsCount: 0, hubspotCallsCount: 0,
            },
            dailyVolume: [],
            hourlyDistribution: [],
            statusBreakdown: {},
            cold: { stats: { totalCalls: 0, totalDuration: 0, avgDuration: 0, totalCost: 0, avgCost: 0, successRate: 0, successCount: 0, pickupRate: 0, pickedUpCount: 0, completionRate: 0, completedCount: 0 }, dailyVolume: [], hourlyDistribution: [] },
            hubspot: { stats: { totalCalls: 0, totalDuration: 0, avgDuration: 0, totalCost: 0, avgCost: 0, successRate: 0, successCount: 0, pickupRate: 0, pickedUpCount: 0, completionRate: 0, completedCount: 0 }, dailyVolume: [], hourlyDistribution: [] },
            recentCalls: [],
        };
    }
}
