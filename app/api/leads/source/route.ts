import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    if (!table) {
        return NextResponse.json({ error: "Table name is required" }, { status: 400 });
    }

    try {
        const { data, count, error } = await supabaseAdmin
            .from(table)
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false, nullsFirst: false });
            // Some tables might not have created_at, but Supabase ignores order if column doesn't exist or we can just omit order and let it be default. Let's omit order to be safe for diverse tables, or order by id if it exists. Actually, Supabase throws an error if we order by a non-existent column.
            
        // Let's build the base query without order to avoid schema errors across 7 different tables.
        let query = supabaseAdmin
            .from(table)
            .select('*', { count: 'exact' });
            
        if (search) {
            // Because tables might have different schemas, we use a generic text search.
            // Using ilike on full_name and company_phone_number which are common.
            // Note: If a table lacks these columns, it might fail. But for master, hubspot, enriched, icp, meta they usually have full_name.
            query = query.or(`full_name.ilike.%${search}%,company_phone_number.ilike.%${search}%`);
        }

        const { data: dataNoOrder, count: countNoOrder, error: errorNoOrder } = await query
            .range(offset, offset + limit - 1);

        if (errorNoOrder) {
            return NextResponse.json({ error: errorNoOrder.message }, { status: 500 });
        }

        return NextResponse.json({ data: dataNoOrder || [], count: countNoOrder || 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
