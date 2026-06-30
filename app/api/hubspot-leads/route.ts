import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 10;
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const replied = searchParams.get('replied') || '';

    try {
        let query = supabaseAdmin
            .from('hubspot_lead')
            .select(
                'full_name, company_phone_number, status, last_conversation, created_at, lifecyclestage, "Personal Email", "Other Personal Emails", Replied, WTS_Reply_Track',
                { count: 'exact' }
            )
            .order('created_at', { ascending: false });

        if (from) query = query.gte('created_at', from);
        if (to) query = query.lte('created_at', to);

        if (search) {
            query = query.or(
                `full_name.ilike.%${search}%,company_phone_number.ilike.%${search}%,"Personal Email".ilike.%${search}%,"Other Personal Emails".ilike.%${search}%`
            );
        }

        if (status) query = query.eq('status', status);

        if (replied === 'yes') {
            query = query.not('WTS_Reply_Track', 'is', null);
        } else if (replied === 'no') {
            query = query.is('WTS_Reply_Track', null);
        }

        const { data, count, error } = await query.range(offset, offset + limit - 1);

        if (error) {
            console.error('HubSpot leads error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data || [], count: count || 0, page, limit });
    } catch (e: any) {
        console.error('HubSpot leads exception:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
