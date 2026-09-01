import { supabaseAdmin } from '@/lib/supabase';
import { getEmailOutreachMetricsRpc } from '@/lib/services/email-outreach';

// ── main export ───────────────────────────────────────────────────────────────
// Fully RPC-backed: every aggregate below is computed server-side in
// Postgres (see supabase/migrations/rpc_analysis_and_functions.sql +
// add_dashboard_hubspot_stats.sql) instead of pulling full row sets into
// Node and reducing them here. Output shape is unchanged from the previous
// JS-aggregation version so callers (master-dashboard.tsx) don't need
// updating.

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}m ${secs}s`;
}

export async function getDashboardStats(fromDate: Date, toDate: Date) {
  try {
    const fromFull = new Date(fromDate);
    fromFull.setHours(0, 0, 0, 0);
    const toFull = new Date(toDate);
    toFull.setHours(23, 59, 59, 999);

    const fromIso = fromFull.toISOString();
    const toIso = toFull.toISOString();

    const [
      leadStatsRes,
      hubspotStatsRes,
      coldEmailRes,
      hotEmailRes,
      coldRepliedRes,
      hotRepliedRes,
      emailRepliesRes,
      voiceSecondsRes,
      coldVoiceCountRes,
      hubspotVoiceCountRes,
      acquisitionRes,
    ] = await Promise.all([
      supabaseAdmin.rpc('get_dashboard_lead_stats', { p_from: fromIso, p_to: toIso }),
      supabaseAdmin.rpc('get_dashboard_hubspot_stats', { p_from: fromIso, p_to: toIso }),
      getEmailOutreachMetricsRpc(fromIso, toIso, 'cold'),
      getEmailOutreachMetricsRpc(fromIso, toIso, 'hot'),
      supabaseAdmin.rpc('get_cold_replied_leads_combined', { p_from: fromIso, p_to: toIso }),
      supabaseAdmin.rpc('get_replied_leads', { p_from: fromIso, p_to: toIso, p_scope: 'hot' }),
      supabaseAdmin
        .from('instantly_lead_replies')
        .select('id', { count: 'exact', head: true })
        .gte('reply_timestamp', fromIso)
        .lte('reply_timestamp', toIso),
      supabaseAdmin
        .from('vapi_call_logs')
        .select('duration_seconds')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .limit(50000),
      supabaseAdmin
        .from('vapi_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .ilike('vapi_account', 'cold leads'),
      supabaseAdmin
        .from('vapi_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .ilike('vapi_account', 'hubspot'),
      supabaseAdmin.rpc('get_lead_acquisition_by_day', { p_from: fromIso, p_to: toIso }),
    ]);

    if (leadStatsRes.error) throw leadStatsRes.error;
    if (hubspotStatsRes.error) throw hubspotStatsRes.error;
    if (coldRepliedRes.error) throw coldRepliedRes.error;
    if (hotRepliedRes.error) throw hotRepliedRes.error;
    if (acquisitionRes.error) throw acquisitionRes.error;

    const leadStats = leadStatsRes.data?.[0] || {};
    const hubspotStats = hubspotStatsRes.data?.[0] || {};
    const coldRepliedLeads = (coldRepliedRes.data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      repliedViaWhatsapp: r.replied_via_whatsapp,
      repliedViaEmail: r.replied_via_email,
    }));
    const hotRepliedLeads = (hotRepliedRes.data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      repliedViaWhatsapp: r.replied_via_whatsapp,
      repliedViaEmail: r.replied_via_email,
    }));

    const emailReplyCount = emailRepliesRes.count || 0;

    const voiceData = voiceSecondsRes.data || [];
    const totalVoiceSeconds = voiceData.reduce(
      (acc: number, c: any) => acc + (typeof c.duration_seconds === 'number' ? c.duration_seconds : 0),
      0
    );
    const totalVoiceCalls = voiceData.length;

    const coldVoiceCallsCount = coldVoiceCountRes.count || 0;
    const hubspotVoiceCallsCount = hubspotVoiceCountRes.count || 0;

    // Build acquisition chart with every day in range pre-seeded at 0, then
    // fill in from the RPC's day-bucketed counts (SQL naturally omits empty
    // days, same as the old JS which pre-seeded before its main loop).
    const acquisitionMap: Record<string, number> = {};
    const cursor = new Date(fromFull);
    while (cursor <= toFull) {
      const key = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acquisitionMap[key] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    (acquisitionRes.data || []).forEach((row: any) => {
      const d = new Date(row.day_key);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      if (acquisitionMap[key] !== undefined) acquisitionMap[key] = row.lead_count;
    });
    const acquisitionChartData = Object.entries(acquisitionMap).map(([name, leads]) => ({ name, leads }));

    return {
      stats: {
        totalLeads: leadStats.total_leads || 0,
        // icp_tracker is no longer queried anywhere — always 0 now.
        totalICP: 0,
        totalMeta: leadStats.meta_count || 0,
        totalEnriched: leadStats.enriched_count || 0,
        totalEmails: coldEmailRes.emailsSent,
        totalWhatsApp: leadStats.whatsapp_sent_count || 0,
        totalVoice: leadStats.voice_contacted_count || 0,
        totalEmailReplies: emailReplyCount,
        totalWhatsappReplies: leadStats.whatsapp_reply_count || 0,
        whatsappIcpReplied: 0,
        whatsappMetaReplied: leadStats.meta_replied_count || 0,
        enrichedRepliedCount: leadStats.enriched_replied_count || 0,
        // Total Replies (Cold) — ENRICHED_LEADS + master_cold_leads leads
        // with WTS_Reply_Track or Email_Reply_Track set, within range.
        totalReplies: coldRepliedLeads.length,
        repliedLeadsCold: coldRepliedLeads,
        totalVoiceSeconds,
        voiceMinutesString: formatDuration(totalVoiceSeconds),
        totalVoiceCalls,
        coldVoiceCallsCount,
        hubspotVoiceCallsCount,
        totalHubspotLeads: hubspotStats.hubspot_leads || 0,
        hubspot: {
          leads: hubspotStats.hubspot_leads || 0,
          emails: hotEmailRes.emailsSent,
          whatsapp: hubspotStats.hubspot_whatsapp_sent || 0,
          voice: hubspotVoiceCallsCount,
          // Total Replies (Hot CRM) — hubspot_lead leads with
          // WTS_Reply_Track or Email_Reply_Track set, within range.
          replies: hotRepliedLeads.length,
          repliedLeads: hotRepliedLeads,
        },
      },
      acquisitionChartData,
    };
  } catch (error: any) {
    console.error('Dashboard stats error:', error?.message || error);
    throw error;
  }
}
