import { supabaseAdmin } from '@/lib/supabase';

// ── shared constants ──────────────────────────────────────────────────────────

export const EMAIL_STAGE_COUNT = 6;
export const MAX_REPLY_STAGES = 25;

export type LeadType = 'cold' | 'hot';

// Which table backs each lead type. Cold outreach spans two tables because
// leads live in ENRICHED_LEADS (Lusha-enriched) and master_cold_leads (Instantly-managed).
export const COLD_TABLES = ['ENRICHED_LEADS', 'master_cold_leads'] as const;
export const HOT_TABLE = 'hubspot_lead';

// ── row shape (only the columns we actually read) ────────────────────────────

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

function pick(row: any, keys: string[]): any {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    }
    return null;
}

// ── column selections per table (only what these pages need) ────────────────

const EMAIL_STAGE_COLS = Array.from({ length: EMAIL_STAGE_COUNT }, (_, i) => i + 1)
    .flatMap(i => [`"Email_${i}"`, `"Email_${i}_Status"`, `"Email_${i}_Message_ID"`])
    .join(', ');

const REPLY_COLS = Array.from({ length: MAX_REPLY_STAGES }, (_, i) => i + 1)
    .flatMap(i => [`"User_Replied_${i}"`, `"Bot_Replied_${i}"`])
    .join(', ');

// master_cold_leads has both the content columns (User_Replied_N / Bot_Replied_N)
// and separate _Status columns (JSON metadata: status/timestamp/message_id) — fetch both.
const REPLY_STATUS_COLS = Array.from({ length: MAX_REPLY_STAGES }, (_, i) => i + 1)
    .flatMap(i => [`"User_Replied_Status_${i}"`, `"Bot_Replied_Status_${i}"`])
    .join(', ');

const ENRICHED_LEADS_COLUMNS = `
    id, lead_uuid, lead_type, full_name, "First Name", "Last Name",
    "Personal Email", "Work Email", "SENDERS  EMAIL", company_phone_number, personal_phone,
    "Email Last Contacted", "Replied", email_bounced, email_unsubscribed, created_at,
    ${EMAIL_STAGE_COLS}, ${REPLY_COLS}
`;

const MASTER_COLD_LEADS_COLUMNS = `
    lead_uuid, full_name, first_name, last_name, email, "Personal Email",
    mobile_number, company_phone_number, "SENDERS  EMAIL",
    "Email Last Contacted", "Replied",
    email_bounced, email_unsubscribed, email_status, email_last_sent_at, created_at,
    ${EMAIL_STAGE_COLS}, ${REPLY_COLS}, ${REPLY_STATUS_COLS}
`;

const HUBSPOT_LEAD_COLUMNS = `
    lead_id, full_name, "First Name", "Last Name", "Personal Email", "Work Email", "SENDERS  EMAIL",
    company_phone_number, personal_phone,
    "Email Last Contacted", "Replied", email_bounced, email_unsubscribed, created_at,
    ${EMAIL_STAGE_COLS}, ${REPLY_COLS}
`;

async function fetchAll(tableName: string, columns: string, limit = 20000) {
    try {
        const { data, error } = await supabaseAdmin.from(tableName).select(columns).limit(limit);
        if (error) {
            console.error(`[email-outreach] fetch error for ${tableName}:`, error.message);
            return [];
        }
        return data || [];
    } catch (e: any) {
        console.error(`[email-outreach] fetch exception for ${tableName}:`, e.message);
        return [];
    }
}

// ── normalization ─────────────────────────────────────────────────────────────

