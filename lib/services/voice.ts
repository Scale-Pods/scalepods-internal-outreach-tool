import { supabaseAdmin } from '@/lib/supabase';

// vapi_account values
export const COLD_LEADS_ACCOUNT = "cold leads";
export const HUBSPOT_LEADS_ACCOUNT = "hubspot";

function classifyAccount(vapiAccount: string | null | undefined): 'cold' | 'hubspot' | 'other' {
    const val = (vapiAccount || '').toLowerCase().trim();
    if (val === COLD_LEADS_ACCOUNT.toLowerCase()) return 'cold';
    if (val === HUBSPOT_LEADS_ACCOUNT.toLowerCase()) return 'hubspot';
    return 'other';
}

const emptyStats = {
    totalCalls: 0, totalDuration: 0, avgDuration: 0,
    totalCost: 0, avgCost: 0, successRate: 0, successCount: 0,
    pickupRate: 0, pickedUpCount: 0, completionRate: 0, completedCount: 0,
};

async function getScopedStats(fromIso: string, toIso: string, scope: 'all' | 'cold' | 'hubspot') {
    const { data, error } = await supabaseAdmin.rpc('get_voice_call_stats', {
        p_from: fromIso, p_to: toIso, p_account_scope: scope,
    });
    if (error) {
        console.error(`[voice] get_voice_call_stats(${scope}) error:`, error.message);
        return emptyStats;
    }
    const row = data?.[0];
    if (!row) return emptyStats;
    return {
        totalCalls: row.total_calls || 0,
        totalDuration: row.total_duration || 0,
        avgDuration: row.avg_duration || 0,
        totalCost: row.total_cost || 0,
        avgCost: row.avg_cost || 0,
        successRate: row.success_rate || 0,
        successCount: row.success_count || 0,
        pickupRate: row.pickup_rate || 0,
        pickedUpCount: row.picked_up_count || 0,
        completionRate: row.completion_rate || 0,
        completedCount: row.completed_count || 0,
    };
}

async function getScopedDailyVolume(fromIso: string, toIso: string, scope: 'all' | 'cold' | 'hubspot') {
    const { data, error } = await supabaseAdmin.rpc('get_voice_daily_volume', {
        p_from: fromIso, p_to: toIso, p_account_scope: scope,
    });
    if (error) {
        console.error(`[voice] get_voice_daily_volume(${scope}) error:`, error.message);
        return [];
    }
    return (data || []).map((row: any) => ({
        dayKey: row.day_key,
        name: row.display_name,
        calls: row.calls,
        totalDuration: row.total_duration_minutes,
    }));
}

async function getScopedHourlyDistribution(fromIso: string, toIso: string, scope: 'all' | 'cold' | 'hubspot') {
    const { data, error } = await supabaseAdmin.rpc('get_voice_hourly_distribution', {
        p_from: fromIso, p_to: toIso, p_account_scope: scope,
    });
    if (error) {
        console.error(`[voice] get_voice_hourly_distribution(${scope}) error:`, error.message);
        return [];
    }
    const byHour = new Map<number, number>();
    (data || []).forEach((row: any) => byHour.set(row.hour_of_day, row.calls));
    // Mirrors the old JS: 24 hourly buckets, then keep every 3rd for display.
    return Array.from({ length: 24 }, (_, hour) => ({
        name: `${hour.toString().padStart(2, '0')}:00`,
        calls: byHour.get(hour) || 0,
    })).filter((_, i) => i % 3 === 0);
}

async function getStatusBreakdown(fromIso: string, toIso: string, scope: 'all' | 'cold' | 'hubspot') {
    const { data, error } = await supabaseAdmin.rpc('get_voice_status_breakdown', {
        p_from: fromIso, p_to: toIso, p_account_scope: scope,
    });
    if (error) {
        console.error(`[voice] get_voice_status_breakdown(${scope}) error:`, error.message);
        return {};
    }
    const breakdown: Record<string, number> = {};
    (data || []).forEach((row: any) => { breakdown[row.status] = row.calls; });
    return breakdown;
}

const CALL_LOGS_BATCH_SIZE = 1000;
const CALL_LOGS_MAX_ROWS = 20000;

