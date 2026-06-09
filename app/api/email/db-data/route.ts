import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function countEmailsSent(lead: any): number {
    let count = 0;
    for (let i = 1; i <= 6; i++) {
        if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) count++;
    }
    return count;
}

function isInDateRange(lead: any, fromD: Date, toD: Date): boolean {
    const elc = lead["Email Last Contacted"];
    if (elc) {
        const d = new Date(elc);
        if (!isNaN(d.getTime())) return d >= fromD && d <= toD;
    }
    for (let i = 1; i <= 6; i++) {
        if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) {
            const d = new Date(lead.created_at);
            if (!isNaN(d.getTime())) return d >= fromD && d <= toD;
        }
    }
    return false;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = toParam ? new Date(toParam) : new Date();
    toDate.setHours(23, 59, 59, 999);

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
            repliesQuery = repliesQuery.gte('reply_timestamp', fromDate.toISOString());
        }
        if (toParam) {
            repliesQuery = repliesQuery.lte('reply_timestamp', toDate.toISOString());
        }

        const { data: leadReplies, error: repliesError } = await repliesQuery
            .order('reply_timestamp', { ascending: false });

        let allReplies: any[] = [];
        if (repliesError) {
            console.error('Lead Replies Error (reply_timestamp):', repliesError);
            const { data: fallbackReplies, error: fallbackError } = await supabaseAdmin
                .from('instantly_lead_replies')
                .select('*')
                .order('created_at', { ascending: false });
            if (!fallbackError) allReplies = fallbackReplies || [];
        } else {
            allReplies = leadReplies || [];
        }

        // Compute email stats matching dashboard logic
        const { data: icpLeads } = await supabaseAdmin
            .from('icp_tracker')
            .select('id, created_at, "Email Last Contacted", "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6", "Replied"')
            .limit(50000);

        const { data: enrichedLeads } = await supabaseAdmin
            .from('ENRICHED_LEADS')
            .select('"Url", created_at, "Email Last Contacted", "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6", "Replied"')
            .limit(50000);

        const allLocalLeads = [
            ...(icpLeads || []),
            ...(enrichedLeads || [])
        ];

        let totalEmails = 0, leadsContacted = 0, repliedLeads = 0;
        const emailCounts = [0, 0, 0, 0, 0, 0];

        allLocalLeads.forEach((lead: any) => {
            if (!isInDateRange(lead, fromDate, toDate)) return;

            let hasAnyEmail = false;
            for (let i = 1; i <= 6; i++) {
                if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) {
                    hasAnyEmail = true;
                    emailCounts[i - 1]++;
                    totalEmails++;
                }
            }
            if (hasAnyEmail) leadsContacted++;

            const rep = lead["Replied"] || "";
            if (String(rep).toLowerCase() === "yes") repliedLeads++;
        });

        return NextResponse.json({
            campaignAnalytics: campaignAnalytics || [],
            leadReplies: allReplies,
            emailStats: {
                totalEmails,
                leadsContacted,
                repliedLeads,
                emailCounts
            }
        });
    } catch (error: any) {
        console.error('Email DB Data API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
