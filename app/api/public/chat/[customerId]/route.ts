import { NextResponse } from 'next/server';
import { fetchWaLeads, COLD_TABLE, HOT_TABLE, HUBSPOT_WA_TABLE, type LeadType } from '@/lib/services/whatsapp-outreach';

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

    const leadTypes: LeadType[] = sourceParam === HOT_TABLE
        ? ['hot']
        : sourceParam === COLD_TABLE
            ? ['cold']
            : sourceParam === HUBSPOT_WA_TABLE
                ? ['hubspot_wa']
                : ['cold', 'hot', 'hubspot_wa'];

    try {
        for (const leadType of leadTypes) {
            const leads = await fetchWaLeads(leadType);
            const match = leads.find(l => l.phone.replace(/\D/g, '').includes(phoneVal));

            if (match) {
                return NextResponse.json({ lead: match });
            }
        }

        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } catch (error: any) {
        console.error('Public chat lookup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
