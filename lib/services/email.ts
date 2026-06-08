import { supabaseAdmin } from '@/lib/supabase';

export interface CampaignMetrics {
    campaignId: string;
    campaignName: string;
    status: string;
    leadsCount: number;
    contactedCount: number;
    emailsSentCount: number;
    newLeadsContacted: number;
    uniqueOpens: number;
    uniqueReplies: number;
    uniqueClicks: number;
    bouncedCount: number;
    unsubscribedCount: number;
    completedCount: number;
    totalOpportunities: number;
    totalOpportunityValue: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    clickRate: number;
}

export interface AggregatedMetrics {
    totalLeads: number;
    totalContacted: number;
    totalEmailsSent: number;
    totalUniqueOpens: number;
    totalUniqueReplies: number;
    totalUniqueClicks: number;
    totalBounced: number;
    totalUnsubscribed: number;
    totalCompleted: number;
    totalOpportunities: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    clickRate: number;
}

// Count emails sent for a lead (Email_1 to Email_6)
function countEmailsSent(lead: any): number {
    let count = 0;
    for (let i = 1; i <= 6; i++) {
        if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) count++;
    }
    return count;
}

// Check if lead was contacted in date range using "Email Last Contacted"
function isInDateRange(lead: any, fromD: Date, toD: Date): boolean {
    // Primary: use "Email Last Contacted" timestamp
    const elc = lead["Email Last Contacted"];
    if (elc) {
        const d = new Date(elc);
        if (!isNaN(d.getTime())) return d >= fromD && d <= toD;
    }
    // Fallback: if any Email_N is set, use created_at
    for (let i = 1; i <= 6; i++) {
        if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) {
            const d = new Date(lead.created_at);
            if (!isNaN(d.getTime())) return d >= fromD && d <= toD;
        }
    }
    return false;
}

