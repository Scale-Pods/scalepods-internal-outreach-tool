import { supabaseAdmin } from '@/lib/supabase';

// ── shared constants ──────────────────────────────────────────────────────────

export const EMAIL_STAGE_COUNT = 6;
export const MAX_REPLY_STAGES = 25;

export type LeadType = 'cold' | 'hot';

export const COLD_TABLES = ['ENRICHED_LEADS', 'master_cold_leads'] as const;
export const HOT_TABLE = 'hubspot_lead';

// ── row shape (matches the jsonb shape returned by get_outreach_leads) ──────

export interface EmailStageValue {
    stage: number;
    content: string | null;
    status: string | null;
    messageId: string | null;
}

export interface ReplyEntry {
    index: number;
    userReplied: string | null;
    botReplied: string | null;
    /** True when a reply happened but only _Status JSON metadata is available (no message text) */
    userStatusOnly?: boolean;
    botStatusOnly?: boolean;
}

export interface NormalizedLeadRow {
    id: string;
    table: string;
    leadType: LeadType;
    fullName: string;
    email: string;
    phone: string;
    senderEmail: string | null;
    lastContacted: string | null;
    createdAt: string | null;
    replied: string | null;
    emailReplyTrack: boolean;
    bounced: boolean;
    unsubscribed: boolean;
    stages: EmailStageValue[];
    replies: ReplyEntry[];
    raw: any;
}

function truthyText(val: any): boolean {
    if (val === null || val === undefined) return false;
    const s = String(val).trim().toLowerCase();
    return s !== '' && s !== 'no' && s !== 'none' && s !== 'false' && s !== '0';
}

// ── fetch: full lead rows across the 3 tables, via get_outreach_leads RPC ───
// Stages/replies/identity are all built server-side in Postgres (see
// supabase/migrations/add_email_outreach_leads_pagination_fix.sql) — this is
// now a thin batched-pagination wrapper around the RPC instead of a raw
// table fetch + JS-side normalization.

const RPC_BATCH_SIZE = 1000;
const RPC_MAX_ROWS = 20000;

export async function fetchOutreachLeads(leadType?: LeadType): Promise<NormalizedLeadRow[]> {
    const allRows: NormalizedLeadRow[] = [];
    let offset = 0;

    try {
        while (offset < RPC_MAX_ROWS) {
            const { data, error } = await supabaseAdmin.rpc('get_outreach_leads', {
                p_lead_type: leadType ?? null,
                p_limit: RPC_BATCH_SIZE,
                p_offset: offset,
            });

            if (error) {
                console.error('[email-outreach] get_outreach_leads RPC error:', error.message);
                break;
            }
            if (!data || data.length === 0) break;

            data.forEach((row: any) => allRows.push({ ...row, raw: row }));
            offset += RPC_BATCH_SIZE;

            if (data.length < RPC_BATCH_SIZE) break;
        }
    } catch (e: any) {
        console.error('[email-outreach] get_outreach_leads exception:', e?.message || e);
    }

    return allRows;
}

function inRange(dateStr: string | null, from: Date, to: Date): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= from && d <= to;
}

// ── aggregated metrics ────────────────────────────────────────────────────────

export interface OutreachMetrics {
    totalLeads: number;
    contactedLeads: number;
    emailsSent: number;
    stageSentCounts: number[]; // length 6, count of leads that have Email_N
    repliedLeads: number;
    totalReplies: number; // sum of individual reply entries across all leads
    bouncedLeads: number;
    unsubscribedLeads: number;
    replyRate: number;
}

// Client-side JS aggregation over already-fetched leads — kept for callers
// that already have a NormalizedLeadRow[] in hand (e.g. after date-range
// filtering client-side). For a fresh from/to query, prefer
// getEmailOutreachMetricsRpc() below, which computes this server-side in a
// single round trip instead of pulling every row into Node first.
export function computeMetrics(leads: NormalizedLeadRow[], from: Date, to: Date): OutreachMetrics {
    const stageSentCounts = new Array(EMAIL_STAGE_COUNT).fill(0);
    let contactedLeads = 0;
    let emailsSent = 0;
    let repliedLeads = 0;
    let totalReplies = 0;
    let bouncedLeads = 0;
    let unsubscribedLeads = 0;

    const inScope = leads.filter(l => inRange(l.lastContacted || l.createdAt, from, to));

    inScope.forEach(lead => {
        const sentStages = lead.stages.filter(s => truthyText(s.content));
        if (sentStages.length > 0) {
            contactedLeads++;
            emailsSent += sentStages.length;
            sentStages.forEach(s => stageSentCounts[s.stage - 1]++);
        }
        if (lead.emailReplyTrack) {
            repliedLeads++;
            totalReplies += Math.max(lead.replies.length, 1);
        }
        if (lead.bounced) bouncedLeads++;
        if (lead.unsubscribed) unsubscribedLeads++;
    });

    return {
        totalLeads: inScope.length,
        contactedLeads,
        emailsSent,
        stageSentCounts,
        repliedLeads,
        totalReplies,
        bouncedLeads,
        unsubscribedLeads,
        replyRate: contactedLeads > 0 ? (repliedLeads / contactedLeads) * 100 : 0,
    };
}

// Server-side metrics via get_email_outreach_metrics RPC — computes
// contacted/sent/replied/bounced/unsubscribed counts entirely in Postgres.
// Used by the master dashboard and the email dashboard's summary cards,
// where only the numbers (not full row content) are needed.
export async function getEmailOutreachMetricsRpc(
    fromIso: string,
    toIso: string,
    leadType: LeadType
): Promise<OutreachMetrics> {
    const { data, error } = await supabaseAdmin.rpc('get_email_outreach_metrics', {
        p_from: fromIso,
        p_to: toIso,
        p_lead_type: leadType,
    });

    if (error) {
        console.error('[email-outreach] get_email_outreach_metrics RPC error:', error.message);
        return {
            totalLeads: 0, contactedLeads: 0, emailsSent: 0,
            stageSentCounts: [0, 0, 0, 0, 0, 0],
            repliedLeads: 0, totalReplies: 0,
            bouncedLeads: 0, unsubscribedLeads: 0, replyRate: 0,
        };
    }

    const row = data?.[0] || {};
    return {
        totalLeads: row.total_leads || 0,
        contactedLeads: row.contacted_leads || 0,
        emailsSent: row.emails_sent || 0,
        stageSentCounts: [
            row.stage_1_sent || 0, row.stage_2_sent || 0, row.stage_3_sent || 0,
            row.stage_4_sent || 0, row.stage_5_sent || 0, row.stage_6_sent || 0,
        ],
        repliedLeads: row.replied_leads || 0,
        totalReplies: row.total_replies || 0,
        bouncedLeads: row.bounced_leads || 0,
        unsubscribedLeads: row.unsubscribed_leads || 0,
        replyRate: row.reply_rate || 0,
    };
}

export async function getOutreachDashboardData(from: Date, to: Date) {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [cold, hot] = await Promise.all([
        getEmailOutreachMetricsRpc(fromIso, toIso, 'cold'),
        getEmailOutreachMetricsRpc(fromIso, toIso, 'hot'),
    ]);

    return { cold, hot };
}
