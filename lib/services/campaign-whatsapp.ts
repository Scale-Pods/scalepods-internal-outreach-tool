import { supabaseAdmin } from '@/lib/supabase';
import { campaignColor, getCampaignAliasMap, resolveCampaignAliasFromMap, type CampaignColor } from '@/lib/services/campaigns';

export interface CampaignWaMessage {
    id?: string;
    step?: number;
    text?: string;
    sender?: string;
    status?: string | null;
    attempted_at?: string | null;
    timestamp?: string | null;
    rendered_text?: string;
    message_text?: string;
    direction?: 'inbound' | 'outbound' | string;
    metadata?: Record<string, any>;
    template_name?: string;
    recipient_phone?: string;
    error?: string | null;
    [key: string]: any;
}

export interface CampaignWaTimelineItem {
    id: string;
    type: 'bot' | 'user';
    label: string;
    content: string;
    date: string | null;
    status?: string | null;
    step?: number;
    metadata?: Record<string, any>;
    isInitial?: boolean;
}

export interface CampaignWaLead {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    mobileNumber: string | null;
    companyName: string | null;
    city: string | null;
    country: string | null;
    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string | null;
    campaignAlias?: string | null;
    campaignColor: CampaignColor;
    leadStatus: string | null;
    whatsappStatus: string | null;
    lastContactedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    outreachMessages: CampaignWaMessage[];
    conversation: CampaignWaMessage[];
    dispatchedOutreachInRange: CampaignWaMessage[];
    customerRepliesInRange: CampaignWaMessage[];
    messagesSentCount: number;
    repliesCount: number;
    hasReplied: boolean;
    isContacted: boolean;
    isPf: boolean;
    isPositive: boolean;
    leadClassification?: string | null;
    timeline: CampaignWaTimelineItem[];
}

export interface CampaignWaOverviewStats {
    uniqueLeadsContacted: number;
    totalReplies: number;
    totalMessagesSent: number;
    pfLeads: number;
    positiveLeads: number;
    totalEnrolled: number;
    replyRate: number;
    uniqueRepliedLeads: number;
    campaignBreakdown: {
        campaignId: string;
        campaignName: string;
        campaignAlias?: string | null;
        campaignColor: CampaignColor;
        leadsContacted: number;
        totalReplies: number;
        messagesSent: number;
        pfLeads: number;
        positiveLeads: number;
    }[];
    stepBreakdown: {
        step: number;
        sentCount: number;
    }[];
}

/** Parses raw JSONB array/string safely */
export function parseJsonbArray<T>(val: any): T[] {
    if (!val) return [];
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return Array.isArray(val) ? val : [];
}

/** Checks whether a message object is an empty placeholder like {} */
function isValidWaMessageObject(msg: any): msg is CampaignWaMessage {
    if (!msg || typeof msg !== 'object') return false;
    return Boolean(
        msg.direction ||
        msg.message_text ||
        msg.text ||
        msg.rendered_text ||
        msg.message ||
        msg.sender ||
        msg.role
    );
}

/** Checks whether a message from whatsapp_conversation is an outgoing AI bot / ScalePods message */
export function isBotReply(msg: CampaignWaMessage): boolean {
    if (!isValidWaMessageObject(msg)) return false;
    const dir = String(msg.direction || '').toLowerCase().trim();
    if (dir === 'outbound' || dir === 'outgoing') return true;
    const role = String(msg.role || '').toLowerCase().trim();
    if (role === 'bot' || role === 'assistant') return true;

    const sender = String(msg.sender || '').toLowerCase().trim();
    if (sender === '917738558481' || sender.includes('scalepods') || sender === 'bot') {
        return true;
    }
    return false;
}

