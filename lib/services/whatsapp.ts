import { supabaseAdmin } from '@/lib/supabase';
import { format, subDays } from "date-fns";

const WA_COLUMNS = `
  id, created_at, last_contacted, "Whatsapp Last Contacted", whatsapp_last_contacted,
  whatsapp_replied, "WTS_Reply_Track",
  stages_passed,
  User_Replied_1,User_Replied_2,User_Replied_3,User_Replied_4,User_Replied_5,
  User_Replied_6,User_Replied_7,User_Replied_8,User_Replied_9,User_Replied_10,
  User_Replied_11,User_Replied_12,User_Replied_13,User_Replied_14,User_Replied_15,
  User_Replied_16,User_Replied_17,User_Replied_18,User_Replied_19,User_Replied_20,
  User_Replied_21,User_Replied_22,User_Replied_23,User_Replied_24,User_Replied_25,
  Bot_Replied_1,Bot_Replied_2,Bot_Replied_3,Bot_Replied_4,Bot_Replied_5,
  Bot_Replied_6,Bot_Replied_7,Bot_Replied_8,Bot_Replied_9,Bot_Replied_10,
  Bot_Replied_11,Bot_Replied_12,Bot_Replied_13,Bot_Replied_14,Bot_Replied_15,
  Bot_Replied_16,Bot_Replied_17,Bot_Replied_18,Bot_Replied_19,Bot_Replied_20,
  Bot_Replied_21,Bot_Replied_22,Bot_Replied_23,Bot_Replied_24,Bot_Replied_25,
  Bot_Replied_Status_1,Bot_Replied_Status_2,Bot_Replied_Status_3,Bot_Replied_Status_4,Bot_Replied_Status_5,
  Bot_Replied_Status_6,Bot_Replied_Status_7,Bot_Replied_Status_8,Bot_Replied_Status_9,Bot_Replied_Status_10,
  Bot_Replied_Status_11,Bot_Replied_Status_12,Bot_Replied_Status_13,Bot_Replied_Status_14,Bot_Replied_Status_15,
  Bot_Replied_Status_16,Bot_Replied_Status_17,Bot_Replied_Status_18,Bot_Replied_Status_19,Bot_Replied_Status_20,
  Bot_Replied_Status_21,Bot_Replied_Status_22,Bot_Replied_Status_23,Bot_Replied_Status_24,Bot_Replied_Status_25,
  Whatsapp_1,Whatsapp_2,Whatsapp_3,Whatsapp_4,Whatsapp_5,
  Whatsapp_1_status,Whatsapp_2_status,Whatsapp_3_status,Whatsapp_4_status,Whatsapp_5_status,
  "W.P_1","W.P_2","W.P_3","W.P_4","W.P_5","W.P_6","W.P_7","W.P_8","W.P_9","W.P_10","W.P_11","W.P_12",
  "W.P_1 TS","W.P_2 TS","W.P_3 TS","W.P_4 TS","W.P_5 TS","W.P_6 TS","W.P_7 TS","W.P_8 TS","W.P_9 TS","W.P_10 TS","W.P_11 TS","W.P_12 TS",
  "W.P_Replied_1","W.P_Replied_2","W.P_Replied_3","W.P_Replied_4","W.P_Replied_5",
  "W.P_Replied_6","W.P_Replied_7","W.P_Replied_8","W.P_Replied_9","W.P_Replied_10",
  stage_data
`;

