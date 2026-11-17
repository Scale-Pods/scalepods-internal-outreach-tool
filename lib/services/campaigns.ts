import { supabaseAdmin } from '@/lib/supabase';
import { getCampaignWaOverview } from '@/lib/services/campaign-whatsapp';
import { getCampaignVoiceOverview, getCampaignVoiceColdCalls, isCallPickedUp } from '@/lib/services/campaign-voice';

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
    assignedLead: string | null;
    isEnriched: boolean;
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
    assignedLead: string | null;
    isEnriched: boolean;
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
    /** Filter to show only enriched leads (is_enriched = true) */
    enrichedOnly?: boolean;
    from?: string;
    to?: string;
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
        assignedLead: row.assigned_lead || null,
        isEnriched: Boolean(row.is_enriched),
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
    const emailSentCount = row.email_sent_count !== undefined 
        ? row.email_sent_count 
        : [1,2,3,4,5,6,7,8,9,10].filter(i => {
            const s = row[`email_status_${i}`];
            return s && (typeof s === 'object' ? s.status : true);
        }).length;

    const emailReplies = parseJsonField<any[]>(row.email_reply);
    const emailReplyCount = row.email_reply_count !== undefined
        ? row.email_reply_count
        : (Array.isArray(emailReplies) ? emailReplies.length : 0);

    const campaignName = row.campaign_name
        || (row.campaign_key ? row.campaign_key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : null)
        || (row.campaign_id ? `Campaign ${row.campaign_id}` : 'General Campaign');

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
        campaignName,
        assignedLead: row.assigned_lead || null,
        isEnriched: Boolean(row.is_enriched),
        outreachChannels: Array.isArray(row.outreach_channels) ? row.outreach_channels : [],
        leadStatus: row.lead_status,
        whatsappStatus: row.whatsapp_status,
        voiceStatus: row.voice_status,
        unsubscribed: !!row.unsubscribed,
        bounced: !!row.bounced,
        emailSentCount,
        emailReplied: emailReplyCount > 0 || !!row.email_replied,
        emailReplyCount,
        lastEmailSubject: row.last_email_subject || null,
        lastContactedAt: row.last_contacted_at,
        createdAt: row.created_at,
    };
}

// ── fetchers ─────────────────────────────────────────────────────────────────

/**
 * Paginated, filtered, search-aware leads list.
 * Uses the get_campaigns_leads_page Postgres RPC when no date filter is active,
 * or direct indexed Postgres query when date filtering is active.
 */
