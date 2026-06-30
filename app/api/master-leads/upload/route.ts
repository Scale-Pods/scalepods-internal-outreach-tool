import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json();
        const { leads, t_name, loop } = payload;

        if (!leads || !Array.isArray(leads)) {
            return NextResponse.json({ error: 'Payload must contain an array of leads' }, { status: 400 });
        }

        const formattedLeads = leads
            .filter((lead: any) => lead.company_phone_number && String(lead.company_phone_number).trim())
            .map((lead: any) => {
                return {
                    full_name: lead.full_name || null,
                    company_phone_number: String(lead.company_phone_number).trim(),
                    "Personal Email": lead["Personal Email"] || null,
                    t_name: t_name || null,
                    "Loop": loop || null,
                    created_at: new Date().toISOString(),
                };
            });

        if (formattedLeads.length === 0) {
            return NextResponse.json({ error: 'No valid leads found (company_phone_number is required)' }, { status: 400 });
        }

        // Use upsert to handle existing records by phone number
        const { error } = await supabaseAdmin
            .from('master_leads_unique')
            .upsert(formattedLeads, { onConflict: 'company_phone_number' });

        if (error) {
            console.error('Master leads upload error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: formattedLeads.length });
    } catch (e: any) {
        console.error('Master leads upload exception:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