/** Checks whether a message from whatsapp_conversation is an incoming customer reply */
export function isCustomerReply(msg: CampaignWaMessage): boolean {
    if (!isValidWaMessageObject(msg)) return false;
    const dir = String(msg.direction || '').toLowerCase().trim();
    if (dir === 'inbound' || dir === 'incoming') return true;
    const role = String(msg.role || '').toLowerCase().trim();
    if (role === 'user') return true;

    // Explicit outbound or bot role is never a customer reply
    if (isBotReply(msg)) {
        return false;
    }

    // Sender check: if sender is not ScalePods and not bot system
    const sender = String(msg.sender || '').toLowerCase().trim();
    if (sender) {
        return true;
    }
    return false;
}

/** Determines if an outbound bot message was genuinely dispatched (excludes BLOCKED, FAILED, SIMULATED_SEND, errors) */
export function isDispatchedOutreach(msg: CampaignWaMessage): boolean {
    if (!msg) return false;
    if (msg.error) return false;

    const status = String(msg.status || '').toUpperCase().trim();
    if (!status) return false;

    // Exclude invalid, blocked, simulated, failed or queued statuses
    const excludedStatuses = ['BLOCKED', 'FAILED', 'SIMULATED_SEND', 'QUEUED', 'PENDING', 'CANCELLED'];
    if (excludedStatuses.includes(status)) {
        return false;
    }

    // Genuine dispatched statuses
    if (
        status === 'SENT' ||
        status === 'DELIVERED' ||
        status === 'READ' ||
        status === 'REPLIED' ||
        status.includes('DELIVER') ||
        status.includes('SENT')
    ) {
        return true;
    }

    return false;
}

/** Determines if a lead was genuinely contacted (has at least 1 dispatched outbound message or active non-failed WhatsApp status).
 *  `allowStatusFallback` is disabled whenever a date range is active, since
 *  whatsapp_status reflects the lead's latest lifetime status, not whether
 *  anything happened inside the selected window. */
export function isGenuinelyContacted(lead: {
    messagesSentCount: number;
    whatsappStatus?: string | null;
}, allowStatusFallback: boolean = true): boolean {
    if (lead.messagesSentCount > 0) return true;
    if (!allowStatusFallback) return false;

    if (lead.whatsappStatus) {
        const s = String(lead.whatsappStatus).toUpperCase().trim();
        const nonDispatched = ['FAILED', 'BLOCKED', 'SIMULATED_SEND', 'PENDING', 'CANCELLED', 'NONE'];
        if (s && !nonDispatched.includes(s)) {
            return true;
        }
    }
    return false;
}

/** Keeps only messages whose own timestamp (attempted_at / timestamp) falls
 *  inside [fromIso, toIso]. A lead can match the date filter via its
 *  last_contacted_at while still holding months of older conversation
 *  history in whatsapp_outreach_message / whatsapp_conversation — without
 *  this, "messages sent/replied in this range" would silently count that
 *  entire lifetime history instead of just what happened in the window. */
function filterMessagesByDateRange<T extends { attempted_at?: string | null; timestamp?: string | null }>(
    messages: T[],
    fromIso?: string,
    toIso?: string
): T[] {
    if (!fromIso && !toIso) return messages;
    const fromMs = fromIso ? parseSafeTimestamp(fromIso) : -Infinity;
    const toMs = toIso ? parseSafeTimestamp(toIso) : Infinity;
    return messages.filter(m => {
        const raw = m.attempted_at || m.timestamp;
        if (!raw) return false;
        const t = parseSafeTimestamp(raw);
        return t >= fromMs && t <= toMs;
    });
}

/** Resolves campaign details falling back to campaign_key when campaign_id is null */
export function resolveCampaignInfo(campaignId: number | null, campaignKey: string | null): {
    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string;
    groupKey: string;
    color: CampaignColor;
} {
    let resolvedId = campaignId;
    if ((resolvedId === null || resolvedId === undefined) && campaignKey) {
        const match = campaignKey.match(/campaign_?(\d+)/i);
        if (match) resolvedId = Number(match[1]);
    }

    const groupKey = resolvedId !== null && resolvedId !== undefined ? String(resolvedId) : (campaignKey || 'unknown');
    const name = formatCampaignName(resolvedId, campaignKey);
    const color = campaignColor(resolvedId ?? groupKey);

    return { campaignId: resolvedId, campaignKey, campaignName: name, groupKey, color };
}

