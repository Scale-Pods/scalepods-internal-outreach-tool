import { supabaseAdmin } from '@/lib/supabase';

// ── shared constants ──────────────────────────────────────────────────────────

export const EMAIL_STEP_COUNT = 10;

// Deterministic color per campaign so the same campaign always renders the
// same color across Dashboard / Leads / Analytics, however many there are.
const CAMPAIGN_COLORS = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'fuchsia'] as const;
export type CampaignColor = typeof CAMPAIGN_COLORS[number];

export function campaignColor(campaignId: number | string | null | undefined): CampaignColor {
    const key = String(campaignId ?? 'unknown');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return CAMPAIGN_COLORS[hash % CAMPAIGN_COLORS.length];
}

// ── row shapes ────────────────────────────────────────────────────────────────

export interface EmailStatusEntry {
    sender: string | null;
    status: string | null;
    sent_at: string | null;
    subject: string | null;
    provider: string | null;
    synced_at: string | null;
    thread_id: string | null;
    message_id: string | null;
    campaign_id: number | null;
    campaign_name: string | null;
    sequence_step: number | null;
    recipient_email: string | null;
    instantly_campaign_uuid: string | null;
}

export interface EmailReplyEntry {
    body: string | null;
    error: string | null;
    subject: string | null;
    from_name: string | null;
    thread_id: string | null;
    from_email: string | null;
    message_id: string | null;
    to_account: string | null;
    ai_response?: { status: string | null; sent_at: string | null; reply_id: string | null };
    campaign_id: number | null;
    received_at: string | null;
    campaign_name: string | null;
    team_notified: boolean | null;
    classification: string | null;
    team_notified_at: string | null;
    processing_status: string | null;
    instantly_campaign_uuid: string | null;
}

export type OutreachChannel = 'email' | 'whatsapp' | 'voice';

export interface OutreachLead {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    designation: string | null;
    email: string | null;
    personalEmail: string | null;
    mobileNumber: string | null;
    linkedinUrl: string | null;
    companyName: string | null;
    companyDomain: string | null;
    city: string | null;
    state: string | null;
    country: string | null;

    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string | null;
    outreachChannels: OutreachChannel[];

    leadStatus: string | null;
    emailStatus: string | null;
    whatsappStatus: string | null;
    voiceStatus: string | null;
    unsubscribed: boolean;
    bounced: boolean;

    lastContactedAt: string | null;
    lastRepliedAt: string | null;

    emailSteps: (string | null)[]; // email_1..email_10, HTML body per step
    emailStepStatuses: (EmailStatusEntry | null)[]; // email_status_1..10
    emailReplies: EmailReplyEntry[];

    createdAt: string | null;
    updatedAt: string | null;
}

// ── Supabase row -> normalized shape ────────────────────────────────────────

function parseJsonField<T>(val: any): T | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
        try { return JSON.parse(val) as T; } catch { return null; }
    }
    return val as T;
}

