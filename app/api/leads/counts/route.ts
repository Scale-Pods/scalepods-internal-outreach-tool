import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Replaces 8 separate {count:'estimated'} head requests with a single
// get_leads_table_counts RPC call — one round trip instead of 8, and exact
// counts (COUNT(*)) instead of Postgres's approximate planner-stats estimate.
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin.rpc('get_leads_table_counts');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const result = (data || []).reduce((acc: Record<string, number>, row: any) => {
            acc[row.table_name] = row.row_count;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