/** Determines if lead is PF (Product Fit / Questions / PF Status) */
export function isPfLead(lead: {
    lead_status?: string | null;
    whatsapp_conversation?: any[] | null;
    custom_fields?: any;
}): boolean {
    const status = String(lead.lead_status || '').toLowerCase().trim();
    if (status === 'pf' || status.includes('product_fit') || status === 'product-fit') return true;

    const conv = parseJsonbArray<CampaignWaMessage>(lead.whatsapp_conversation);
    for (const m of conv) {
        const cls = String(m.metadata?.classification || '').toUpperCase().trim();
        if (cls === 'PF' || cls === 'PRODUCT_FIT' || cls === 'PRODUCT_QUESTIONS') return true;
    }

    if (lead.custom_fields && (lead.custom_fields.pf || lead.custom_fields.is_pf)) return true;
    return false;
}

/** Determines if lead is Positive (Meeting Requested, Positive Interest, Booking, etc.) */
export function isPositiveLead(lead: {
    lead_status?: string | null;
    whatsapp_status?: string | null;
    whatsapp_conversation?: any[] | null;
    custom_fields?: any;
}): boolean {
    const status = String(lead.lead_status || '').toLowerCase().trim();
    if (status === 'positive' || status === 'meeting_requested' || status.includes('positive')) return true;

    const waStatus = String(lead.whatsapp_status || '').toUpperCase().trim();
    if (waStatus.includes('POSITIVE') || waStatus.includes('MEETING')) return true;

    const conv = parseJsonbArray<CampaignWaMessage>(lead.whatsapp_conversation);
    for (const m of conv) {
        const cls = String(m.metadata?.classification || '').toUpperCase().trim();
        if (
            cls.includes('POSITIVE') ||
            cls === 'BOOKING_CONFIRMED' ||
            cls === 'APPOINTMENT_REQUEST' ||
            cls === 'SLOT_OFFERED'
        ) {
            return true;
        }
    }

    if (lead.custom_fields && (lead.custom_fields.positive || lead.custom_fields.is_positive)) return true;
    return false;
}

/** Resolves lead classification label */
export function getLeadClassification(lead: {
    lead_status?: string | null;
    whatsapp_status?: string | null;
    whatsapp_conversation?: any[] | null;
    whatsapp_outreach_message?: any[] | null;
}): string {
    const conv = parseJsonbArray<CampaignWaMessage>(lead.whatsapp_conversation);
    for (let i = conv.length - 1; i >= 0; i--) {
        const cls = conv[i]?.metadata?.classification;
        if (cls) return String(cls);
    }
    if (lead.lead_status && lead.lead_status !== 'new' && lead.lead_status !== 'contacted') {
        return lead.lead_status;
    }
    if (lead.whatsapp_status) {
        return lead.whatsapp_status;
    }
    const outreach = parseJsonbArray<CampaignWaMessage>(lead.whatsapp_outreach_message);
    if (outreach.length > 0) {
        const last = outreach[outreach.length - 1];
        if (last?.status) return String(last.status);
    }
    return 'NOT_CONTACTED';
}