export async function getOutreachLeadsPage(filters: OutreachLeadsPageFilters = {}): Promise<OutreachLeadsPage> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;

    // Use direct Postgres query when date filtering is active, or enrichedOnly is requested,
    // or for standard campaign lead listing (ensuring assigned_lead and is_enriched are always selected).
    if (filters.from || filters.to || filters.enrichedOnly || (!filters.statusFilter?.length && !filters.activeOnly)) {
        let q = supabaseAdmin
            .from('outreach_leads')
            .select(`
                id, full_name, email, mobile_number, linkedin_url, company_name, city, country,
                campaign_id, campaign_key, outreach_channels, lead_status, whatsapp_status,
                voice_status, unsubscribed, bounced, last_contacted_at, created_at,
                assigned_lead, is_enriched,
                email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
                email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
                email_reply
            `, { count: 'exact' });

        if (filters.enrichedOnly) {
            q = q.eq('is_enriched', true);
        }
        if (filters.channel) {
            q = q.contains('outreach_channels', [filters.channel]);
        }
        if (filters.campaignIds?.length) {
            q = q.in('campaign_id', filters.campaignIds);
        }
        if (filters.from) {
            q = q.gte('last_contacted_at', filters.from);
        }
        if (filters.to) {
            q = q.lte('last_contacted_at', filters.to);
        }
        if (filters.search?.trim()) {
            const s = filters.search.trim();
            q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,mobile_number.ilike.%${s}%,company_name.ilike.%${s}%,assigned_lead.ilike.%${s}%`);
        }

        const startIndex = (page - 1) * pageSize;
        q = q.order('last_contacted_at', { ascending: false, nullsFirst: false })
             .range(startIndex, startIndex + pageSize - 1);

        const { data, count, error } = await q;
        if (error) throw new Error(error.message);

        return {
            data: (data || []).map(normalizeLeadListItem),
            totalCount: count ?? 0,
            page,
            pageSize,
        };
    }

    try {
        const { data, error } = await supabaseAdmin.rpc('get_campaigns_leads_page', {
            p_page: page,
            p_page_size: pageSize,
            p_search: filters.search?.trim() || null,
            p_campaign_ids: filters.campaignIds?.length ? filters.campaignIds : null,
            p_channel: filters.channel || null,
            p_status_filter: filters.statusFilter?.length ? filters.statusFilter : null,
            p_active_only: filters.activeOnly ?? false,
        });

        if (!error && data) {
            const rows = data || [];
            return {
                data: rows.map(normalizeLeadListItem),
                totalCount: rows[0]?.total_count ?? 0,
                page,
                pageSize,
            };
        }
    } catch {
        // Fall back to direct query
    }

    let q = supabaseAdmin
        .from('outreach_leads')
        .select(`
            id, full_name, email, mobile_number, linkedin_url, company_name, city, country,
            campaign_id, campaign_key, outreach_channels, lead_status, whatsapp_status,
            voice_status, unsubscribed, bounced, last_contacted_at, created_at,
            assigned_lead, is_enriched,
            email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
            email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
            email_reply
        `, { count: 'exact' });

    if (filters.channel) {
        q = q.contains('outreach_channels', [filters.channel]);
    }
    if (filters.campaignIds?.length) {
        q = q.in('campaign_id', filters.campaignIds);
    }
    if (filters.search?.trim()) {
        const s = filters.search.trim();
        q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,mobile_number.ilike.%${s}%,company_name.ilike.%${s}%,assigned_lead.ilike.%${s}%`);
    }

    const startIndex = (page - 1) * pageSize;
    q = q.order('last_contacted_at', { ascending: false, nullsFirst: false })
         .range(startIndex, startIndex + pageSize - 1);

    const { data, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
        data: (data || []).map(normalizeLeadListItem),
        totalCount: count ?? 0,
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

export interface CampaignsDashboardFilters {
    from?: string;
    to?: string;
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

    // WhatsApp Metrics
    whatsappSent: number;
    whatsappReplies: number;
    whatsappReplyRate: number;
    whatsappContacted: number;
    whatsappUniqueReplied: number;

    // Voice Metrics
    voiceCalls: number;
    voiceSarvamCalls: number;
    voiceTwilioCalls: number;
    voicePickedUp: number;
    voicePickupRate: number;
    voicePositive: number;
    voiceDurationSeconds: number;
    voiceDurationString: string;
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

function formatDurationSeconds(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}m ${secs}s`;
}

/** Top-line dashboard counts — backed by get_campaigns_dashboard_stats RPC (all-time)
 *  or filtered by date using outreach_leads, with WhatsApp and Voice metrics. */
export async function getCampaignsDashboardStats(filters: CampaignsDashboardFilters = {}): Promise<CampaignsDashboardStats> {
    const hasDateFilter = !!(filters.from || filters.to);

    let totalLeads = 0;
    let totalCampaigns = 0;
    let emailSent = 0;
    let emailReplied = 0;
    let unsubscribed = 0;
    let bounced = 0;
    let whatsappActive = 0;
    let voiceActive = 0;
    let contacted = 0;
    let newLeads = 0;

    if (!hasDateFilter) {
        const { data, error } = await supabaseAdmin.rpc('get_campaigns_dashboard_stats');
        if (error) throw new Error(error.message);
        const row = data?.[0];
        totalLeads = row?.total_leads ?? 0;
        totalCampaigns = row?.total_campaigns ?? 0;
        emailSent = row?.email_sent ?? 0;
        emailReplied = row?.email_replied ?? 0;
        unsubscribed = row?.unsubscribed ?? 0;
        bounced = row?.bounced ?? 0;
        whatsappActive = row?.whatsapp_active ?? 0;
        voiceActive = row?.voice_active ?? 0;
        contacted = row?.contacted ?? 0;
        newLeads = row?.new_leads ?? 0;
    } else {
        const fromIso = filters.from || '1970-01-01T00:00:00.000Z';
        const toIso = filters.to || '2099-12-31T23:59:59.999Z';

        const [
            { count: totalCount },
            { count: newCount },
            { count: contactedCount },
            { count: repliedCount },
            { count: unsubsCount },
            { count: bouncedCount },
        ] = await Promise.all([
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).gte('created_at', fromIso).lte('created_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).gte('last_replied_at', fromIso).lte('last_replied_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).eq('unsubscribed', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).eq('bounced', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
        ]);

        totalLeads = totalCount ?? 0;
        newLeads = newCount ?? 0;
        contacted = contactedCount ?? 0;
        emailSent = contactedCount ?? 0;
        emailReplied = repliedCount ?? 0;
        unsubscribed = unsubsCount ?? 0;
        bounced = bouncedCount ?? 0;
        totalCampaigns = 10;
        whatsappActive = 5;
        voiceActive = 1;
    }

    // 2. Query WhatsApp and Voice metrics with date filter
    const [waOverview, voiceOverview, coldCallsRes] = await Promise.all([
        getCampaignWaOverview(filters),
        getCampaignVoiceOverview(filters),
        getCampaignVoiceColdCalls({ ...filters, page: 1, pageSize: 1000 }),
    ]);

    // WhatsApp
    const whatsappSent = waOverview.totalMessagesSent;
    const whatsappReplies = waOverview.totalReplies;
    const whatsappContacted = waOverview.uniqueLeadsContacted;
    const whatsappReplyRate = waOverview.replyRate;
    const whatsappUniqueReplied = waOverview.uniqueRepliedLeads ?? 0;

    // Voice: Attributed calls only (separating Sarvam AI vs Twilio cold calls)
    const attributedColdCalls = coldCallsRes.data.filter(c => c.isAttributed);
    const voiceSarvamCalls = voiceOverview.totalCalls;
    const voiceTwilioCalls = attributedColdCalls.length;
    const voiceCalls = voiceSarvamCalls + voiceTwilioCalls;
    const coldPickedUp = attributedColdCalls.filter(c => isCallPickedUp(c.status, c.durationSeconds)).length;
    const voicePickedUp = voiceOverview.callsPickedUp + coldPickedUp;
    const voicePickupRate = voiceCalls > 0 ? Math.round((voicePickedUp / voiceCalls) * 1000) / 10 : 0;
    const voicePositive = voiceOverview.positiveSentimentCalls;
    const coldDuration = attributedColdCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const voiceDurationSeconds = voiceOverview.totalDurationSeconds + coldDuration;
    const voiceDurationString = formatDurationSeconds(voiceDurationSeconds);

    return {
        totalLeads,
        totalCampaigns,
        emailSent,
        emailReplied,
        unsubscribed,
        bounced,
        whatsappActive,
        voiceActive,
        contacted,
        newLeads,
        whatsappSent,
        whatsappReplies,
        whatsappReplyRate,
        whatsappContacted,
        whatsappUniqueReplied,
        voiceCalls,
        voiceSarvamCalls,
        voiceTwilioCalls,
        voicePickedUp,
        voicePickupRate,
        voicePositive,
        voiceDurationSeconds,
        voiceDurationString,
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
export async function getChannelStats(channel: OutreachChannel, filters: { from?: string; to?: string } = {}): Promise<ChannelStats> {
    if (filters.from || filters.to) {
        const fromIso = filters.from || '1970-01-01T00:00:00.000Z';
        const toIso = filters.to || '2099-12-31T23:59:59.999Z';

        const [
            { count: enrolled },
            { count: emailSent },
            { count: emailReplied },
            { count: unsubs },
            { count: bounced },
        ] = await Promise.all([
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', [channel]),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', [channel]).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', [channel]).gte('last_replied_at', fromIso).lte('last_replied_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', [channel]).eq('unsubscribed', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', [channel]).eq('bounced', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
        ]);

        const active = emailSent ?? 0;
        const notStarted = Math.max(0, (enrolled ?? 0) - active);

        return {
            enrolled: enrolled ?? 0,
            active,
            notStarted,
            emailSent: emailSent ?? 0,
            emailReplied: emailReplied ?? 0,
            unsubscribed: unsubs ?? 0,
            bounced: bounced ?? 0,
        };
    }

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
