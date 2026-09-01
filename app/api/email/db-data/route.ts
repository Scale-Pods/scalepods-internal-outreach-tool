import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function countTableEmailStats(tableName: string, fromISO: string, toISO: string) {
    const base = () => supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true })
        .gte('"Email Last Contacted"', fromISO)
        .lte('"Email Last Contacted"', toISO);

    // Run all count queries in parallel — each gets its own builder instance
    const [contactedRes, repliedRes, ...stageRes] = await Promise.all([
        base(),
        base().eq('"Replied"', 'yes'),
        ...[1, 2, 3, 4, 5, 6].map(i =>
            base().not(`"Email_${i}"`, 'is', null)
        )
    ]);

    const emailCounts = stageRes.map(r => r.count || 0);
    return {
        contacted: contactedRes.count || 0,
        replied: repliedRes.count || 0,
        totalEmails: emailCounts.reduce((a, b) => a + b, 0),
        emailCounts
    };
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = toParam ? new Date(toParam) : new Date();
    toDate.setHours(23, 59, 59, 999);
    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();

    try {
        // Fetch Campaign Analytics
        const { data: campaignAnalytics, error: campaignError } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('*');

        if (campaignError) {
            console.error('Campaign Analytics Error:', campaignError);
        }

        // Fetch Lead Replies ordered by reply_timestamp
        let repliesQuery = supabaseAdmin
            .from('instantly_lead_replies')
            .select('*');

        if (fromParam) {
            repliesQuery = repliesQuery.gte('reply_timestamp', fromISO);
        }
        if (toParam) {
            repliesQuery = repliesQuery.lte('reply_timestamp', toISO);
        }

        const { data: leadReplies, error: repliesError } = await repliesQuery
            .order('reply_timestamp', { ascending: false });

        let allReplies: any[] = [];
        if (repliesError) {
            console.error('Lead Replies Error (reply_timestamp):', repliesError);
            const { data: fallbackReplies } = await supabaseAdmin
                .from('instantly_lead_replies')
                .select('*')
                .order('created_at', { ascending: false });
            allReplies = fallbackReplies || [];
        } else {
            allReplies = leadReplies || [];
        }

        // Use efficient aggregate count queries instead of fetching 50k rows
        const enrichedStats = await countTableEmailStats('ENRICHED_LEADS', fromISO, toISO);

        const emailStats = {
            totalEmails: enrichedStats.totalEmails,
            leadsContacted: enrichedStats.contacted,
            repliedLeads: enrichedStats.replied,
            emailCounts: enrichedStats.emailCounts
        };

        return NextResponse.json({
            campaignAnalytics: campaignAnalytics || [],
            leadReplies: allReplies,
            emailStats
        });
    } catch (error: any) {
        console.error('Email DB Data API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
