import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const BATCH_SIZE = 1000;
const MAX_ROWS = 20000;

// Replaces the old raw-REST fetch (hard-capped at 10000 rows, single
// request, no true pagination) with batched calls to the get_call_logs RPC,
// which computes cost breakdown (agent + telephony) and country lookup
// server-side in Postgres instead of pulling every row into Node.
async function fetchArchive(from: Date, to: Date) {
    const allRows: any[] = [];
    let offset = 0;

    try {
        while (offset < MAX_ROWS) {
            const { data, error } = await supabaseAdmin.rpc('get_call_logs', {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
                p_limit: BATCH_SIZE,
                p_offset: offset,
            });

            if (error) {
                console.error('[calls] get_call_logs RPC error:', error.message);
                break;
            }
            if (!data || data.length === 0) break;

            allRows.push(...data);
            offset += BATCH_SIZE;

            if (data.length < BATCH_SIZE) break;
        }
    } catch (e: any) {
        console.error('[calls] Archive fetch exception:', e?.message || e);
    }

    // Map snake_case RPC output to the camelCase shape the UI expects
    // (unchanged from before this migration — CallDetailsModal, voice logs
    // pages, etc. all read these exact field names).
    return allRows.map((db: any) => ({
        id: db.id,
        name: db.name,
        startedAt: db.started_at,
        durationSeconds: db.duration_seconds || 0,
        cost: db.cost_value > 0 ? `$${db.cost_value.toFixed(3)}` : '$0.00',
        costValue: db.cost_value || 0,
        breakdown: {
            agent: db.agent_cost || 0,
            telephony: db.telephony_cost || 0,
        },
        source: db.source,
        status: db.status,
        phone: db.phone,
        customer_number: db.phone,
        callSummary: db.call_summary,
        audio_url: db.audio_url,
        transcript: db.transcript,
        type: db.call_type,
        isInbound: db.is_inbound,
        assistantId: db.assistant_id,
        vapi_account: db.vapi_account,
        accountType: db.account_type,
        createdAt: db.created_at,
        country: db.country,
    }));
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);

        let toDate = toParam ? new Date(toParam) : new Date();
        toDate.setHours(23, 59, 59, 999);

        const results = await fetchArchive(fromDate, toDate);

        return NextResponse.json(results);
    } catch (globalErr: any) {
        console.error('Global calls API error:', globalErr?.message || globalErr);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}
