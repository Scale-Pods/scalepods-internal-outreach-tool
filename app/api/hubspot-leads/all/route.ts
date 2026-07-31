import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const allLeads: any[] = [];
        const pageSize = 1000;
        let from = 0;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from('hubspot_lead')
                .select(
                    'full_name, company_phone_number, status, last_conversation, created_at, lifecyclestage, "Whatsapp Last Contacted", Replied, WTS_Reply_Track, Lead_Classification, Company, "Work Email", Location, "Job Title", Industry, personal_phone, Voice_1_Status, Voice_2_Status, Email_1, Email_2, Email_3, Email_4, Email_5, Email_6, Whatsapp_1, Whatsapp_2, Whatsapp_3, Whatsapp_4, Whatsapp_5, Whatsapp_6, Whatsapp_1_status, Whatsapp_2_status, Whatsapp_3_status, Whatsapp_4_status, Whatsapp_5_status, Whatsapp_6_status, whatsapp_6_status, wa_conversation, User_Replied_1, User_Replied_2, User_Replied_3, User_Replied_4, User_Replied_5, User_Replied_6, User_Replied_7, User_Replied_8, User_Replied_9, User_Replied_10, User_Replied_11, User_Replied_12, User_Replied_13, User_Replied_14, User_Replied_15, User_Replied_16, User_Replied_17, User_Replied_18, User_Replied_19, User_Replied_20, User_Replied_21, User_Replied_22, User_Replied_23, User_Replied_24, User_Replied_25, Bot_Replied_1, Bot_Replied_2, Bot_Replied_3, Bot_Replied_4, Bot_Replied_5, Bot_Replied_6, Bot_Replied_7, Bot_Replied_8, Bot_Replied_9, Bot_Replied_10, Bot_Replied_11, Bot_Replied_12, Bot_Replied_13, Bot_Replied_14, Bot_Replied_15, Bot_Replied_16, Bot_Replied_17, Bot_Replied_18, Bot_Replied_19, Bot_Replied_20, Bot_Replied_21, Bot_Replied_22, Bot_Replied_23, Bot_Replied_24, Bot_Replied_25, Bot_Replied_Status_1, Bot_Replied_Status_2, Bot_Replied_Status_3, Bot_Replied_Status_4, Bot_Replied_Status_5'
                )
                .order('created_at', { ascending: false })
                .range(from, from + pageSize - 1);

            if (error) {
                console.error('HubSpot leads all error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allLeads.push(...data.map((l: any) => ({ ...l, _table: 'hubspot_lead' })));

            if (data.length < pageSize) break;
            from += pageSize;
        }

        return NextResponse.json({ leads: allLeads });
    } catch (e: any) {
        console.error('HubSpot leads all exception:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