/** Combines whatsapp_outreach_message (bot) and whatsapp_conversation (both inbound customer replies and outbound AI bot replies) into chronological timeline */
export function buildCampaignWaTimeline(
    outreachMessagesRaw: any,
    conversationRaw: any
): CampaignWaTimelineItem[] {
    const timeline: CampaignWaTimelineItem[] = [];
    const outreach = parseJsonbArray<CampaignWaMessage>(outreachMessagesRaw);
    const conversation = parseJsonbArray<CampaignWaMessage>(conversationRaw);

    const seenIds = new Set<string>();
    const seenContentTimeKeys = new Set<string>();

    // 1. Outgoing bot messages from whatsapp_outreach_message
    outreach.forEach((m, idx) => {
        if (!isValidWaMessageObject(m)) return;
        const text = m.rendered_text || m.text || m.message_text || m.message || '';
        if (!text.trim()) return;
        const date = m.attempted_at || m.timestamp || null;
        const stepNum = typeof m.step === 'number' ? m.step : idx + 1;
        const msgId = m.id || m.message_id || m.provider_message_id;
        if (msgId) seenIds.add(String(msgId).trim());
        seenContentTimeKeys.add(`${text.trim()}|${date || ''}`);

        timeline.push({
            id: msgId || `outreach-step-${stepNum}-${idx}`,
            type: 'bot',
            label: `Bot Outreach Step ${stepNum}`,
            content: text.trim(),
            date,
            status: m.status || 'SENT',
            step: stepNum,
            metadata: m.metadata,
            isInitial: stepNum === 1 || idx === 0,
        });
    });

    // 2. Both incoming customer replies and outgoing AI bot replies from whatsapp_conversation
    conversation.forEach((m, idx) => {
        if (!isValidWaMessageObject(m)) return;
        const text = m.message_text || m.text || m.rendered_text || m.message || '';
        if (!text.trim()) return;
        const date = m.timestamp || m.attempted_at || null;
        const msgId = m.id || m.message_id || m.provider_message_id;

        if (msgId && seenIds.has(String(msgId).trim())) return;
        if (seenContentTimeKeys.has(`${text.trim()}|${date || ''}`)) return;
        if (msgId) seenIds.add(String(msgId).trim());

        const bot = isBotReply(m);
        const customer = !bot && isCustomerReply(m);
        if (!bot && !customer) return;

        timeline.push({
            id: msgId || `${bot ? 'bot' : 'reply'}-${idx}`,
            type: bot ? 'bot' : 'user',
            label: bot ? 'AI Bot Reply' : 'Customer Reply',
            content: text.trim(),
            date,
            status: m.status || (bot ? 'SENT' : null),
            metadata: m.metadata,
            isInitial: false,
        });
    });

    // 3. Sort chronologically: earliest first (using parseSafeTimestamp so timestamps without 'Z' still parse as UTC)
    timeline.sort((a, b) => {
        const timeA = a.date ? parseSafeTimestamp(a.date) : 0;
        const timeB = b.date ? parseSafeTimestamp(b.date) : 0;
        if (timeA !== timeB) return timeA - timeB;
        // If timestamps match or are missing, ensure initial bot outreach is at the top
        if (a.isInitial && !b.isInitial) return -1;
        if (!a.isInitial && b.isInitial) return 1;
        if (a.type === 'bot' && b.type === 'user') return -1;
        if (a.type === 'user' && b.type === 'bot') return 1;
        return 0;
    });

    return timeline;
}

