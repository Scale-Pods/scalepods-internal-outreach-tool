import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeWaRow, COLD_TABLE, HOT_TABLE, type LeadType } from '@/lib/services/whatsapp-outreach';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ customerId: string }> }
) {
    const { customerId } = await params;
    const { searchParams } = new URL(req.url);
    const sourceParam = searchParams.get('source');

    const searchVal = decodeURIComponent(customerId).trim();
    const phoneVal = searchVal.replace(/\D/g, '');

    const tables: { table: string; leadType: LeadType }[] = sourceParam === HOT_TABLE
        ? [{ table: HOT_TABLE, leadType: 'hot' }]
        : sourceParam === COLD_TABLE
            ? [{ table: COLD_TABLE, leadType: 'cold' }]
            : [{ table: COLD_TABLE, leadType: 'cold' }, { table: HOT_TABLE, leadType: 'hot' }];

    try {
        for (const { table, leadType } of tables) {
            const { data: byId } = await supabaseAdmin.from(table).select('*').or(
                `lead_uuid.eq.${searchVal},id.eq.${searchVal},lead_id.eq.${searchVal}`
            ).limit(1);

            if (byId && byId.length > 0) {
                return NextResponse.json({ lead: normalizeWaRow(byId[0], table, leadType) });
            }

            if (phoneVal) {
                const { data: byPhone } = await supabaseAdmin.from(table)
                    .select('*')
                    .ilike('company_phone_number', `%${phoneVal}%`)
                    .limit(1);

                if (byPhone && byPhone.length > 0) {
                    return NextResponse.json({ lead: normalizeWaRow(byPhone[0], table, leadType) });
                }
            }
        }

        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } catch (error: any) {
        console.error('Public chat lookup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