export async function getWhatsappStats(fromDate: Date, toDate: Date) {
    try {
        const selectColumns = `
          created_at,
          "Whatsapp Last Contacted",
          "WTS_Reply_Track",
          "Replied",
          "Whatsapp_1", "Whatsapp_2", "Whatsapp_3", "Whatsapp_4", "Whatsapp_5",
          "Whatsapp_1_status", "Whatsapp_2_status", "Whatsapp_3_status", "Whatsapp_4_status", "Whatsapp_5_status",
          "User_Replied_1", "User_Replied_2", "User_Replied_3", "User_Replied_4", "User_Replied_5",
          "User_Replied_6", "User_Replied_7", "User_Replied_8", "User_Replied_9", "User_Replied_10",
          "User_Replied_11", "User_Replied_12", "User_Replied_13", "User_Replied_14", "User_Replied_15",
          "User_Replied_16", "User_Replied_17", "User_Replied_18", "User_Replied_19", "User_Replied_20",
          "User_Replied_21", "User_Replied_22", "User_Replied_23", "User_Replied_24", "User_Replied_25",
          "Bot_Replied_1", "Bot_Replied_2", "Bot_Replied_3", "Bot_Replied_4", "Bot_Replied_5",
          "Bot_Replied_6", "Bot_Replied_7", "Bot_Replied_8", "Bot_Replied_9", "Bot_Replied_10",
          "Bot_Replied_11", "Bot_Replied_12", "Bot_Replied_13", "Bot_Replied_14", "Bot_Replied_15",
          "Bot_Replied_16", "Bot_Replied_17", "Bot_Replied_18", "Bot_Replied_19", "Bot_Replied_20",
          "Bot_Replied_21", "Bot_Replied_22", "Bot_Replied_23", "Bot_Replied_24", "Bot_Replied_25",
          "Bot_Replied_Status_1", "Bot_Replied_Status_2", "Bot_Replied_Status_3", "Bot_Replied_Status_4", "Bot_Replied_Status_5",
          "Bot_Replied_Status_6", "Bot_Replied_Status_7", "Bot_Replied_Status_8", "Bot_Replied_Status_9", "Bot_Replied_Status_10",
          "Bot_Replied_Status_11", "Bot_Replied_Status_12", "Bot_Replied_Status_13", "Bot_Replied_Status_14", "Bot_Replied_Status_15",
          "Bot_Replied_Status_16", "Bot_Replied_Status_17", "Bot_Replied_Status_18", "Bot_Replied_Status_19", "Bot_Replied_Status_20",
          "Bot_Replied_Status_21", "Bot_Replied_Status_22", "Bot_Replied_Status_23", "Bot_Replied_Status_24", "Bot_Replied_Status_25"
        `;
        const fetchLeads = async (table: string, source: string) => {
            const { data } = await supabaseAdmin.from(table).select(selectColumns).limit(50000);
            return (data || []).map((l: any) => ({ ...l, _table: table, _source: source }));
        };

        const [icpData, metaData, enrichedData] = await Promise.all([
            fetchLeads("icp_tracker", "icp"),
            fetchLeads("meta_lead_tracker", "meta"),
            fetchLeads("ENRICHED_LEADS", "enriched")
        ]);

        const allLeads = [...icpData, ...metaData, ...enrichedData];

        const hasLeadReplied = (lead: any) => {
            for (let i = 1; i <= 25; i++) {
                const r = lead[`User_Replied_${i}`];
                if (r && String(r).trim() && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') return true;
            }
            if (lead.whatsapp_replied && lead.whatsapp_replied !== "No" && lead.whatsapp_replied !== "none") return true;
            const wtsTrack = lead["WTS_Reply_Track"];
            if (wtsTrack && String(wtsTrack).trim() !== "" && String(wtsTrack).toLowerCase() !== "no" && String(wtsTrack).toLowerCase() !== "none" && String(wtsTrack).toLowerCase() !== "false") return true;
            for (let i = 1; i <= 10; i++) {
                const r = lead[`W.P_Replied_${i}`];
                if (r && String(r).toLowerCase() !== "no" && String(r).toLowerCase() !== "none") return true;
            }
            return false;
        };

        const isWhatsappLead = (l: any) => {
            // Primary signals: actual Whatsapp_1-5 columns (both icp and enriched use these)
            for (let i = 1; i <= 5; i++) {
                if (l[`Whatsapp_${i}`] && String(l[`Whatsapp_${i}`]).trim()) return true;
            }
            // W.P_1 - W.P_12 columns (meta_lead_tracker)
            for (let i = 1; i <= 12; i++) {
                if (l[`W.P_${i}`] && String(l[`W.P_${i}`]).trim()) return true;
            }
            // User_Replied or Bot_Replied means WA was used
            for (let i = 1; i <= 25; i++) {
                const ur = l[`User_Replied_${i}`];
                if (ur && !['no','none',''].includes(String(ur).trim().toLowerCase())) return true;
                if (l[`Bot_Replied_${i}`] && String(l[`Bot_Replied_${i}`]).trim()) return true;
            }
            // WTS_Reply_Track also indicates WA involvement
            const wts = l["WTS_Reply_Track"];
            if (wts && !['no','none','false',''].includes(String(wts).trim().toLowerCase())) return true;
            return false;
        };

        const icpWhatsapp = icpData.filter(isWhatsappLead);
        const metaWhatsapp = metaData.filter(isWhatsappLead);
        const enrichedWhatsapp = enrichedData.filter(isWhatsappLead);

        const allWhatsappLeads = [...icpWhatsapp, ...metaWhatsapp, ...enrichedWhatsapp];

        // Date filtering
        const fromD = new Date(fromDate);
        fromD.setHours(0, 0, 0, 0);
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);

        const filteredLeads = allWhatsappLeads.filter((lead: any) => {
            // Use best available date: prefer "Whatsapp Last Contacted", fall back to created_at
            const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"] || lead.created_at;
            if (!wlc) return false;
            const contactDate = new Date(wlc);
            if (isNaN(contactDate.getTime())) return false;
            return contactDate >= fromD && contactDate <= toD;
        });

        const dailyGroups: Record<string, { date: string; sent: number; replied: number; bot: number }> = {};
        const stageCounts = [0, 0, 0, 0, 0];
        const statuses: Record<string, number> = { read: 0, delivered: 0, sent: 0, failed: 0 };

        let messagesSent = 0, icpMessagesSent = 0, metaMessagesSent = 0, enrichedMessagesSent = 0;
        let botMessages = 0;
        let leadsContacted = 0, icpLeadsContacted = 0, metaLeadsContacted = 0, enrichedLeadsContacted = 0;
        let totalReplies = 0, icpRepliedCount = 0, metaRepliedCount = 0, enrichedRepliedCount = 0;
        let readCount = 0, deliveredCount = 0, waitingCount = 0, failedCount = 0;

        filteredLeads.forEach((lead: any) => {
            let leadSentCount = 0;
            let leadBotCount = 0;

            for (let i = 1; i <= 5; i++) {
                if (lead[`Whatsapp_${i}`] && String(lead[`Whatsapp_${i}`]).trim()) {
                    leadSentCount++;
                    stageCounts[i - 1]++;
                }
                // Status columns: Whatsapp_1_status ... Whatsapp_5_status
                const status = String(lead[`Whatsapp_${i}_status`] || "").toLowerCase();
                if (status.includes("failed")) { statuses.failed++; failedCount++; }
                else if (status.includes("read")) { statuses.read++; readCount++; }
                else if (status.includes("delivered")) { statuses.delivered++; deliveredCount++; }
                else if (status.includes("sent")) { statuses.sent++; }
            }

            for (let i = 1; i <= 25; i++) {
                if (lead[`Bot_Replied_${i}`] && String(lead[`Bot_Replied_${i}`]).trim()) { 
                    leadBotCount++; 
                    leadSentCount++; 
                }
                const bStatus = String(lead[`Bot_Replied_Status_${i}`] || "").toLowerCase();
                if (bStatus.includes("failed")) { statuses.failed++; failedCount++; }
            }

            if (leadSentCount === 0) {
                for (let i = 1; i <= 12; i++) {
                    if (lead[`W.P_${i}`] && String(lead[`W.P_${i}`]).trim()) leadSentCount++;
                    const ts = String(lead[`W.P_${i} TS`] || "").toLowerCase();
                    if (ts.includes("failed")) { statuses.failed++; failedCount++; }
                }
            }

            if (leadSentCount > 0) {
                leadsContacted++;
                if (lead._source === 'icp') icpLeadsContacted++;
                else if (lead._source === 'meta') metaLeadsContacted++;
                else if (lead._source === 'enriched') enrichedLeadsContacted++;
            }
            messagesSent += leadSentCount;
            if (lead._source === 'icp') icpMessagesSent += leadSentCount;
            else if (lead._source === 'meta') metaMessagesSent += leadSentCount;
            else if (lead._source === 'enriched') enrichedMessagesSent += leadSentCount;
            botMessages += leadBotCount;

            const isReplied = hasLeadReplied(lead);
            if (isReplied) {
                totalReplies++;
                if (lead._source === 'icp') icpRepliedCount++;
                else if (lead._source === 'meta') metaRepliedCount++;
                else if (lead._source === 'enriched') enrichedRepliedCount++;
            } else if (leadSentCount > 0) {
                waitingCount++;
            }

            const wlc = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
            if (wlc) {
                const d = new Date(wlc);
                if (!isNaN(d.getTime())) {
                    const dStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    if (!dailyGroups[dStr]) dailyGroups[dStr] = { date: dStr, sent: 0, replied: 0, bot: 0 };
                    dailyGroups[dStr].sent += leadSentCount;
                    dailyGroups[dStr].bot += leadBotCount;
                    if (isReplied) dailyGroups[dStr].replied += 1;
                }
            }
        });

        const totalStatusMessages = statuses.read + statuses.delivered + statuses.sent;

        const stats = {
            totalLeads: filteredLeads.length,
            icpLeadCount: icpWhatsapp.length,
            metaLeadCount: metaWhatsapp.length,
            enrichedLeadCount: enrichedWhatsapp.length,
            leadsContacted, icpLeadsContacted, metaLeadsContacted, enrichedLeadsContacted,
            messagesSent, icpMessagesSent, metaMessagesSent, enrichedMessagesSent,
            botMessages, totalReplies, icpRepliedCount, metaRepliedCount, enrichedRepliedCount,
            replyRate: leadsContacted > 0 ? (totalReplies / leadsContacted) * 100 : 0,
            readRate: totalStatusMessages > 0 ? (statuses.read / totalStatusMessages) * 100 : 0,
            deliveredCount, readCount, waitingCount, failedCount,
            avgMessagesPerLead: leadsContacted > 0 ? Math.round((messagesSent / leadsContacted) * 10) / 10 : 0,
        };

        const trendData = Object.values(dailyGroups)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-14);

        const stageData = [
            { stage: 'Drip 1', count: stageCounts[0], fill: '#6366f1' },
            { stage: 'Drip 2', count: stageCounts[1], fill: '#3b82f6' },
            { stage: 'Drip 3', count: stageCounts[2], fill: '#8b5cf6' },
            { stage: 'Drip 4', count: stageCounts[3], fill: '#a855f7' },
            { stage: 'Drip 5', count: stageCounts[4], fill: '#c084fc' },
        ];

        const statusDistribution = [
            { name: 'Read', value: statuses.read, color: '#10b981' },
            { name: 'Delivered', value: statuses.delivered, color: '#3b82f6' },
            { name: 'Sent', value: statuses.sent, color: '#94a3b8' },
            { name: 'Failed', value: statuses.failed, color: '#ef4444' },
        ].filter(d => d.value > 0);

        // Required for the DeliveryStatusDetailedCard component
        // which iterates over allLeads.
        // We only return the specific fields needed to reduce payload
        const simplifiedLeads = filteredLeads.map(l => {
            const mapped: any = { _source: l._source, whatsapp_replied: l.whatsapp_replied, WTS_Reply_Track: l.WTS_Reply_Track };
            for(let i=1; i<=5; i++) {
                mapped[`Whatsapp_${i}`] = l[`Whatsapp_${i}`];
                mapped[`Whatsapp_${i}_status`] = l[`Whatsapp_${i}_status`];
            }
            for(let i=1; i<=25; i++) {
                mapped[`Bot_Replied_${i}`] = l[`Bot_Replied_${i}`];
                mapped[`Bot_Replied_Status_${i}`] = l[`Bot_Replied_Status_${i}`];
                mapped[`User_Replied_${i}`] = l[`User_Replied_${i}`];
            }
            for(let i=1; i<=12; i++) {
                mapped[`W.P_${i}`] = l[`W.P_${i}`];
                mapped[`W.P_${i} TS`] = l[`W.P_${i} TS`];
            }
            for(let i=1; i<=10; i++) {
                mapped[`W.P_Replied_${i}`] = l[`W.P_Replied_${i}`];
            }
            return mapped;
        });

        return { stats, trendData, stageData, statusDistribution, simplifiedLeads };

    } catch (error: any) {
        console.error("WhatsApp stats error:", error);
        throw error;
    }
}