async function fetchAllCallLogs(fromIso: string, toIso: string) {
    const allRows: any[] = [];
    let offset = 0;

    while (offset < CALL_LOGS_MAX_ROWS) {
        const { data, error } = await supabaseAdmin.rpc('get_call_logs', {
            p_from: fromIso, p_to: toIso, p_limit: CALL_LOGS_BATCH_SIZE, p_offset: offset,
        });
        if (error) {
            console.error('[voice] get_call_logs error:', error.message);
            break;
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        offset += CALL_LOGS_BATCH_SIZE;
        if (data.length < CALL_LOGS_BATCH_SIZE) break;
    }

    return allRows;
}

export async function getVoiceStats(fromDate: Date, toDate: Date, providerFilter: string = "all") {
    try {
        const fromFull = new Date(fromDate);
        fromFull.setHours(0, 0, 0, 0);
        const toFull = new Date(toDate);
        toFull.setHours(23, 59, 59, 999);

        const fromStr = fromFull.toISOString();
        const toStr = toFull.toISOString();

        const [
            allStats, coldStats, hubspotStats,
            allDaily, coldDaily, hubspotDaily,
            allHourly, coldHourly, hubspotHourly,
            statusBreakdown,
            callLogs,
            lifetimeCostRes,
        ] = await Promise.all([
            getScopedStats(fromStr, toStr, 'all'),
            getScopedStats(fromStr, toStr, 'cold'),
            getScopedStats(fromStr, toStr, 'hubspot'),
            getScopedDailyVolume(fromStr, toStr, 'all'),
            getScopedDailyVolume(fromStr, toStr, 'cold'),
            getScopedDailyVolume(fromStr, toStr, 'hubspot'),
            getScopedHourlyDistribution(fromStr, toStr, 'all'),
            getScopedHourlyDistribution(fromStr, toStr, 'cold'),
            getScopedHourlyDistribution(fromStr, toStr, 'hubspot'),
            getStatusBreakdown(fromStr, toStr, 'all'),
            fetchAllCallLogs(fromStr, toStr),
            supabaseAdmin.from('vapi_call_logs').select('cost_usd').limit(50000),
        ]);

        // providerFilter (source column) isn't part of the RPC scope params —
        // apply it client-side to the already-fetched call log feed, same
        // narrow use as before (only affects recentCalls, not the aggregate
        // stat cards, which the original JS also computed off the unfiltered
        // vapi_account-scoped set).
        const filteredCallLogs = providerFilter === 'all'
            ? callLogs
            : callLogs.filter((c: any) => c.source === providerFilter);

        let lifetimeCostVapi = 0;
        (lifetimeCostRes.data || []).forEach((c: any) => {
            lifetimeCostVapi += typeof c.cost_usd === 'number' ? c.cost_usd : 0;
        });

        return {
            stats: {
                ...allStats,
                lifetimeCostVapi,
                positiveResponseRate: 0,
                positiveSentimentCount: 0,
                totalSentimentCount: 0,
                coldCallsCount: coldStats.totalCalls,
                hubspotCallsCount: hubspotStats.totalCalls,
            },
            dailyVolume: allDaily,
            hourlyDistribution: allHourly,
            statusBreakdown,
            cold: {
                stats: coldStats,
                dailyVolume: coldDaily,
                hourlyDistribution: coldHourly,
            },
            hubspot: {
                stats: hubspotStats,
                dailyVolume: hubspotDaily,
                hourlyDistribution: hubspotHourly,
            },
            recentCalls: filteredCallLogs.map((c: any) => ({
                id: c.id,
                created_at: c.created_at,
                customer_phone: c.phone || '—',
                customer_name: c.name || '—',
                duration_seconds: c.duration_seconds || 0,
                status: c.status || 'unknown',
                cost_usd: c.agent_cost || 0,
                source: c.source || '—',
                summary: c.call_summary || null,
                recording_url: c.audio_url || null,
                transcript: c.transcript || null,
                vapi_account: c.vapi_account || null,
                accountType: c.account_type || classifyAccount(c.vapi_account),
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
            cold: { stats: emptyStats, dailyVolume: [], hourlyDistribution: [] },
            hubspot: { stats: emptyStats, dailyVolume: [], hourlyDistribution: [] },
            recentCalls: [],
        };
    }
}