/** Formats campaign name cleanly */
export function formatCampaignName(campaignId: number | null, campaignKey: string | null): string {
    if (campaignKey) {
        return campaignKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    if (campaignId) {
        return `Campaign ${campaignId}`;
    }
    return 'General Campaign';
}

/** Normalizes a row from outreach_leads into CampaignWaLead. When `dateRange`
 *  is given, messagesSentCount/repliesCount (and hence isContacted/hasReplied)
 *  are scoped to messages whose own timestamp falls inside that window —
 *  not just leads whose last_contacted_at happens to fall inside it — so a
 *  lead with months of chat history doesn't inflate a 7-day count. */
export function normalizeCampaignWaLead(row: any, dateRange?: { fromIso?: string; toIso?: string }): CampaignWaLead {
    const rawOutreach = parseJsonbArray<CampaignWaMessage>(row.whatsapp_outreach_message);
    const rawConversation = parseJsonbArray<CampaignWaMessage>(row.whatsapp_conversation);
    const hasDateRange = !!(dateRange?.fromIso || dateRange?.toIso);

    // 1. Genuine dispatched messages count (excludes BLOCKED, FAILED, SIMULATED_SEND, errors),
    // scoped to the selected date range if one is active.
    const dispatchedOutreachAll = rawOutreach.filter(isDispatchedOutreach);
    const dispatchedOutreachInRange = filterMessagesByDateRange(dispatchedOutreachAll, dateRange?.fromIso, dateRange?.toIso);
    const messagesSentCount = dispatchedOutreachInRange.length;

    // 2. Deduplicate conversation entries using message IDs (id, message_id or provider_message_id), skipping empty {} objects
    const seenMsgIds = new Set<string>();
    const dedupedConversation: CampaignWaMessage[] = [];
    rawConversation.forEach(m => {
        if (!isValidWaMessageObject(m)) return;
        const msgId = m.id || m.message_id || m.provider_message_id;
        if (msgId) {
            const normId = String(msgId).trim();
            if (seenMsgIds.has(normId)) return;
            seenMsgIds.add(normId);
        }
        // Legitimate messages without an ID are preserved
        dedupedConversation.push(m);
    });

    const customerRepliesAll = dedupedConversation.filter(isCustomerReply);
    const customerRepliesInRange = filterMessagesByDateRange(customerRepliesAll, dateRange?.fromIso, dateRange?.toIso);
    const repliesCount = customerRepliesInRange.length;
    const hasReplied = repliesCount > 0 || (!hasDateRange && String(row.whatsapp_status || '').toUpperCase() === 'REPLIED');

    // Derive whatsappStatus: use row.whatsapp_status if present, otherwise derive from latest outreach attempt
    let derivedStatus: string | null = row.whatsapp_status ? String(row.whatsapp_status).trim() : null;
    if (!derivedStatus && rawOutreach.length > 0) {
        const latestAttempt = rawOutreach[rawOutreach.length - 1];
        if (latestAttempt?.status) {
            derivedStatus = String(latestAttempt.status).trim();
        } else if (latestAttempt?.error) {
            derivedStatus = 'FAILED';
        }
    }

    // 3. Lead Contacted Status (at least 1 outbound message dispatched in-range, or — only
    // when there's no date filter — an active non-failed lifetime status).
    const isContacted = isGenuinelyContacted({
        messagesSentCount,
        whatsappStatus: derivedStatus,
    }, !hasDateRange);

    // 4. Chronological timeline
    const timeline = buildCampaignWaTimeline(row.whatsapp_outreach_message, dedupedConversation);

    // Best last contacted date
    let lastContacted = row.last_contacted_at || null;
    if (!lastContacted && timeline.length > 0) {
        lastContacted = timeline[timeline.length - 1].date;
    }

    const rawCampaignId = row.campaign_id !== undefined && row.campaign_id !== null ? Number(row.campaign_id) : null;
    const { campaignId, campaignKey, campaignName, color } = resolveCampaignInfo(rawCampaignId, row.campaign_key || null);

    return {
        id: row.id,
        fullName: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown Lead',
        firstName: row.first_name || null,
        lastName: row.last_name || null,
        email: row.email || null,
        mobileNumber: row.mobile_number || null,
        companyName: row.company_name || null,
        city: row.city || null,
        country: row.country || null,
        campaignId,
        campaignKey,
        campaignName,
        campaignColor: color,
        leadStatus: row.lead_status || null,
        whatsappStatus: derivedStatus,
        lastContactedAt: lastContacted,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        outreachMessages: rawOutreach,
        conversation: dedupedConversation,
        dispatchedOutreachInRange,
        customerRepliesInRange,
        messagesSentCount,
        repliesCount,
        hasReplied,
        isContacted,
        isPf: isPfLead(row),
        isPositive: isPositiveLead(row),
        leadClassification: getLeadClassification({
            ...row,
            whatsapp_status: derivedStatus,
            whatsapp_outreach_message: rawOutreach,
        }),
        timeline,
    };
}

export interface CampaignWaFilterParams {
    campaignIds?: string[];
    search?: string;
    from?: string;
    to?: string;
    replyStatus?: string; // 'replied' | 'not_replied' | 'all'
    leadStatus?: string;  // 'pf' | 'positive' | 'all'
    page?: number;
    pageSize?: number;
}

/** Safe timestamp parser that handles ISO strings, dates without timezone, and common date formats */
export function parseSafeTimestamp(val: any, isEndOfDay: boolean = false): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        str = str + (isEndOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z');
    } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
        str = str.replace(' ', 'T') + 'Z';
    }
    const d = new Date(str);
    if (isEndOfDay) {
        d.setUTCHours(23, 59, 59, 999);
    }
    const t = d.getTime();
    if (!isNaN(t)) return t;
    const str2 = str.replace(' ', 'T');
    const d2 = new Date(str2);
    if (isEndOfDay) {
        d2.setUTCHours(23, 59, 59, 999);
    }
    const t2 = d2.getTime();
    return isNaN(t2) ? 0 : t2;
}