function normalizeLead(row: any): OutreachLead {
    const emailSteps: (string | null)[] = [];
    const emailStepStatuses: (EmailStatusEntry | null)[] = [];
    for (let i = 1; i <= EMAIL_STEP_COUNT; i++) {
        emailSteps.push(row[`email_${i}`] ?? null);
        emailStepStatuses.push(parseJsonField<EmailStatusEntry>(row[`email_status_${i}`]));
    }

    const repliesRaw = parseJsonField<EmailReplyEntry[]>(row.email_reply);

    return {
        id: row.id,
        fullName: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown',
        firstName: row.first_name,
        lastName: row.last_name,
        designation: row.designation,
        email: row.email,
        personalEmail: row.personal_email,
        mobileNumber: row.mobile_number,
        linkedinUrl: row.linkedin_url,
        companyName: row.company_name,
        companyDomain: row.company_domain,
        city: row.city,
        state: row.state,
        country: row.country,

        campaignId: row.campaign_id,
        campaignKey: row.campaign_key,
        campaignName: emailStepStatuses.find(s => s?.campaign_name)?.campaign_name
            ?? repliesRaw?.[0]?.campaign_name
            ?? (row.campaign_key ? row.campaign_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : null)
            ?? (row.campaign_id ? `Campaign ${row.campaign_id}` : null),
        outreachChannels: Array.isArray(row.outreach_channels) ? row.outreach_channels : [],

        leadStatus: row.lead_status,
        emailStatus: row.email_status,
        whatsappStatus: row.whatsapp_status,
        voiceStatus: row.voice_status,
        unsubscribed: !!row.unsubscribed,
        bounced: !!row.bounced,

        lastContactedAt: row.last_contacted_at,
        lastRepliedAt: row.last_replied_at,

        emailSteps,
        emailStepStatuses,
        emailReplies: repliesRaw ?? [],

        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

const LEAD_SELECT = `
    id, first_name, last_name, full_name, designation, email, personal_email,
    mobile_number, linkedin_url, company_name, company_domain, city, state, country,
    campaign_id, campaign_key, outreach_channels, lead_status, email_status,
    whatsapp_status, voice_status, unsubscribed, bounced, last_contacted_at, last_replied_at,
    created_at, updated_at, email_reply,
    email_1, email_2, email_3, email_4, email_5, email_6, email_7, email_8, email_9, email_10,
    email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
    email_status_6, email_status_7, email_status_8, email_status_9, email_status_10
`;

/** Fetches every row from outreach_leads (paginated past Supabase's 1000-row cap), normalized. */
export async function getOutreachLeads(): Promise<OutreachLead[]> {
    const pageSize = 1000;
    let from = 0;
    let all: any[] = [];

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('outreach_leads')
            .select(LEAD_SELECT)
            .range(from, from + pageSize - 1)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        all = all.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    return all.map(normalizeLead);
}

// ── derived helpers ──────────────────────────────────────────────────────────

/** Count of email steps actually sent (status entry present with a non-empty status). */
export function countEmailStepsSent(lead: OutreachLead): number {
    return lead.emailStepStatuses.filter(s => s && s.status).length;
}

export function hasEmailReply(lead: OutreachLead): boolean {
    return lead.emailReplies.length > 0;
}

export function latestEmailStatus(lead: OutreachLead): EmailStatusEntry | null {
    for (let i = lead.emailStepStatuses.length - 1; i >= 0; i--) {
        if (lead.emailStepStatuses[i]) return lead.emailStepStatuses[i];
    }
    return null;
}

export interface CampaignSummary {
    campaignId: number | string;
    campaignName: string;
    color: CampaignColor;
    totalLeads: number;
    emailSent: number;
    emailReplied: number;
    unsubscribed: number;
    bounced: number;
    whatsappActive: number;
    voiceActive: number;
    contacted: number;
    newLeads: number;
}

/** Groups leads by campaign and computes per-campaign, cross-channel stats. */
export function buildCampaignSummaries(leads: OutreachLead[]): CampaignSummary[] {
    const groups = new Map<string, OutreachLead[]>();
    for (const lead of leads) {
        const key = String(lead.campaignId ?? 'unknown');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(lead);
    }

    return Array.from(groups.entries()).map(([key, groupLeads]) => {
        const campaignId = groupLeads[0].campaignId ?? key;
        // Prefer a real "ScalePods Internal Outreach N"-style name (sourced from
        // email_status_N/email_reply) over the generic "Campaign N" fallback.
        const namedLead = groupLeads.find(l => l.campaignName && !/^Campaign \d+$/.test(l.campaignName));
        const campaignName = namedLead?.campaignName || groupLeads[0].campaignName || `Campaign ${key}`;
        return {
            campaignId,
            campaignName,
            color: campaignColor(campaignId),
            totalLeads: groupLeads.length,
            emailSent: groupLeads.filter(l => countEmailStepsSent(l) > 0).length,
            emailReplied: groupLeads.filter(hasEmailReply).length,
            unsubscribed: groupLeads.filter(l => l.unsubscribed).length,
            bounced: groupLeads.filter(l => l.bounced).length,
            whatsappActive: groupLeads.filter(l => !!l.whatsappStatus).length,
            voiceActive: groupLeads.filter(l => !!l.voiceStatus).length,
            contacted: groupLeads.filter(l => l.leadStatus === 'contacted').length,
            newLeads: groupLeads.filter(l => l.leadStatus === 'new').length,
        };
    }).sort((a, b) => b.totalLeads - a.totalLeads);
}
