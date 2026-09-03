import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { COLD_TABLE, HOT_TABLE, HUBSPOT_WA_TABLE, type LeadType } from '@/lib/services/whatsapp-outreach';

// Targeted single-lead lookup via get_wa_lead_by_phone RPC — does the phone
// match as a SQL WHERE clause instead of fetching every lead in the
// relevant table(s) and filtering in JS (the previous approach, which was
// a major source of unnecessary egress since this route has no date range
// to bound the fetch by).
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

    const leadType: LeadType | null = sourceParam === HOT_TABLE
        ? 'hot'
        : sourceParam === COLD_TABLE
            ? 'cold'
            : sourceParam === HUBSPOT_WA_TABLE
                ? 'hubspot_wa'
                : null;

    try {
        const { data, error } = await supabaseAdmin.rpc('get_wa_lead_by_phone', {
            p_phone_digits: phoneVal,
            p_lead_type: leadType,
        });

        if (error) {
            console.error('Public chat lookup RPC error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        return NextResponse.json({ lead: data });
    } catch (error: any) {
        console.error('Public chat lookup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
