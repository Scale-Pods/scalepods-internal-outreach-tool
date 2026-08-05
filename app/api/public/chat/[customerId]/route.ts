import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeWaRow, COLD_TABLE, HOT_TABLE, HUBSPOT_WA_TABLE, type LeadType } from '@/lib/services/whatsapp-outreach';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ customerId: string }> }
) {
    const { customerId } = await params;
    const { searchParams } = new URL(req.url);
    const sourceParam = searchParams.get('source');

    const phoneVal = decodeURIComponent(customerId).trim().replace(/\D/g, '');

    if (!phoneVal) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const tables: { table: string; leadType: LeadType }[] = sourceParam === HOT_TABLE
        ? [{ table: HOT_TABLE, leadType: 'hot' }]
        : sourceParam === COLD_TABLE
            ? [{ table: COLD_TABLE, leadType: 'cold' }]
            : sourceParam === HUBSPOT_WA_TABLE
                ? [{ table: HUBSPOT_WA_TABLE, leadType: 'hubspot_wa' }]
                : [{ table: COLD_TABLE, leadType: 'cold' }, { table: HOT_TABLE, leadType: 'hot' }, { table: HUBSPOT_WA_TABLE, leadType: 'hubspot_wa' }];

    try {
        for (const { table, leadType } of tables) {
            const stageCount = leadType === 'hubspot_wa' ? 1 : undefined;
            const { data } = await supabaseAdmin.from(table)
                .select('*')
                .ilike('company_phone_number', `%${phoneVal}%`)
                .limit(1);

            if (data && data.length > 0) {
                return NextResponse.json({ lead: normalizeWaRow(data[0], table, leadType, stageCount) });
            }
        }

        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } catch (error: any) {
        console.error('Public chat lookup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