export async function getEmailStats(fromD: Date, toD: Date) {
    try {
        // Set to full day boundaries
        const fromFull = new Date(fromD);
        fromFull.setHours(0, 0, 0, 0);
        const toFull = new Date(toD);
        toFull.setHours(23, 59, 59, 999);

        // Fetch Instantly campaign analytics
        const { data: campaignAnalytics } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('*');

        // Fetch lead replies within date range
        let repliesQuery = supabaseAdmin
            .from('instantly_lead_replies')
            .select('*')
            .gte('reply_timestamp', fromFull.toISOString())
            .lte('reply_timestamp', toFull.toISOString());

        const { data: leadReplies, error: repliesError } = await repliesQuery
            .order('reply_timestamp', { ascending: false });

        // Fallback if reply_timestamp filter fails
        const allReplies = repliesError
            ? await supabaseAdmin.from('instantly_lead_replies').select('*').order('created_at', { ascending: false }).then(r => r.data || [])
            : (leadReplies || []);

        // Build campaign metrics from Instantly
        const rawCampaigns = campaignAnalytics || [];
        const dataRows = rawCampaigns.filter((r: any) => r.record_id !== 1 && r.campaign_id !== '000_HEADER');

        const campaigns: CampaignMetrics[] = dataRows.map((row: any) => {
            const leadsCount = Number(row.leads_count) || 0;
            const contacted = Number(row.contacted_count) || 0;
            const sent = Number(row.emails_sent_count) || 0;
            const uniqueOpens = Number(row.open_count_unique) || 0;
            const uniqueReplies = Number(row.reply_count_unique) || 0;
            const uniqueClicks = Number(row.link_click_count_unique) || 0;
            const bounced = Number(row.bounced_count) || 0;

            return {
                campaignId: row.campaign_id || '',
                campaignName: row.campaign_name || 'Unnamed Campaign',
                status: row.campaign_status === '1' || row.campaign_status === 1 ? 'Active'
                    : row.campaign_status === '2' || row.campaign_status === 2 ? 'Paused'
                    : row.campaign_status === '3' || row.campaign_status === 3 ? 'Completed' : 'Unknown',
                leadsCount, contactedCount: contacted, emailsSentCount: sent,
                newLeadsContacted: Number(row.new_leads_contacted_count) || 0,
                uniqueOpens, uniqueReplies, uniqueClicks, bouncedCount: bounced,
                unsubscribedCount: Number(row.unsubscribed_count) || 0,
                completedCount: Number(row.completed_count) || 0,
                totalOpportunities: Number(row.total_opportunities) || 0,
                totalOpportunityValue: Number(row.total_opportunity_value) || 0,
                openRate: contacted > 0 ? (uniqueOpens / contacted) * 100 : 0,
                replyRate: contacted > 0 ? (uniqueReplies / contacted) * 100 : 0,
                bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
                clickRate: contacted > 0 ? (uniqueClicks / contacted) * 100 : 0,
            };
        });

        // Fetch ICP leads for local email counting
        const { data: icpLeads } = await supabaseAdmin
            .from('icp_tracker')
            .select('id, created_at, "Email Last Contacted", "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6", "Replied"')
            .limit(50000);

        // Fetch ENRICHED leads for local email counting
        const { data: enrichedLeads } = await supabaseAdmin
            .from('ENRICHED_LEADS')
            .select('"Url", created_at, "Email Last Contacted", "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6", "Replied"')
            .limit(50000);

        const allLeads = [
            ...(icpLeads || []),
            ...(enrichedLeads || [])
        ];

        let totalEmails = 0, leadsContacted = 0, repliedLeads = 0;
        const emailCounts = [0, 0, 0, 0, 0, 0]; // Email_1 ... Email_6

        allLeads.forEach((lead: any) => {
            const inRange = isInDateRange(lead, fromFull, toFull);
            if (!inRange) return;

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

        const EMPTY_METRICS: AggregatedMetrics = {
            totalLeads: 0, totalContacted: 0, totalEmailsSent: 0, totalUniqueOpens: 0, totalUniqueReplies: 0,
            totalUniqueClicks: 0, totalBounced: 0, totalUnsubscribed: 0, totalCompleted: 0, totalOpportunities: 0,
            openRate: 0, replyRate: 0, bounceRate: 0, clickRate: 0,
        };

        const metrics = campaigns.reduce((acc, c) => ({
            totalLeads: acc.totalLeads + c.leadsCount,
            totalContacted: acc.totalContacted + c.contactedCount,
            totalEmailsSent: acc.totalEmailsSent + c.emailsSentCount,
            totalUniqueOpens: acc.totalUniqueOpens + c.uniqueOpens,
            totalUniqueReplies: acc.totalUniqueReplies + c.uniqueReplies,
            totalUniqueClicks: acc.totalUniqueClicks + c.uniqueClicks,
            totalBounced: acc.totalBounced + c.bouncedCount,
            totalUnsubscribed: acc.totalUnsubscribed + c.unsubscribedCount,
            totalCompleted: acc.totalCompleted + c.completedCount,
            totalOpportunities: acc.totalOpportunities + c.totalOpportunities,
            openRate: 0, replyRate: 0, bounceRate: 0, clickRate: 0,
        }), { ...EMPTY_METRICS });

        metrics.openRate = metrics.totalContacted > 0 ? (metrics.totalUniqueOpens / metrics.totalContacted) * 100 : 0;
        metrics.replyRate = metrics.totalContacted > 0 ? (metrics.totalUniqueReplies / metrics.totalContacted) * 100 : 0;
        metrics.bounceRate = metrics.totalEmailsSent > 0 ? (metrics.totalBounced / metrics.totalEmailsSent) * 100 : 0;
        metrics.clickRate = metrics.totalContacted > 0 ? (metrics.totalUniqueClicks / metrics.totalContacted) * 100 : 0;

        return {
            campaigns,
            metrics,
            recentReplies: allReplies.slice(0, 4),
            dbReplyCount: allReplies.length,
            localData: { totalEmails, emailCounts, leadsContacted, repliedLeads }
        };
    } catch (e) {
        console.error("Email stats error:", e);
        throw e;
    }
}