const WA_LEAD_COLUMNS = `
    id, full_name, first_name, last_name, email, mobile_number, company_name, city, country,
    campaign_id, campaign_key, assigned_lead, lead_status, whatsapp_status, whatsapp_outreach_message,
    whatsapp_conversation, last_contacted_at, created_at, updated_at, custom_fields
`;

/** Fetches whatsapp-active leads from outreach_leads, pushing the date range down
 *  to Postgres whenever one is active (the normal case, since the campaigns module
 *  defaults to a 7-day range) instead of pulling every whatsapp-active lead ever
 *  recorded on every request. */
async function fetchWaLeadsNormalized(filters: Pick<CampaignWaFilterParams, 'from' | 'to'>): Promise<CampaignWaLead[]> {
    let query = supabaseAdmin
        .from('outreach_leads')
        .select(WA_LEAD_COLUMNS)
        .or('whatsapp_status.not.is.null,whatsapp_outreach_message.neq.[],whatsapp_conversation.neq.[]');

    if (filters.from || filters.to) {
        const fromIso = filters.from || '1970-01-01T00:00:00.000Z';
        const toIso = filters.to || '2099-12-31T23:59:59.999Z';
        // last_contacted_at in range, OR (no last_contacted_at but created_at in range) —
        // mirrors the lastContactedAt-falls-back-to-createdAt rule used everywhere else.
        query = query.or(`and(last_contacted_at.gte.${fromIso},last_contacted_at.lte.${toIso}),and(last_contacted_at.is.null,created_at.gte.${fromIso},created_at.lte.${toIso})`);
    }

    query = query.order('last_contacted_at', { ascending: false, nullsFirst: false }).limit(20000);

    const [{ data: leads, error }, aliasMap] = await Promise.all([
        query,
        getCampaignAliasMap(),
    ]);
    if (error) {
        console.error('[campaign-whatsapp] fetchWaLeadsNormalized Supabase query error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        throw new Error(error.message || error.details || 'Failed to query outreach_leads for WhatsApp');
    }

    const dateRange = (filters.from || filters.to) ? { fromIso: filters.from, toIso: filters.to } : undefined;
    return (leads || []).map(row => {
        const normalized = normalizeCampaignWaLead(row, dateRange);
        normalized.campaignAlias = resolveCampaignAliasFromMap(normalized.campaignId, normalized.campaignKey, aliasMap, row.assigned_lead);
        return normalized;
    });
}

/** Applies campaign (and, for the leads list, search/reply/PF/positive) filters
 *  in-memory on an already date-scoped, already-fetched lead list. */
function filterWaLeads(leads: CampaignWaLead[], filters: CampaignWaFilterParams): CampaignWaLead[] {
    return leads.filter(l => {
        if (filters.campaignIds && filters.campaignIds.length > 0) {
            const cId = l.campaignId !== null && l.campaignId !== undefined ? String(l.campaignId) : 'unknown';
            const cKey = (l.campaignKey || '').toLowerCase();
            const matches = filters.campaignIds.some(fId => {
                const f = fId.trim().toLowerCase();
                return f === cId.toLowerCase() || f === cKey || (f === 'unknown' && (l.campaignId === null || l.campaignId === undefined));
            });
            if (!matches) return false;
        }
        return true;
    });
}

/** Pure aggregation step — never re-fetches, so getCampaignWaAnalytics can
 *  reuse one already-fetched, already-filtered lead list for both the
 *  overview stats and the daily trend instead of hitting Postgres twice. */
function computeWaOverviewStats(filtered: CampaignWaLead[]): CampaignWaOverviewStats {
    let uniqueLeadsContacted = 0;
    let totalReplies = 0;
    let totalMessagesSent = 0;
    let pfLeads = 0;
    let positiveLeads = 0;

    const campaignMap: Record<string, {
        campaignId: string;
        campaignName: string;
        campaignAlias?: string | null;
        campaignColor: CampaignColor;
        leadsContacted: number;
        totalReplies: number;
        messagesSent: number;
        pfLeads: number;
        positiveLeads: number;
    }> = {};

    const stepMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    filtered.forEach(lead => {
        const isContacted = lead.isContacted;
        if (isContacted) uniqueLeadsContacted++;

        totalMessagesSent += lead.messagesSentCount;
        totalReplies += lead.repliesCount;

        if (lead.isPf) pfLeads++;
        if (lead.isPositive) positiveLeads++;

        lead.dispatchedOutreachInRange.forEach(m => {
            const step = typeof m.step === 'number' && m.step >= 1 && m.step <= 6 ? m.step : 1;
            stepMap[step] = (stepMap[step] || 0) + 1;
        });

        const cKey = lead.campaignId !== null && lead.campaignId !== undefined 
            ? String(lead.campaignId) 
            : (lead.campaignKey || 'unknown');

        if (!campaignMap[cKey]) {
            campaignMap[cKey] = {
                campaignId: cKey,
                campaignName: lead.campaignName || 'General Campaign',
                campaignAlias: lead.campaignAlias ?? null,
                campaignColor: lead.campaignColor,
                leadsContacted: 0,
                totalReplies: 0,
                messagesSent: 0,
                pfLeads: 0,
                positiveLeads: 0,
            };
        } else if (!campaignMap[cKey].campaignAlias && lead.campaignAlias) {
            campaignMap[cKey].campaignAlias = lead.campaignAlias;
        }
        if (isContacted) campaignMap[cKey].leadsContacted++;
        campaignMap[cKey].totalReplies += lead.repliesCount;
        campaignMap[cKey].messagesSent += lead.messagesSentCount;
        if (lead.isPf) campaignMap[cKey].pfLeads++;
        if (lead.isPositive) campaignMap[cKey].positiveLeads++;
    });

    const repliedLeadsCount = filtered.filter(l => l.isContacted && l.hasReplied).length;
    const replyRate = uniqueLeadsContacted > 0
        ? Math.round((repliedLeadsCount / uniqueLeadsContacted) * 1000) / 10
        : 0;

    return {
        uniqueLeadsContacted,
        totalReplies,
        totalMessagesSent,
        pfLeads,
        positiveLeads,
        totalEnrolled: filtered.length,
        replyRate,
        uniqueRepliedLeads: repliedLeadsCount,
        campaignBreakdown: Object.values(campaignMap),
        stepBreakdown: Object.entries(stepMap).map(([step, count]) => ({
            step: Number(step),
            sentCount: count,
        })),
    };
}

/** Fetches Overview statistics from public.outreach_leads */
export async function getCampaignWaOverview(filters: CampaignWaFilterParams = {}): Promise<CampaignWaOverviewStats> {
    const normalized = await fetchWaLeadsNormalized(filters);
    const filtered = filterWaLeads(normalized, filters);
    return computeWaOverviewStats(filtered);
}

/** Fetches paginated leads list from public.outreach_leads */
export async function getCampaignWaLeads(filters: CampaignWaFilterParams = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;

    const normalized = await fetchWaLeadsNormalized(filters);
    let leads = filterWaLeads(normalized, filters);

    // Apply search filter
    if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        leads = leads.filter(l =>
            l.fullName.toLowerCase().includes(q) ||
            (l.mobileNumber && l.mobileNumber.toLowerCase().includes(q)) ||
            (l.companyName && l.companyName.toLowerCase().includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q))
        );
    }

    // Apply reply status filter
    if (filters.replyStatus === 'replied') {
        leads = leads.filter(l => l.hasReplied);
    } else if (filters.replyStatus === 'not_replied') {
        leads = leads.filter(l => !l.hasReplied);
    }

    // Apply PF / Positive filter
    if (filters.leadStatus === 'pf') {
        leads = leads.filter(l => l.isPf);
    } else if (filters.leadStatus === 'positive') {
        leads = leads.filter(l => l.isPositive);
    }

    // Sort by lastContactedAt descending
    leads.sort((a, b) => {
        const timeA = a.lastContactedAt ? parseSafeTimestamp(a.lastContactedAt) : 0;
        const timeB = b.lastContactedAt ? parseSafeTimestamp(b.lastContactedAt) : 0;
        return timeB - timeA;
    });

    const totalCount = leads.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = leads.slice(startIndex, startIndex + pageSize);

    return {
        data: paginated,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
    };
}

