import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const TABLES = [
    'ENRICHED_LEADS',
    'LinkedIn_leads',
    'gmap_leadsv2',
    'hubspot_lead',
    'icp_tracker',
    'meta_lead_tracker',
    'master_leads_unique'
];

export async function GET() {
    try {
        const counts = await Promise.all(TABLES.map(async (table) => {
            const { count, error } = await supabaseAdmin
                .from(table)
                .select('*', { count: 'estimated', head: true });
            
            return { table, count: count || 0, error: error?.message };
        }));

        const result = counts.reduce((acc, curr) => {
            acc[curr.table] = curr.count;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
