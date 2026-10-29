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

/** Full per-lead shape, including every email body/status/reply — only ever
 *  fetched for ONE lead at a time (the row-click detail modal), never for a list. */
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

/** Thin per-lead shape for list pages — no email bodies, no reply text, no
 *  raw_data/custom_fields. Backed by the get_campaigns_leads_page RPC, which
 *  does search/filter/pagination in Postgres instead of shipping every row
 *  to the client. */
export interface OutreachLeadListItem {
    id: string;
    fullName: string;
    email: string | null;
    mobileNumber: string | null;
    linkedinUrl: string | null;
    companyName: string | null;
    city: string | null;
    country: string | null;
    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string | null;
    outreachChannels: OutreachChannel[];
    leadStatus: string | null;
    whatsappStatus: string | null;
    voiceStatus: string | null;
    unsubscribed: boolean;
    bounced: boolean;
    emailSentCount: number;
    emailReplied: boolean;
    emailReplyCount: number;
    lastEmailSubject: string | null;
    lastContactedAt: string | null;
    createdAt: string | null;
}

export interface OutreachLeadsPage {
    data: OutreachLeadListItem[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface OutreachLeadsPageFilters {
    page?: number;
    pageSize?: number;
    search?: string;
    campaignIds?: string[];
    channel?: OutreachChannel;
    statusFilter?: string[];
    /** Only leads with that channel's status populated (WhatsApp/Voice "Active Only" toggle). */
    activeOnly?: boolean;
}

// ── Supabase row -> normalized shape (full detail only) ────────────────────

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

function normalizeLeadListItem(row: any): OutreachLeadListItem {
    return {
        id: row.id,
        fullName: row.full_name || 'Unknown',
        email: row.email,
        mobileNumber: row.mobile_number,
        linkedinUrl: row.linkedin_url,
        companyName: row.company_name,
        city: row.city,
        country: row.country,
        campaignId: row.campaign_id,
        campaignKey: row.campaign_key,
        campaignName: row.campaign_name,
        outreachChannels: Array.isArray(row.outreach_channels) ? row.outreach_channels : [],
        leadStatus: row.lead_status,
        whatsappStatus: row.whatsapp_status,
        voiceStatus: row.voice_status,
        unsubscribed: !!row.unsubscribed,
        bounced: !!row.bounced,
        emailSentCount: row.email_sent_count ?? 0,
        emailReplied: !!row.email_replied,
        emailReplyCount: row.email_reply_count ?? 0,
        lastEmailSubject: row.last_email_subject,
        lastContactedAt: row.last_contacted_at,
        createdAt: row.created_at,
    };
}

// ── fetchers ─────────────────────────────────────────────────────────────────

/**
 * Paginated, filtered, search-aware leads list — backed by the
 * get_campaigns_leads_page Postgres RPC (see
 * supabase/migrations/add_campaigns_module_rpcs.sql). Only ever pulls the
 * current page's thin rows; no email bodies/replies leave the database.
 */
export async function getOutreachLeadsPage(filters: OutreachLeadsPageFilters = {}): Promise<OutreachLeadsPage> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;

    const { data, error } = await supabaseAdmin.rpc('get_campaigns_leads_page', {
        p_page: page,
        p_page_size: pageSize,
        p_search: filters.search?.trim() || null,
        p_campaign_ids: filters.campaignIds?.length ? filters.campaignIds : null,
        p_channel: filters.channel || null,
        p_status_filter: filters.statusFilter?.length ? filters.statusFilter : null,
        p_active_only: filters.activeOnly ?? false,
    });

    if (error) throw new Error(error.message);

    const rows = data || [];
    return {
        data: rows.map(normalizeLeadListItem),
        totalCount: rows[0]?.total_count ?? 0,
        page,
        pageSize,
    };
}

/** Full detail (email bodies, step statuses, replies) for exactly one lead —
 *  used only by the row-click detail modal. */
export async function getOutreachLeadDetail(id: string): Promise<OutreachLead | null> {
    const { data, error } = await supabaseAdmin.rpc('get_campaign_lead_detail', { p_id: id });
    if (error) throw new Error(error.message);
    if (!data) return null;
    return normalizeLead(data);
}

export interface CampaignsDashboardStats {
    totalLeads: number;
    totalCampaigns: number;
    emailSent: number;
    emailReplied: number;
    unsubscribed: number;
    bounced: number;
    whatsappActive: number;
    voiceActive: number;
    contacted: number;
    newLeads: number;
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

/** Top-line dashboard counts — backed by the get_campaigns_dashboard_stats
 *  RPC (a single aggregate query, no row data leaves Postgres). */
export async function getCampaignsDashboardStats(): Promise<CampaignsDashboardStats> {
    const { data, error } = await supabaseAdmin.rpc('get_campaigns_dashboard_stats');
    if (error) throw new Error(error.message);
    const row = data?.[0];
    return {
        totalLeads: row?.total_leads ?? 0,
        totalCampaigns: row?.total_campaigns ?? 0,
        emailSent: row?.email_sent ?? 0,
        emailReplied: row?.email_replied ?? 0,
        unsubscribed: row?.unsubscribed ?? 0,
        bounced: row?.bounced ?? 0,
        whatsappActive: row?.whatsapp_active ?? 0,
        voiceActive: row?.voice_active ?? 0,
        contacted: row?.contacted ?? 0,
        newLeads: row?.new_leads ?? 0,
    };
}

/** Per-campaign breakdown — backed by the get_campaigns_summary RPC (a
 *  single GROUP BY query, no row data leaves Postgres). */
export async function getCampaignsSummary(): Promise<CampaignSummary[]> {
    const { data, error } = await supabaseAdmin.rpc('get_campaigns_summary');
    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        color: campaignColor(row.campaign_id),
        totalLeads: row.total_leads ?? 0,
        emailSent: row.email_sent ?? 0,
        emailReplied: row.email_replied ?? 0,
        unsubscribed: row.unsubscribed ?? 0,
        bounced: row.bounced ?? 0,
        whatsappActive: row.whatsapp_active ?? 0,
        voiceActive: row.voice_active ?? 0,
        contacted: row.contacted ?? 0,
        newLeads: row.new_leads ?? 0,
    }));
}

export interface ChannelStats {
    enrolled: number;
    active: number;
    notStarted: number;
    emailSent: number;
    emailReplied: number;
    unsubscribed: number;
    bounced: number;
}

/** Stats scoped to one outreach channel — backs the Email/WhatsApp/Voice
 *  campaign sub-pages (a single aggregate query per channel instead of
 *  filtering the full in-memory lead list in JS). */
export async function getChannelStats(channel: OutreachChannel): Promise<ChannelStats> {
    const { data, error } = await supabaseAdmin.rpc('get_campaigns_channel_stats', { p_channel: channel });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    return {
        enrolled: row?.enrolled ?? 0,
        active: row?.active ?? 0,
        notStarted: row?.not_started ?? 0,
        emailSent: row?.email_sent ?? 0,
        emailReplied: row?.email_replied ?? 0,
        unsubscribed: row?.unsubscribed ?? 0,
        bounced: row?.bounced ?? 0,
    };
}

/** Distinct campaigns represented within one channel's enrolled leads —
 *  backs the "Campaign" filter dropdown on the channel sub-pages. */
export async function getChannelCampaignOptions(channel: OutreachChannel): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabaseAdmin.rpc('get_campaigns_channel_campaign_options', { p_channel: channel });
    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({ id: row.campaign_id, name: row.campaign_name }));
}

// ── derived helpers (still used by the full-detail modal) ──────────────────

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
