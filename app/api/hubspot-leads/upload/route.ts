import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const leads = await request.json();

        if (!Array.isArray(leads)) {
            return NextResponse.json({ error: 'Payload must be an array of leads' }, { status: 400 });
        }

        const formattedLeads = leads
            .filter((lead: any) => lead.company_phone_number && String(lead.company_phone_number).trim())
            .map((lead: any) => {
                return {
                    full_name: lead.full_name || null,
                    company_phone_number: String(lead.company_phone_number).trim(),
                    "Other Personal Emails": lead["Other Personal Emails"] || null,
                    "Personal Email": lead["Personal Email"] || null,
                    created_at: new Date().toISOString(),
                };
            });

        if (formattedLeads.length === 0) {
            return NextResponse.json({ error: 'No valid leads found (company_phone_number is required)' }, { status: 400 });
        }

        // Use upsert to handle existing records by phone number
        const { error } = await supabaseAdmin
            .from('hubspot_lead')
            .upsert(formattedLeads, { onConflict: 'company_phone_number' });

        if (error) {
            console.error('HubSpot leads upload error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: formattedLeads.length });
    } catch (e: any) {
        console.error('HubSpot leads upload exception:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
