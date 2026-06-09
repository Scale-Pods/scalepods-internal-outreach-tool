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

function countTable(tableName: string, fromISO: string, toISO: string) {
    const base = () => supabaseAdmin.from(tableName).select('*', { count: 'exact', head: true })
        .gte('"Email Last Contacted"', fromISO)
        .lte('"Email Last Contacted"', toISO);

    return Promise.all([
        base(),
        base().eq('"Replied"', 'yes'),
        ...[1, 2, 3, 4, 5, 6].map(i => base().not(`"Email_${i}"`, 'is', null))
    ]);
}

export async function getEmailStats(fromD: Date, toD: Date) {
    try {
        const fromFull = new Date(fromD);
        fromFull.setHours(0, 0, 0, 0);
        const toFull = new Date(toD);
        toFull.setHours(23, 59, 59, 999);
        const fromISO = fromFull.toISOString();
        const toISO = toFull.toISOString();

        // Fetch campaign analytics (cumulative, can't date-filter)
        const { data: campaignAnalytics } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('*');

        // Build campaign metrics
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

        // Fetch lead replies within date range
        let repliesQuery = supabaseAdmin
            .from('instantly_lead_replies')
            .select('*')
            .gte('reply_timestamp', fromISO)
            .lte('reply_timestamp', toISO);

        const { data: leadReplies, error: repliesError } = await repliesQuery
            .order('reply_timestamp', { ascending: false });

        const allReplies = repliesError
            ? await supabaseAdmin.from('instantly_lead_replies').select('*').order('created_at', { ascending: false }).then(r => r.data || [])
            : (leadReplies || []);

        // Use aggregate count queries instead of fetching 50k rows
        const [icpResults, enrichedResults] = await Promise.all([
            countTable('icp_tracker', fromISO, toISO),
            countTable('ENRICHED_LEADS', fromISO, toISO)
        ]);

        const extract = (results: Awaited<ReturnType<typeof countTable>>) => ({
            contacted: results[0].count || 0,
            replied: results[1].count || 0,
            stageCounts: results.slice(2).map(r => r.count || 0)
        });

        const icp = extract(icpResults);
        const enriched = extract(enrichedResults);

        const localData = {
            leadsContacted: icp.contacted + enriched.contacted,
            repliedLeads: icp.replied + enriched.replied,
            totalEmails: [...icp.stageCounts, ...enriched.stageCounts].reduce((a, b) => a + b, 0),
            emailCounts: icp.stageCounts.map((c, i) => c + enriched.stageCounts[i])
        };

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
            localData
        };
    } catch (e) {
        console.error("Email stats error:", e);
        throw e;
    }
}
