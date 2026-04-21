import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch Campaign Analytics
        const { data: campaignAnalytics, error: campaignError } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('*');

        if (campaignError) {
            console.error('Campaign Analytics Error:', campaignError);
        }

        // Fetch Lead Replies ordered by reply_timestamp (actual column name)
        const { data: leadReplies, error: repliesError } = await supabaseAdmin
            .from('instantly_lead_replies')
            .select('*')
            .order('reply_timestamp', { ascending: false });

        if (repliesError) {
            console.error('Lead Replies Error (reply_timestamp):', repliesError);
            // Fallback to created_at if reply_timestamp order fails
            const { data: fallbackReplies, error: fallbackError } = await supabaseAdmin
                .from('instantly_lead_replies')
                .select('*')
                .order('created_at', { ascending: false });

            if (!fallbackError) {
                return NextResponse.json({
                    campaignAnalytics: campaignAnalytics || [],
                    leadReplies: fallbackReplies || []
                });
            }
            console.error('Lead Replies Fallback Error:', fallbackError);
        }

        return NextResponse.json({
            campaignAnalytics: campaignAnalytics || [],
            leadReplies: leadReplies || []
        });
    } catch (error: any) {
        console.error('Email DB Data API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
