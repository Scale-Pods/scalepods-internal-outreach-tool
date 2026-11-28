import { supabaseAdmin } from '@/lib/supabase';
import { getCampaignWaOverview } from '@/lib/services/campaign-whatsapp';
import { getCampaignVoiceOverview } from '@/lib/services/campaign-voice';

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

export function getInstantlyStatusBadge(status: string | number | null | undefined) {
    switch (String(status ?? '').trim()) {
        case '1':
            return { label: 'Active', color: 'emerald' as const };
        case '2':
            return { label: 'Paused', color: 'amber' as const };
        case '0':
            return { label: 'Inactive (Draft)', color: 'slate' as const };
        case '3':
            return { label: 'Completed', color: 'blue' as const };
        case '-1':
        case '-2':
        case '-99':
            return { label: 'Bounce Protect / Error', color: 'red' as const };
        default:
            return { label: 'Unknown', color: 'slate' as const };
    }
}

export interface InstantlyCampaignStatusEntry {
    campaignId: string;
    campaignName: string;
    campaignStatus: string | null;
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
    campaignAlias?: string | null;
    assignedLead: string | null;
    isEnriched: boolean;
    manualOutreachActivated: boolean;
    customFields?: Record<string, any> | null;
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
    campaignAlias?: string | null;
    assignedLead: string | null;
    isEnriched: boolean;
    manualOutreachActivated: boolean;
    customFields?: Record<string, any> | null;
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

function resolveCanonicalCampaignName(
    campaignId: number | string | null | undefined,
    campaignKey?: string | null,
    fallbackName?: string | null
): string {
    if (campaignId !== null && campaignId !== undefined && String(campaignId).trim() !== '') {
        return `ScalePods Internal Outreach ${campaignId}`;
    }
    if (campaignKey) {
        return campaignKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    return fallbackName || 'General Campaign';
}

function normalizeLead(row: any): OutreachLead {
    const emailSteps: (string | null)[] = [];
    const emailStepStatuses: (EmailStatusEntry | null)[] = [];
    for (let i = 1; i <= EMAIL_STEP_COUNT; i++) {
        emailSteps.push(row[`email_${i}`] ?? null);
        emailStepStatuses.push(parseJsonField<EmailStatusEntry>(row[`email_status_${i}`]));
    }

    const repliesRaw = parseJsonField<EmailReplyEntry[]>(row.email_reply);
    const customFields = parseJsonField<Record<string, any>>(row.custom_fields);

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
        campaignName: resolveCanonicalCampaignName(
            row.campaign_id,
            row.campaign_key,
            emailStepStatuses.find(s => s?.campaign_name)?.campaign_name ?? repliesRaw?.[0]?.campaign_name ?? null
        ),
        campaignAlias: (row.assigned_lead && String(row.assigned_lead).trim()) || null,
        assignedLead: row.assigned_lead || null,
        isEnriched: Boolean(row.is_enriched),
        manualOutreachActivated: Boolean(customFields?.manual_outreach_activated),
        customFields,
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

    let computedLastSubject: string | null = row.last_email_subject || null;
    if (!computedLastSubject) {
        for (let i = EMAIL_STEP_COUNT; i >= 1; i--) {
            const st = parseJsonField<EmailStatusEntry>(row[`email_status_${i}`]);
            if (st?.subject) {
                computedLastSubject = st.subject;
                break;
            }
        }
    }

    const campaignName = resolveCanonicalCampaignName(row.campaign_id, row.campaign_key, row.campaign_name);
    const customFields = parseJsonField<Record<string, any>>(row.custom_fields);

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
        campaignAlias: (row.assigned_lead && String(row.assigned_lead).trim()) || null,
        assignedLead: row.assigned_lead || null,
        isEnriched: Boolean(row.is_enriched),
        manualOutreachActivated: Boolean(customFields?.manual_outreach_activated),
        customFields,
        outreachChannels: Array.isArray(row.outreach_channels) ? row.outreach_channels : [],
        leadStatus: row.lead_status,
        whatsappStatus: row.whatsapp_status,
        voiceStatus: row.voice_status,
        unsubscribed: !!row.unsubscribed,
        bounced: !!row.bounced,
        emailSentCount,
        emailReplied: emailReplyCount > 0 || !!row.email_replied,
        emailReplyCount,
        lastEmailSubject: computedLastSubject,
        lastContactedAt: row.last_contacted_at,
        createdAt: row.created_at,
    };
}

// ── fetchers ─────────────────────────────────────────────────────────────────

const EMAIL_LIST_COLUMNS = `
    id, full_name, email, mobile_number, linkedin_url, company_name, city, country,
    campaign_id, campaign_key, outreach_channels, lead_status, whatsapp_status,
    voice_status, unsubscribed, bounced, last_contacted_at, created_at,
    assigned_lead, is_enriched, custom_fields,
    email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
    email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
    email_reply
`;

const EMAIL_STATS_COLUMNS = `
    id, unsubscribed, bounced, last_contacted_at,
    email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
    email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
    email_reply
`;

function parseEmailIsoMs(raw: string | null | undefined): number {
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
}

function extractEmailActivityTimestamps(row: any) {
    const stepSentDates: number[] = [];
    for (let i = 1; i <= EMAIL_STEP_COUNT; i++) {
        const st = parseJsonField<EmailStatusEntry>(row[`email_status_${i}`]);
        if (st?.sent_at) {
            const t = parseEmailIsoMs(st.sent_at);
            if (t > 0) stepSentDates.push(t);
        }
    }
    const replies = parseJsonField<EmailReplyEntry[]>(row.email_reply) || [];
    const replyDates: number[] = [];
    for (const r of replies) {
        if (r?.received_at) {
            const t = parseEmailIsoMs(r.received_at);
            if (t > 0) replyDates.push(t);
        }
    }
    const fallbackFlagMs = (row.unsubscribed || row.bounced) && stepSentDates.length === 0 && replyDates.length === 0
        ? parseEmailIsoMs(row.last_contacted_at)
        : 0;
    const latestEmailActivityMs = Math.max(0, ...stepSentDates, ...replyDates, fallbackFlagMs);
    return { stepSentDates, replyDates, latestEmailActivityMs };
}

async function fetchEmailActiveRows(filters: {
    campaignIds?: string[];
    search?: string;
    selectColumns: string;
}): Promise<any[]> {
    const BATCH = 1000;
    const allRows: any[] = [];
    const emailChannelFilter = JSON.stringify(['email']);

    for (let offset = 0; offset < 20000; offset += BATCH) {
        let q = supabaseAdmin
            .from('outreach_leads')
            .select(filters.selectColumns)
            .contains('outreach_channels', emailChannelFilter)
            .or('email_status_1.not.is.null,email_status_2.not.is.null,email_reply.not.is.null,unsubscribed.eq.true,bounced.eq.true');

        if (filters.campaignIds?.length) {
            q = q.in('campaign_id', filters.campaignIds);
        }
        if (filters.search?.trim()) {
            const s = filters.search.trim();
            q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,mobile_number.ilike.%${s}%,company_name.ilike.%${s}%,assigned_lead.ilike.%${s}%`);
        }

        q = q.order('id', { ascending: true }).range(offset, offset + BATCH - 1);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const batch = data || [];
        allRows.push(...batch);
        if (batch.length < BATCH) break;
    }

    return allRows;
}

/**
 * Paginated, filtered, search-aware leads list.
 * For `channel === 'email'`, filters and sorts by actual email step/reply activity
 * (instead of shared cross-channel `last_contacted_at`) so WhatsApp-only leads
 * do not appear with 0/10 emails at the top.
 */
export async function getOutreachLeadsPage(filters: OutreachLeadsPageFilters = {}): Promise<OutreachLeadsPage> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;

    if (filters.channel === 'email') {
        const wantsNotSentOnly =
            filters.statusFilter?.length === 1 && filters.statusFilter[0] === 'Not Sent';

        if (wantsNotSentOnly) {
            let q = supabaseAdmin
                .from('outreach_leads')
                .select(EMAIL_LIST_COLUMNS, { count: 'exact' })
                .contains('outreach_channels', JSON.stringify(['email']))
                .is('email_status_1', null)
                .is('email_reply', null);

            if (filters.campaignIds?.length) q = q.in('campaign_id', filters.campaignIds);
            if (filters.search?.trim()) {
                const s = filters.search.trim();
                q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,mobile_number.ilike.%${s}%,company_name.ilike.%${s}%,assigned_lead.ilike.%${s}%`);
            }

            const startIndex = (page - 1) * pageSize;
            q = q.order('created_at', { ascending: false, nullsFirst: false })
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

        const [rawRows, aliasMap] = await Promise.all([
            fetchEmailActiveRows({
                campaignIds: filters.campaignIds,
                search: filters.search,
                selectColumns: EMAIL_LIST_COLUMNS,
            }),
            getCampaignAliasMap(),
        ]);

        const hasDateRange = !!(filters.from || filters.to);
        const fromMs = filters.from ? parseEmailIsoMs(filters.from) : -Infinity;
        const toMs = filters.to ? parseEmailIsoMs(filters.to) : Infinity;

        let enriched = rawRows.map(row => {
            const item = normalizeLeadListItem(row);
            item.campaignAlias = resolveCampaignAliasFromMap(item.campaignId, item.campaignKey, aliasMap, item.assignedLead);
            const ts = extractEmailActivityTimestamps(row);
            return { item, ...ts };
        });

        if (hasDateRange) {
            enriched = enriched.filter(({ item, stepSentDates, replyDates, latestEmailActivityMs }) => {
                const sentInRange = stepSentDates.some(t => t >= fromMs && t <= toMs);
                const replyInRange = replyDates.some(t => t >= fromMs && t <= toMs);
                const flagInRange = (item.unsubscribed || item.bounced) && latestEmailActivityMs >= fromMs && latestEmailActivityMs <= toMs;
                return sentInRange || replyInRange || flagInRange;
            });
        }

        if (filters.statusFilter?.length) {
            const allowed = new Set(filters.statusFilter);
            enriched = enriched.filter(({ item }) => {
                if (allowed.has('Sent') && item.emailSentCount > 0) return true;
                if (allowed.has('Not Sent') && item.emailSentCount === 0) return true;
                if (allowed.has('Replied') && item.emailReplied) return true;
                if (allowed.has('Unsubscribed') && item.unsubscribed) return true;
                if (allowed.has('Bounced') && item.bounced) return true;
                return false;
            });
        }

        enriched.sort((a, b) => b.latestEmailActivityMs - a.latestEmailActivityMs);

        const totalCount = enriched.length;
        const startIndex = (page - 1) * pageSize;
        const pageItems = enriched.slice(startIndex, startIndex + pageSize).map(e => ({
            ...e.item,
            lastContactedAt: e.latestEmailActivityMs > 0
                ? new Date(e.latestEmailActivityMs).toISOString()
                : e.item.lastContactedAt,
        }));

        return {
            data: pageItems,
            totalCount,
            page,
            pageSize,
        };
    }