/** Fetches a single lead detail with conversation */
export async function getCampaignWaLeadDetail(leadId: string): Promise<CampaignWaLead | null> {
    const [{ data, error }, aliasMap] = await Promise.all([
        supabaseAdmin
            .from('outreach_leads')
            .select('*')
            .eq('id', leadId)
            .single(),
        getCampaignAliasMap(),
    ]);

    if (error || !data) {
        return null;
    }

    const normalized = normalizeCampaignWaLead(data);
    normalized.campaignAlias = resolveCampaignAliasFromMap(normalized.campaignId, normalized.campaignKey, aliasMap, data.assigned_lead);
    return normalized;
}

/** Fetches Analytics metrics & trend data — reuses a single fetch+filter pass
 *  for both the overview stats and the daily trend. */
export async function getCampaignWaAnalytics(filters: CampaignWaFilterParams = {}) {
    const normalized = await fetchWaLeadsNormalized(filters);
    const leads = filterWaLeads(normalized, filters);
    const overview = computeWaOverviewStats(leads);

    // Daily activity trends — built from the already date-scoped
    // dispatchedOutreachInRange/customerRepliesInRange lists, not the full
    // lifetime timeline, so the trend never shows activity outside the
    // selected date range.
    const dailyMap: Record<string, { date: string; sent: number; replies: number }> = {};

    const bumpDaily = (rawDate: string | null | undefined, field: 'sent' | 'replies') => {
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;
        const dateKey = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (!dailyMap[dateKey]) {
            dailyMap[dateKey] = { date: dateKey, sent: 0, replies: 0 };
        }
        dailyMap[dateKey][field] += 1;
    };

    leads.forEach(l => {
        l.dispatchedOutreachInRange.forEach(m => bumpDaily(m.attempted_at || m.timestamp, 'sent'));
        l.customerRepliesInRange.forEach(m => bumpDaily(m.timestamp || m.attempted_at, 'replies'));
    });

    const trendData = Object.values(dailyMap).slice(-14);

    return {
        overview,
        trendData,
        campaigns: overview.campaignBreakdown,
        stepBreakdown: overview.stepBreakdown,
    };
}

