import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        // Fetch Campaign Analytics
        // The user mentioned the first row contains definitions, so we'll fetch all and handle it in frontend or here.
        const { data: campaignAnalytics, error: campaignError } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('*');

        if (campaignError) {
            console.error('Campaign Analytics Error:', campaignError);
        }

        // Fetch Lead Replies
        const { data: leadReplies, error: repliesError } = await supabaseAdmin
            .from('instantly_lead_replies')
            .select('*')
            .order('timestamp', { ascending: false }); // Assuming 'timestamp' exists as it's common for replies

        if (repliesError) {
            // Fallback to created_at if timestamp doesn't exist
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
            console.error('Lead Replies Error:', repliesError);
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