    // Use direct Postgres query when date filtering is active, or enrichedOnly is requested,
    // or for standard campaign lead listing (ensuring assigned_lead and is_enriched are always selected).
    if (filters.from || filters.to || filters.enrichedOnly || (!filters.statusFilter?.length && !filters.activeOnly)) {
        let q = supabaseAdmin
            .from('outreach_leads')
            .select(`
                id, full_name, email, mobile_number, linkedin_url, company_name, city, country,
                campaign_id, campaign_key, outreach_channels, lead_status, whatsapp_status,
                voice_status, unsubscribed, bounced, last_contacted_at, created_at,
                assigned_lead, is_enriched, custom_fields,
                email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
                email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
                email_reply
            `, { count: 'exact' });

        if (filters.enrichedOnly) {
            q = q.eq('is_enriched', true);
        }
        if (filters.channel) {
            q = q.contains('outreach_channels', JSON.stringify([filters.channel]));
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

        const [{ data, count, error }, aliasMap] = await Promise.all([q, getCampaignAliasMap()]);
        if (error) throw new Error(error.message);

        return {
            data: (data || []).map(row => {
                const item = normalizeLeadListItem(row);
                item.campaignAlias = resolveCampaignAliasFromMap(item.campaignId, item.campaignKey, aliasMap, item.assignedLead);
                return item;
            }),
            totalCount: count ?? 0,
            page,
            pageSize,
        };
    }

    try {
        const [{ data, error }, aliasMap] = await Promise.all([
            supabaseAdmin.rpc('get_campaigns_leads_page', {
                p_page: page,
                p_page_size: pageSize,
                p_search: filters.search?.trim() || null,
                p_campaign_ids: filters.campaignIds?.length ? filters.campaignIds : null,
                p_channel: filters.channel || null,
                p_status_filter: filters.statusFilter?.length ? filters.statusFilter : null,
                p_active_only: filters.activeOnly ?? false,
            }),
            getCampaignAliasMap(),
        ]);

        if (!error && data) {
            const rows = data || [];
            return {
                data: rows.map((row: any) => {
                    const item = normalizeLeadListItem(row);
                    item.campaignAlias = resolveCampaignAliasFromMap(item.campaignId, item.campaignKey, aliasMap, item.assignedLead);
                    return item;
                }),
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
            assigned_lead, is_enriched, custom_fields,
            email_status_1, email_status_2, email_status_3, email_status_4, email_status_5,
            email_status_6, email_status_7, email_status_8, email_status_9, email_status_10,
            email_reply
        `, { count: 'exact' });

    if (filters.channel) {
        q = q.contains('outreach_channels', JSON.stringify([filters.channel]));
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

    const [{ data, count, error }, aliasMap] = await Promise.all([q, getCampaignAliasMap()]);
    if (error) throw new Error(error.message);

    return {
        data: (data || []).map(row => {
            const item = normalizeLeadListItem(row);
            item.campaignAlias = resolveCampaignAliasFromMap(item.campaignId, item.campaignKey, aliasMap, item.assignedLead);
            return item;
        }),
        totalCount: count ?? 0,
        page,
        pageSize,
    };
}

/** Full detail (email bodies, step statuses, replies) for exactly one lead —
 *  used only by the row-click detail modal. */
export async function getOutreachLeadDetail(id: string): Promise<OutreachLead | null> {
    const [{ data, error }, aliasMap] = await Promise.all([
        supabaseAdmin.rpc('get_campaign_lead_detail', { p_id: id }),
        getCampaignAliasMap(),
    ]);
    if (error) throw new Error(error.message);
    if (!data) return null;
    const normalized = normalizeLead(data);
    normalized.campaignAlias = resolveCampaignAliasFromMap(normalized.campaignId, normalized.campaignKey, aliasMap, normalized.assignedLead);
    return normalized;
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
    voicePickedUp: number;
    voicePickupRate: number;
    voicePositive: number;
    voiceDurationSeconds: number;
    voiceDurationString: string;
}

export interface CampaignSummary {
    campaignId: number | string;
    campaignName: string;
    campaignAlias?: string | null;
    instantlyStatus?: string | null;
    instantlyCampaignId?: string | null;
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

        // Single RPC — one sequential/index-assisted scan with FILTER
        // aggregates — instead of 9 separate round trips. Falls back to the
        // old per-count queries only if the RPC hasn't been created yet.
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_campaigns_dashboard_stats_filtered', {
            p_from: fromIso,
            p_to: toIso,
        });

        if (!rpcError && rpcData) {
            const row = rpcData[0];
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
            const inRangeOr = `and(created_at.gte.${fromIso},created_at.lte.${toIso}),and(last_contacted_at.gte.${fromIso},last_contacted_at.lte.${toIso}),and(last_replied_at.gte.${fromIso},last_replied_at.lte.${toIso})`;

            const [
                totalRes,
                newRes,
                contactedRes,
                emailSentRes,
                emailRepliedRes,
                unsubsRes,
                bouncedRes,
                whatsappActiveRes,
                voiceActiveRes,
                activeCampaignsRes,
            ] = await Promise.all([
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).or(inRangeOr),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).gte('created_at', fromIso).lte('created_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', JSON.stringify(['email'])).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', JSON.stringify(['email'])).gte('last_replied_at', fromIso).lte('last_replied_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).eq('unsubscribed', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).eq('bounced', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', JSON.stringify(['whatsapp'])).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', JSON.stringify(['voice'])).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
                supabaseAdmin.rpc('get_active_campaigns_count'),
            ]);

            if (totalRes.error) throw new Error(totalRes.error.message);
            if (emailSentRes.error) throw new Error(emailSentRes.error.message);

            totalLeads = totalRes.count ?? 0;
            newLeads = newRes.count ?? 0;
            contacted = contactedRes.count ?? 0;
            emailSent = emailSentRes.count ?? 0;
            emailReplied = emailRepliedRes.count ?? 0;
            unsubscribed = unsubsRes.count ?? 0;
            bounced = bouncedRes.count ?? 0;
            whatsappActive = whatsappActiveRes.count ?? 0;
            voiceActive = voiceActiveRes.count ?? 0;
            totalCampaigns = activeCampaignsRes.data ?? 0;
        }
    }

    // 2. Query WhatsApp and Voice metrics with date filter
    const [waOverview, voiceOverview] = await Promise.all([
        getCampaignWaOverview(filters),
        getCampaignVoiceOverview(filters),
    ]);

    // WhatsApp
    const whatsappSent = waOverview.totalMessagesSent;
    const whatsappReplies = waOverview.totalReplies;
    const whatsappContacted = waOverview.uniqueLeadsContacted;
    const whatsappReplyRate = waOverview.replyRate;
    const whatsappUniqueReplied = waOverview.uniqueRepliedLeads ?? 0;

    // Voice: sourced exclusively from vapi_call_logs where vapi_account = 'sarvam'
    const voiceCalls = voiceOverview.totalCalls;
    const voicePickedUp = voiceOverview.callsPickedUp;
    const voicePickupRate = voiceOverview.pickupRate;
    const voicePositive = voiceOverview.positiveSentimentCalls;
    const voiceDurationSeconds = voiceOverview.totalDurationSeconds;
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
        voicePickedUp,
        voicePickupRate,
        voicePositive,
        voiceDurationSeconds,
        voiceDurationString,
    };
}

/** Resolves the most frequent non-null assigned_lead alias per campaign_id (1..10) */
export async function getCampaignAliasMap(): Promise<Record<string, string>> {
    const campaignIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = await Promise.all(
        campaignIds.map(async (cid) => {
            const { data, error } = await supabaseAdmin
                .from('outreach_leads')
                .select('assigned_lead')
                .eq('campaign_id', cid)
                .not('assigned_lead', 'is', null)
                .neq('assigned_lead', '')
                .order('updated_at', { ascending: false })
                .limit(1000);

            if (error || !data?.length) return [String(cid), null] as const;

            const freq = new Map<string, number>();
            for (const row of data) {
                const val = typeof row.assigned_lead === 'string' ? row.assigned_lead.trim() : '';
                if (!val) continue;
                freq.set(val, (freq.get(val) || 0) + 1);
            }

            let bestAlias: string | null = null;
            let bestCount = 0;
            for (const [alias, count] of freq.entries()) {
                if (count > bestCount) {
                    bestAlias = alias;
                    bestCount = count;
                }
            }
            return [String(cid), bestAlias] as const;
        })
    );

    const map: Record<string, string> = {};
    for (const [cid, alias] of results) {
        if (alias) map[cid] = alias;
    }
    return map;
}

export function resolveCampaignAliasFromMap(
    campaignId: number | string | null | undefined,
    campaignKey: string | null | undefined,
    aliasMap: Record<string, string>,
    fallbackAssignedLead?: string | null
): string | null {
    let key = campaignId !== null && campaignId !== undefined ? String(campaignId) : null;
    if (!key && campaignKey) {
        const match = campaignKey.match(/campaign_?(\d+)/i);
        if (match) key = match[1];
    }
    if (key && aliasMap[key]) return aliasMap[key];
    const trimmed = typeof fallbackAssignedLead === 'string' ? fallbackAssignedLead.trim() : '';
    return trimmed || null;
}

/** Combined endpoint payload for /api/campaigns/aliases (Assign Person & Studio) */
export async function getCampaignAliasesWithSummary(): Promise<{
    aliases: Record<string, string>;
    campaigns: {
        id: number;
        campaignId: number;
        campaignName: string;
        alias: string | null;
        totalLeads: number;
        enrichedLeads: number;
        instantlyStatus: string | null;
    }[];
}> {
    const [aliases, summary] = await Promise.all([
        getCampaignAliasMap(),
        getCampaignsSummary(),
    ]);

    const summaryById = new Map<string, CampaignSummary>();
    for (const s of summary) {
        summaryById.set(String(s.campaignId), s);
    }

    const campaigns = Array.from({ length: 10 }, (_, idx) => {
        const id = idx + 1;
        const s = summaryById.get(String(id));
        const alias = aliases[String(id)] || null;
        return {
            id,
            campaignId: id,
            campaignName: s?.campaignName || `ScalePods Internal Outreach ${id}`,
            alias,
            totalLeads: s?.totalLeads ?? 0,
            enrichedLeads: 0,
            instantlyStatus: s?.instantlyStatus ?? null,
        };
    });

    return { aliases, campaigns };
}

/** Fetches Instantly campaign statuses from public.instantly_campaign_analytics keyed by normalized campaign_name. */
export async function getInstantlyCampaignStatusMap(): Promise<Record<string, InstantlyCampaignStatusEntry>> {
    try {
        const { data, error } = await supabaseAdmin
            .from('instantly_campaign_analytics')
            .select('campaign_id, campaign_name, campaign_status');

        if (error || !data) return {};

        const map: Record<string, InstantlyCampaignStatusEntry> = {};
        for (const row of data) {
            const cid = row.campaign_id ? String(row.campaign_id).trim() : '';
            const cname = row.campaign_name ? String(row.campaign_name).trim() : '';
            if (!cname || cid === '000_HEADER' || cname.toLowerCase() === 'campaign_name') continue;

            const normalizedKey = cname.replace(/\s+/g, ' ').toLowerCase();
            map[normalizedKey] = {
                campaignId: cid,
                campaignName: cname,
                campaignStatus:
                    row.campaign_status !== null && row.campaign_status !== undefined && String(row.campaign_status).trim() !== ''
                        ? String(row.campaign_status).trim()
                        : null,
            };
        }
        return map;
    } catch (err) {
        console.error('Failed to fetch Instantly campaign statuses:', err);
        return {};
    }
}

function resolveInstantlyStatusFromMap(
    campaignId: number | string | null | undefined,
    campaignName: string | null | undefined,
    statusMap: Record<string, InstantlyCampaignStatusEntry>
): InstantlyCampaignStatusEntry | null {
    if (campaignId !== null && campaignId !== undefined && String(campaignId).trim() !== '') {
        const canonicalKey = `ScalePods Internal Outreach ${campaignId}`.replace(/\s+/g, ' ').toLowerCase();
        if (statusMap[canonicalKey]) return statusMap[canonicalKey];
    }
    if (campaignName && campaignName.trim()) {
        const nameKey = campaignName.replace(/\s+/g, ' ').trim().toLowerCase();
        if (statusMap[nameKey]) return statusMap[nameKey];
    }
    return null;
}

/** Per-campaign breakdown — backed by the get_campaigns_summary RPC (a
 *  single GROUP BY query, no row data leaves Postgres). */
export async function getCampaignsSummary(): Promise<CampaignSummary[]> {
    const [{ data, error }, aliasMap, instantlyStatusMap] = await Promise.all([
        supabaseAdmin.rpc('get_campaigns_summary'),
        getCampaignAliasMap(),
        getInstantlyCampaignStatusMap(),
    ]);
    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => {
        const campaignName =
            row.campaign_id !== null && row.campaign_id !== undefined && String(row.campaign_id).trim() !== ''
                ? `ScalePods Internal Outreach ${row.campaign_id}`
                : row.campaign_name;
        const instantly = resolveInstantlyStatusFromMap(row.campaign_id, campaignName, instantlyStatusMap);
        return {
            campaignId: row.campaign_id,
            campaignName,
            campaignAlias: resolveCampaignAliasFromMap(row.campaign_id, null, aliasMap),
            instantlyStatus: instantly?.campaignStatus ?? null,
            instantlyCampaignId: instantly?.campaignId ?? null,
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
        };
    });
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
        const channelFilter = JSON.stringify([channel]);

        if (channel === 'email') {
            const fromMs = parseEmailIsoMs(fromIso);
            const toMs = parseEmailIsoMs(toIso);

            const [enrolledRes, emailRows] = await Promise.all([
                supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter),
                fetchEmailActiveRows({ selectColumns: EMAIL_STATS_COLUMNS }),
            ]);

            if (enrolledRes.error) throw new Error(enrolledRes.error.message);

            let emailSent = 0;
            let emailReplied = 0;
            let unsubs = 0;
            let bounced = 0;

            for (const row of emailRows) {
                const { stepSentDates, replyDates, latestEmailActivityMs } = extractEmailActivityTimestamps(row);
                if (stepSentDates.some(t => t >= fromMs && t <= toMs)) emailSent++;
                if (replyDates.some(t => t >= fromMs && t <= toMs)) emailReplied++;
                if (row.unsubscribed && latestEmailActivityMs >= fromMs && latestEmailActivityMs <= toMs) unsubs++;
                if (row.bounced && latestEmailActivityMs >= fromMs && latestEmailActivityMs <= toMs) bounced++;
            }

            const enrolled = enrolledRes.count ?? 0;
            return {
                enrolled,
                active: emailSent,
                notStarted: Math.max(0, enrolled - emailSent),
                emailSent,
                emailReplied,
                unsubscribed: unsubs,
                bounced,
            };
        }

        const [enrolledRes, emailSentRes, emailRepliedRes, unsubsRes, bouncedRes] = await Promise.all([
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter).gte('last_replied_at', fromIso).lte('last_replied_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter).eq('unsubscribed', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
            supabaseAdmin.from('outreach_leads').select('id', { count: 'exact', head: true }).contains('outreach_channels', channelFilter).eq('bounced', true).gte('last_contacted_at', fromIso).lte('last_contacted_at', toIso),
        ]);

        if (enrolledRes.error) throw new Error(enrolledRes.error.message);
        if (emailSentRes.error) throw new Error(emailSentRes.error.message);

        const enrolled = enrolledRes.count;
        const emailSent = emailSentRes.count;
        const emailReplied = emailRepliedRes.count;
        const unsubs = unsubsRes.count;
        const bounced = bouncedRes.count;

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
export async function getChannelCampaignOptions(channel: OutreachChannel): Promise<{
    id: string;
    name: string;
    alias?: string | null;
    instantlyStatus?: string | null;
    instantlyCampaignId?: string | null;
}[]> {
    const [{ data, error }, aliasMap, instantlyStatusMap] = await Promise.all([
        supabaseAdmin.rpc('get_campaigns_channel_campaign_options', { p_channel: channel }),
        getCampaignAliasMap(),
        channel === 'email' ? getInstantlyCampaignStatusMap() : Promise.resolve({} as Record<string, InstantlyCampaignStatusEntry>),
    ]);
    if (error) throw new Error(error.message);
    return (data || [])
        .map((row: any) => {
            const name = resolveCanonicalCampaignName(row.campaign_id, null, row.campaign_name);
            const instantly = channel === 'email' ? resolveInstantlyStatusFromMap(row.campaign_id, name, instantlyStatusMap) : null;
            return {
                id: row.campaign_id,
                name,
                alias: resolveCampaignAliasFromMap(row.campaign_id, null, aliasMap),
                instantlyStatus: instantly?.campaignStatus ?? null,
                instantlyCampaignId: instantly?.campaignId ?? null,
            };
        })
        .sort((a: { id: string }, b: { id: string }) => {
            const na = Number(a.id);
            const nb = Number(b.id);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.id).localeCompare(String(b.id));
        });
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
