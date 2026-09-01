import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Replaces two separate `.select('*', {count})` queries (the second
// redoing the first's work after a dead-code false start) with the
// get_leads_page / get_leads_page_count RPCs, which also enforce a
// server-side table allowlist rather than accepting any table name
// unchecked.
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || null;

    if (!table) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 });
    }

    try {
        const [dataRes, countRes] = await Promise.all([
            supabaseAdmin.rpc('get_leads_page', { p_table: table, p_page: page, p_limit: limit, p_search: search }),
            supabaseAdmin.rpc('get_leads_page_count', { p_table: table, p_search: search }),
        ]);

        if (dataRes.error) {
            return NextResponse.json({ error: dataRes.error.message }, { status: 500 });
        }
        if (countRes.error) {
            return NextResponse.json({ error: countRes.error.message }, { status: 500 });
        }

        return NextResponse.json({ data: dataRes.data || [], count: countRes.data || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