function normalizeRow(row: any, table: string, leadType: LeadType): NormalizedLeadRow {
    const stages: EmailStageValue[] = [];
    for (let i = 1; i <= EMAIL_STAGE_COUNT; i++) {
        const content = row[`Email_${i}`] ?? null;
        const status = row[`Email_${i}_Status`] ?? null;
        const messageId = row[`Email_${i}_Message_ID`] ?? null;
        stages.push({ stage: i, content, status, messageId });
    }

    const replies: ReplyEntry[] = [];
    for (let i = 1; i <= MAX_REPLY_STAGES; i++) {
        // Use the actual message content columns (User_Replied_N / Bot_Replied_N) as display text.
        // The _Status columns (master_cold_leads) hold JSON metadata (status/timestamp/message_id),
        // not display text — only used to detect that a reply happened when content is missing.
        const userContent = row[`User_Replied_${i}`] ?? null;
        const botContent = row[`Bot_Replied_${i}`] ?? null;
        const userStatus = row[`User_Replied_Status_${i}`] ?? null;
        const botStatus = row[`Bot_Replied_Status_${i}`] ?? null;

        const hasUser = truthyText(userContent) || truthyText(userStatus);
        const hasBot = truthyText(botContent) || truthyText(botStatus);

        if (hasUser || hasBot) {
            replies.push({
                index: i,
                userReplied: truthyText(userContent) ? userContent : null,
                botReplied: truthyText(botContent) ? botContent : null,
                userStatusOnly: hasUser && !truthyText(userContent),
                botStatusOnly: hasBot && !truthyText(botContent),
            });
        }
    }

    const id = String(
        row.lead_uuid || row.id || row.lead_id || row.company_phone_number || `${table}-${Math.random().toString(36).slice(2)}`
    );

    const fullName = String(
        row.full_name || `${row['First Name'] || row.first_name || ''} ${row['Last Name'] || row.last_name || ''}`.trim() || 'Unknown Lead'
    );

    const email = String(
        pick(row, ['Personal Email', 'Work Email', 'email']) || 'No Email'
    );

    const phone = String(pick(row, ['company_phone_number', 'mobile_number', 'personal_phone']) || '');

    const senderEmail = pick(row, ['SENDERS  EMAIL']) as string | null;
    const lastContacted = pick(row, ['Email Last Contacted', 'email_last_sent_at']) as string | null;

    return {
        id,
        table,
        leadType,
        fullName,
        email,
        phone,
        senderEmail,
        lastContacted,
        createdAt: row.created_at || null,
        replied: row.Replied ?? null,
        bounced: truthyText(row.email_bounced),
        unsubscribed: truthyText(row.email_unsubscribed),
        stages,
        replies,
        raw: row,
    };
}

// ── main fetch: all normalized rows across the 3 tables ──────────────────────

export async function fetchOutreachLeads(): Promise<NormalizedLeadRow[]> {
    const [enrichedRows, masterColdRows, hubspotRows] = await Promise.all([
        fetchAll('ENRICHED_LEADS', ENRICHED_LEADS_COLUMNS),
        fetchAll('master_cold_leads', MASTER_COLD_LEADS_COLUMNS),
        fetchAll(HOT_TABLE, HUBSPOT_LEAD_COLUMNS),
    ]);

    return [
        ...enrichedRows.map((r: any) => normalizeRow(r, 'ENRICHED_LEADS', 'cold')),
        ...masterColdRows.map((r: any) => normalizeRow(r, 'master_cold_leads', 'cold')),
        ...hubspotRows.map((r: any) => normalizeRow(r, HOT_TABLE, 'hot')),
    ];
}

function inRange(dateStr: string | null, from: Date, to: Date): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= from && d <= to;
}

// ── aggregated metrics for a set of leads ────────────────────────────────────

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
        if (lead.replies.length > 0 || truthyText(lead.replied)) {
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

export async function getOutreachDashboardData(from: Date, to: Date) {
    const allLeads = await fetchOutreachLeads();
    const coldLeads = allLeads.filter(l => l.leadType === 'cold');
    const hotLeads = allLeads.filter(l => l.leadType === 'hot');

    return {
        cold: computeMetrics(coldLeads, from, to),
        hot: computeMetrics(hotLeads, from, to),
    };
}
