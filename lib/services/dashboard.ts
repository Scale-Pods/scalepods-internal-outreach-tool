import { supabaseAdmin } from '@/lib/supabase';

// ── helpers ───────────────────────────────────────────────────────────────────

function hasTruthy(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toLowerCase();
  return s !== '' && s !== 'no' && s !== 'none' && s !== 'false' && s !== '0';
}

/** Pick the best date to represent when this lead was last active */
function extractDate(lead: any): string | null {
  // Use whichever date is most relevant
  return (
    lead["Email Last Contacted"] ||
    lead["Whatsapp Last Contacted"] ||
    lead["Voice Last Contacted"] ||
    lead.voice_last_contacted ||
    lead.created_at ||
    null
  );
}

/** Has the lead received at least one WhatsApp message from us? */
function hasWhatsappSent(lead: any): boolean {
  for (let i = 1; i <= 5; i++) {
    if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) return true;
  }
  // fallback: W.P_1 … W.P_12 columns (meta_lead_tracker has these)
  for (let i = 1; i <= 12; i++) {
    if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) return true;
  }
  return false;
}

/** Has the user (human) replied on WhatsApp? */
function hasWhatsappReplied(lead: any): boolean {
  for (let i = 1; i <= 25; i++) {
    const r = lead[`User_Replied_${i}`];
    if (r && String(r).trim() && !['no', 'none', 'false'].includes(String(r).trim().toLowerCase())) return true;
  }
  const wts = lead["WTS_Reply_Track"];
  if (wts && String(wts).trim() && !['no', 'none', 'false', ''].includes(String(wts).trim().toLowerCase())) return true;
  for (let i = 1; i <= 10; i++) {
    const r = lead[`W.P_Replied_${i}`];
    if (r && !['no', 'none'].includes(String(r).trim().toLowerCase())) return true;
  }
  return false;
}

/** Has the lead received at least one email? */
function hasEmailSent(lead: any): boolean {
  for (let i = 1; i <= 6; i++) {
    if (lead[`Email_${i}`] && String(lead[`Email_${i}`]).trim()) return true;
  }
  return false;
}

/** Has the lead been called? */
function hasVoiceSent(lead: any): boolean {
  // icp_tracker / ENRICHED_LEADS use "Voice_1_Status", "Voice_1_Date"
  if (lead["Voice_1_Status"] && String(lead["Voice_1_Status"]).trim()) return true;
  if (lead["Voice_1_Date"]) return true;
  if (lead["Voice_2_Status"] && String(lead["Voice_2_Status"]).trim()) return true;
  if (lead["Voice_2_Date"]) return true;
  // meta_lead_tracker might use Voice_1, Voice_2, Voice_3 text columns
  for (let i = 1; i <= 3; i++) {
    if (lead[`Voice_${i}`] && String(lead[`Voice_${i}`]).trim()) return true;
  }
  return false;
}

// ── fetchers ──────────────────────────────────────────────────────────────────

async function fetchTable(tableName: string, columns: string, limit = 50000) {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select(columns)
      .limit(limit);
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error(`Exception fetching ${tableName}:`, e);
    return [];
  }
}

// ── main export ───────────────────────────────────────────────────────────────

