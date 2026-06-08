import { supabaseAdmin } from '@/lib/supabase';
import { format, getHours } from "date-fns";

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

export async function getVoiceStats(fromDate: Date, toDate: Date, providerFilter: string = "all") {
    try {
        const fromFull = new Date(fromDate);
        fromFull.setHours(0, 0, 0, 0);
        const toFull = new Date(toDate);
        toFull.setHours(23, 59, 59, 999);

        // ── 1. Fetch ALL vapi_call_logs (created_at as primary date) ──────────
        // .range(0, 9999) bypasses Supabase's default PostgREST row cap
        const { data: allCallsRaw, error: callsErr } = await supabaseAdmin
            .from('vapi_call_logs')
            .select('id, created_at, started_at, customer_phone, customer_name, duration_seconds, status, cost_usd, source, transcript, summary, recording_url, vapi_account, type, "assistantId"')
            .order('created_at', { ascending: false })
            .range(0, 9999);

        if (callsErr) console.error("vapi_call_logs fetch error:", callsErr);
        const allCalls = allCallsRaw || [];

        // Lifetime VAPI cost (all time)
        let lifetimeCostVapi = 0;
        allCalls.forEach((c: any) => {
            lifetimeCostVapi += typeof c.cost_usd === 'number' ? c.cost_usd : 0;
        });

        // ── 2. Filter by created_at date range ────────────────────────────────
        const rangeCalls = allCalls.filter((call: any) => {
            const dt = call.created_at ? new Date(call.created_at) : null;
            if (!dt || isNaN(dt.getTime())) return false;
            return dt >= fromFull && dt <= toFull;
        });

        // Apply provider filter
        const filteredCalls = providerFilter === "all"
            ? rangeCalls
            : rangeCalls.filter((c: any) => c.source === providerFilter || c.vapi_account === providerFilter);

        // ── 3. Core metrics ───────────────────────────────────────────────────
        let totalDuration = 0, totalCost = 0, successCount = 0;
        let pickedUpCount = 0;       // duration_seconds > 18
        let completedCount = 0;      // customer-ended-call OR assistant-ended-call

        const dayMap = new Map<string, { count: number; display: string; totalDuration: number }>();
        const hourMap = new Array(24).fill(0);
        const statusBreakdown: Record<string, number> = {};

        filteredCalls.forEach((call: any) => {
            const duration = typeof call.duration_seconds === 'number' ? call.duration_seconds : 0;
            const cost = typeof call.cost_usd === 'number' ? call.cost_usd : 0;
            const rawStatus = (call.status || '').toLowerCase().trim();

            // Success (general ended/completed)
            if (['done', 'ended', 'completed', 'success', 'answered'].includes(rawStatus)) successCount++;

            // Call Pick-up Rate: duration > 18 seconds means someone actually answered
            if (duration > 18) pickedUpCount++;

            // Call Completion Rate: ended by either party
            if (rawStatus === 'customer-ended-call' || rawStatus === 'assistant-ended-call') completedCount++;

            totalDuration += duration;
            totalCost += cost;

            // Status breakdown for pie chart
            statusBreakdown[rawStatus] = (statusBreakdown[rawStatus] || 0) + 1;

            // Daily grouping
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

        // Fetch voice_sentiment and voice2_sentiment for leads in the date range (using "Voice Last Contacted" or created_at)
        const [icpSentimentRaw, enrichedSentimentRaw] = await Promise.all([
            supabaseAdmin
                .from('icp_tracker')
                .select('voice_sentiment, voice2_sentiment, created_at, "Voice Last Contacted"')
                .limit(50000),
            supabaseAdmin
                .from('ENRICHED_LEADS')
                .select('voice_sentiment, voice2_sentiment, created_at, "Voice Last Contacted"')
                .limit(50000),
        ]);

        const icpSentiments = icpSentimentRaw.data || [];
        const enrichedSentiments = enrichedSentimentRaw.data || [];
        
        // Filter out leads with no sentiment data
        const allSentiments = [...icpSentiments, ...enrichedSentiments].filter((row: any) =>
            (row.voice_sentiment && String(row.voice_sentiment).trim() !== '') ||
            (row.voice2_sentiment && String(row.voice2_sentiment).trim() !== '')
        );

        // Filter to date range using "Voice Last Contacted" or created_at
        const sentimentsInRange = allSentiments.filter((row: any) => {
            const dt = row["Voice Last Contacted"]
                ? new Date(row["Voice Last Contacted"])
                : row.created_at ? new Date(row.created_at) : null;
            if (!dt || isNaN(dt.getTime())) return false;
            return dt >= fromFull && dt <= toFull;
        });

        const positiveSentimentCount = sentimentsInRange.filter((row: any) =>
            isPositiveSentiment(row.voice_sentiment) || isPositiveSentiment(row.voice2_sentiment)
        ).length;

        const totalSentimentCount = sentimentsInRange.length;

        // ── 5. Chart data ─────────────────────────────────────────────────────
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

        const total = filteredCalls.length;

        return {
            stats: {
                totalCalls: total,
                totalDuration,
                avgDuration: total > 0 ? totalDuration / total : 0,
                totalCost,
                avgCost: total > 0 ? totalCost / total : 0,
                successRate: total > 0 ? (successCount / total) * 100 : 0,
                lifetimeCostVapi,
                successCount,
                // New metrics
                pickupRate: total > 0 ? (pickedUpCount / total) * 100 : 0,
                pickedUpCount,
                completionRate: total > 0 ? (completedCount / total) * 100 : 0,
                completedCount,
                positiveResponseRate: totalSentimentCount > 0 ? (positiveSentimentCount / totalSentimentCount) * 100 : 0,
                positiveSentimentCount,
                totalSentimentCount,
            },
            dailyVolume,
            hourlyDistribution,
            statusBreakdown,
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
                vapi_account: c.vapi_account || 'normal',
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
            },
            dailyVolume: [],
            hourlyDistribution: [],
            statusBreakdown: {},
            recentCalls: [],
        };
    }
}