export async function getDashboardStats(fromDate: Date, toDate: Date) {
  try {
    const fromFull = new Date(fromDate);
    fromFull.setHours(0, 0, 0, 0);
    const toFull = new Date(toDate);
    toFull.setHours(23, 59, 59, 999);

    const ICP_DASHBOARD_COLUMNS = `
      created_at,
      "Email Last Contacted",
      "Whatsapp Last Contacted",
      "Voice Last Contacted",
      voice_last_contacted,
      "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6",
      "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
      "WTS_Reply_Track",
      "Voice_1_Status", "Voice_1_Date", "Voice_2_Status", "Voice_2_Date",
      "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
      "User_Replied_6", "User_Replied_7", "User_Replied_8", "User_Replied_9", "User_Replied_10",
      "User_Replied_11", "User_Replied_12", "User_Replied_13", "User_Replied_14", "User_Replied_15",
      "User_Replied_16", "User_Replied_17", "User_Replied_18", "User_Replied_19", "User_Replied_20",
      "User_Replied_21", "User_Replied_22", "User_Replied_23", "User_Replied_24", "User_Replied_25"
    `;

    const ENRICHED_DASHBOARD_COLUMNS = `
      created_at,
      "Email Last Contacted",
      "Whatsapp Last Contacted",
      "Voice Last Contacted",
      voice_last_contacted,
      "Email_1", "Email_2", "Email_3", "Email_4", "Email_5", "Email_6",
      "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
      "WTS_Reply_Track",
      "Voice_1_Status", "Voice_1_Date", "Voice_2_Status", "Voice_2_Date",
      "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
      "User_Replied_6", "User_Replied_7", "User_Replied_8", "User_Replied_9", "User_Replied_10",
      "User_Replied_11", "User_Replied_12", "User_Replied_13", "User_Replied_14", "User_Replied_15",
      "User_Replied_16", "User_Replied_17", "User_Replied_18", "User_Replied_19", "User_Replied_20",
      "User_Replied_21", "User_Replied_22", "User_Replied_23", "User_Replied_24", "User_Replied_25"
    `;

    const META_DASHBOARD_COLUMNS = `
      created_at,
      "Whatsapp Last Contacted",
      "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
      "WTS_Reply_Track",
      "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
      "User_Replied_6", "User_Replied_7", "User_Replied_8", "User_Replied_9", "User_Replied_10",
      "User_Replied_11", "User_Replied_12", "User_Replied_13", "User_Replied_14", "User_Replied_15",
      "User_Replied_16", "User_Replied_17", "User_Replied_18", "User_Replied_19", "User_Replied_20",
      "User_Replied_21", "User_Replied_22", "User_Replied_23", "User_Replied_24", "User_Replied_25"
    `;

    // Fetch all rows from all three lead tables (no DB-level date filter —
    // we filter in-memory because the "contacted" date may differ from created_at)
    const [icpRows, metaRows, enrichedRows, emailReplies, voiceCalls, hubspotRows, coldVoiceCallsRes, hubspotVoiceCallsRes] = await Promise.all([
      fetchTable("icp_tracker", ICP_DASHBOARD_COLUMNS),
      fetchTable("meta_lead_tracker", META_DASHBOARD_COLUMNS),
      fetchTable("ENRICHED_LEADS", ENRICHED_DASHBOARD_COLUMNS),
      supabaseAdmin
        .from('instantly_lead_replies')
        .select('id', { count: 'exact', head: false })
        .gte('reply_timestamp', fromFull.toISOString())
        .lte('reply_timestamp', toFull.toISOString()),
      supabaseAdmin
        .from('vapi_call_logs')
        .select('started_at, duration_seconds, status, vapi_account')
        .gte('created_at', fromFull.toISOString())
        .lte('created_at', toFull.toISOString()),
      fetchTable("hubspot_lead", ICP_DASHBOARD_COLUMNS),
      // Cold leads voice calls count
      supabaseAdmin
        .from('vapi_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromFull.toISOString())
        .lte('created_at', toFull.toISOString())
        .ilike('vapi_account', 'cold leads'),
      // HubSpot leads voice calls count
      supabaseAdmin
        .from('vapi_call_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromFull.toISOString())
        .lte('created_at', toFull.toISOString())
        .ilike('vapi_account', 'hubspot'),
    ]);

    const allLeads = [
      ...icpRows.map((l: any) => ({ ...l, _table: 'icp_tracker' })),
      ...metaRows.map((l: any) => ({ ...l, _table: 'meta_lead_tracker' })),
      ...enrichedRows.map((l: any) => ({ ...l, _table: 'ENRICHED_LEADS' })),
    ];

    const emailReplyCount = emailReplies.count || 0;

    // Voice stats from vapi_call_logs (using created_at filter)
    const voiceData = voiceCalls.data || [];
    const totalVoiceSeconds = voiceData.reduce(
      (acc: number, c: any) => acc + (typeof c.duration_seconds === 'number' ? c.duration_seconds : 0),
      0
    );
    const totalVoiceCalls = voiceData.length;

    // Bifurcated voice call counts by vapi_account
    const coldVoiceCallsCount = coldVoiceCallsRes.count || 0;
    const hubspotVoiceCallsCount = hubspotVoiceCallsRes.count || 0;

    // Build acquisition chart skeleton (one slot per day in range)
    const acquisitionMap: Record<string, number> = {};
    const cursor = new Date(fromFull);
    while (cursor <= toFull) {
      const key = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acquisitionMap[key] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }

    let totalLeads = 0, icpCount = 0, metaCount = 0, enrichedCount = 0;
    let emailSentCount = 0, whatsappSentCount = 0, voiceContactedCount = 0;
    let whatsappReplyCount = 0, icpRepliedCount = 0, metaRepliedCount = 0, enrichedRepliedCount = 0;

    allLeads.forEach((lead: any) => {
      const dateStr = extractDate(lead);
      if (!dateStr) return;

      const leadDate = new Date(dateStr);
      if (isNaN(leadDate.getTime())) return;
      if (leadDate < fromFull || leadDate > toFull) return;

      totalLeads++;
      if (lead._table === 'meta_lead_tracker') metaCount++;
      else if (lead._table === 'ENRICHED_LEADS') enrichedCount++;
      else icpCount++;

      const dayKey = leadDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (acquisitionMap[dayKey] !== undefined) acquisitionMap[dayKey]++;

      if (hasEmailSent(lead)) emailSentCount++;
      if (hasWhatsappSent(lead)) whatsappSentCount++;
      if (hasVoiceSent(lead)) voiceContactedCount++;

      if (hasWhatsappReplied(lead)) {
        whatsappReplyCount++;
        if (lead._table === 'meta_lead_tracker') metaRepliedCount++;
        else if (lead._table === 'ENRICHED_LEADS') enrichedRepliedCount++;
        else icpRepliedCount++;
      }
    });

    let hubspotLeads = 0, hubspotEmailSent = 0, hubspotWhatsappSent = 0, hubspotVoiceContacted = 0, hubspotWhatsappReply = 0;
    
    hubspotRows.forEach((lead: any) => {
      const dateStr = extractDate(lead);
      if (!dateStr) return;
      const leadDate = new Date(dateStr);
      if (isNaN(leadDate.getTime())) return;
      if (leadDate < fromFull || leadDate > toFull) return;

      hubspotLeads++;
      if (hasEmailSent(lead)) hubspotEmailSent++;
      if (hasWhatsappSent(lead)) hubspotWhatsappSent++;
      if (hasVoiceSent(lead)) hubspotVoiceContacted++;
      if (hasWhatsappReplied(lead)) hubspotWhatsappReply++;
    });

    const acquisitionChartData = Object.entries(acquisitionMap).map(([name, leads]) => ({ name, leads }));

    function formatDuration(totalSeconds: number) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.floor(totalSeconds % 60);
      return `${mins}m ${secs}s`;
    }

    return {
      stats: {
        totalLeads,
        totalICP: icpCount,
        totalMeta: metaCount,
        totalEnriched: enrichedCount,
        totalEmails: emailSentCount,
        totalWhatsApp: whatsappSentCount,
        totalVoice: voiceContactedCount,
        totalEmailReplies: emailReplyCount,
        totalWhatsappReplies: whatsappReplyCount,
        whatsappIcpReplied: icpRepliedCount,
        whatsappMetaReplied: metaRepliedCount,
        enrichedRepliedCount,
        totalReplies: emailReplyCount + whatsappReplyCount,
        totalVoiceSeconds,
        voiceMinutesString: formatDuration(totalVoiceSeconds),
        totalVoiceCalls,
        // Bifurcated voice call counts from vapi_account
        coldVoiceCallsCount,
        hubspotVoiceCallsCount,
        totalHubspotLeads: hubspotLeads,
        hubspot: {
            leads: hubspotLeads,
            emails: hubspotEmailSent,
            whatsapp: hubspotWhatsappSent,
            // Use actual vapi_call_logs count for hubspot voice
            voice: hubspotVoiceCallsCount,
            replies: hubspotWhatsappReply
        }
      },
      acquisitionChartData,
    };
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    throw error;
  }
}
