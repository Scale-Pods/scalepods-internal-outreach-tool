import { supabaseAdmin } from '@/lib/supabase';
import { campaignColor, CampaignColor } from '@/lib/services/campaigns';
import { formatCampaignName, resolveCampaignInfo, parseSafeTimestamp } from '@/lib/services/campaign-whatsapp';

// All campaign-module voice data is sourced exclusively from vapi_call_logs
// where vapi_account = 'sarvam'. Campaign/lead attribution is resolved by
// matching customer_phone against outreach_leads, but only for the small set
// of phone numbers actually present in the (date-filtered) call rows — never
// a full-table fetch of outreach_leads.
const SARVAM_ACCOUNT = 'sarvam';

export interface CampaignVoiceFilterParams {
    campaignIds?: string[];
    search?: string;
    from?: string;
    to?: string;
    status?: string;
    sentiment?: string; // 'all' | 'positive' | 'negative' | 'neutral'
    direction?: string; // 'all' | 'inbound' | 'outbound'
    page?: number;
    pageSize?: number;
    callNumber?: number; // 1 | 2 | 3
}

export interface CampaignVoiceCall {
    id: string;
    callNumber: 1 | 2 | 3;
    leadId: string | null;
    leadName: string;
    phone: string;
    companyName: string | null;
    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string;
    campaignColor: CampaignColor | 'slate';
    callDate: string | null;
    durationSeconds: number;
    status: string;
    sentiment: 'positive' | 'negative' | 'neutral' | 'unknown';
    rawSentiment: string | null;
    sentimentScore: number | null;
    summary: string | null;
    note: string | null;
    recordingUrl: string | null;
    transcript: string | null;
    isPickedUp: boolean;
    costUsd: number | null;
    source: 'sarvam';
    vapiCallId: string | null;
    callType: string | null;
    isInbound: boolean;
}

export interface CampaignVoiceOverviewStats {
    totalCalls: number;
    uniqueLeadsContacted: number;
    callsPickedUp: number;
    callsMissed: number;
    positiveSentimentCalls: number;
    negativeSentimentCalls: number;
    neutralSentimentCalls: number;
    totalDurationSeconds: number;
    avgDurationSeconds: number;
    totalCostUsd: number | null;
    pickupRate: number; // percentage
    completionRate: number; // percentage
    inboundCalls: number;
    outboundCalls: number;
    inboundPickedUp: number;
    inboundRate: number; // percentage
    campaignBreakdown: {
        campaignId: string;
        campaignName: string;
        campaignColor: CampaignColor | 'slate';
        totalCalls: number;
        uniqueLeads: number;
        pickedUpCalls: number;
        positiveCalls: number;
        avgDurationSeconds: number;
    }[];
    callNumberBreakdown: {
        callNumber: number;
        count: number;
        pickedUp: number;
        positive: number;
    }[];
    dailyVolume: {
        date: string;
        totalCalls: number;
        pickedUp: number;
        durationSeconds: number;
    }[];
    hourlyDistribution: {
        name: string;
        calls: number;
    }[];
}

/** Determines if call was picked up / connected */
export function isCallPickedUp(status?: string | null, durationSeconds: number = 0, replyTrack?: string | null): boolean {
    if (replyTrack && String(replyTrack).toLowerCase().includes('picked')) return true;
    const s = String(status || '').toLowerCase().trim();
    if (s.includes('no_answer') || s.includes('no-answer') || s.includes('failed') || s.includes('busy') || s.includes('voicemail') || s.includes('did-not-answer') || s.includes('cancelled')) {
        return false;
    }
    if (s.includes('interested') || s.includes('completed') || s.includes('connected') || s.includes('answered') || s.includes('in-progress')) {
        return true;
    }
    return durationSeconds >= 15;
}

/** Extracts numeric confidence score from text if explicitly present, e.g. "(0.80)" or "sentiment: positive (0.85)" */
export function extractSentimentScore(text?: string | null): number | null {
    if (!text) return null;
    const match = text.match(/\((\d+(\.\d+)?)\)/) || text.match(/sentiment:\s*\w+\s*\((\d+(\.\d+)?)\)/i);
    return match ? parseFloat(match[1]) : null;
}

/**
 * Normalizes voice sentiment string into positive, negative, neutral or unknown.
 * vapi_call_logs has no structured sentiment column, so this always runs off
 * the call summary text (passed as noteRaw).
 */
export function normalizeVoiceSentiment(sentimentRaw?: string | null, noteRaw?: string | null): {
    category: 'positive' | 'negative' | 'neutral' | 'unknown';
    score: number | null;
    raw: string | null;
} {
    const raw = sentimentRaw ? String(sentimentRaw).trim() : null;
    const note = noteRaw ? String(noteRaw).trim() : '';

    const score = extractSentimentScore(raw) ?? extractSentimentScore(note);

    if (raw) {
        const lowerRaw = raw.toLowerCase();
        if (
            lowerRaw === 'positive' ||
            lowerRaw.includes('positive') ||
            lowerRaw.includes('interested') ||
            lowerRaw.includes('callback') ||
            lowerRaw.includes('expression of interest')
        ) {
            return { category: 'positive', score, raw };
        }
        if (
            lowerRaw === 'negative' ||
            lowerRaw.includes('negative') ||
            lowerRaw.includes('not interested') ||
            lowerRaw.includes('unsubscribe') ||
            lowerRaw.includes('dnd') ||
            lowerRaw.includes('wrong number')
        ) {
            return { category: 'negative', score, raw };
        }
        if (
            lowerRaw === 'neutral' ||
            lowerRaw.includes('neutral') ||
            lowerRaw.includes('general inquiry')
        ) {
            return { category: 'neutral', score, raw };
        }
        return { category: 'neutral', score, raw };
    }

    if (note) {
        const lowerNote = note.toLowerCase();
        if (
            lowerNote.includes('sentiment: positive') ||
            lowerNote.includes('lead temperature: hot') ||
            lowerNote.includes('lead temperature: warm') ||
            lowerNote.includes('intent: interested') ||
            lowerNote.includes('emotions: interested')
        ) {
            return { category: 'positive', score, raw: null };
        }
        if (
            lowerNote.includes('sentiment: negative') ||
            lowerNote.includes('not interested') ||
            lowerNote.includes('dnd') ||
            lowerNote.includes('wrong number')
        ) {
            return { category: 'negative', score, raw: null };
        }
        if (lowerNote.includes('sentiment: neutral') || lowerNote.includes('no_response') || lowerNote.includes('lead temperature: cold')) {
            return { category: 'neutral', score, raw: null };
        }
    }

    return { category: 'unknown', score: null, raw: null };
}

function last10Digits(phone?: string | null): string {
    return String(phone || '').replace(/\D/g, '').slice(-10);
}

/** Fetches sarvam call rows from vapi_call_logs with date filtering pushed to Postgres,
 *  then resolves campaign/lead attribution via a small targeted outreach_leads lookup
 *  scoped only to the phone numbers present in that result set. */
async function fetchSarvamCallsWithAttribution(filters: Pick<CampaignVoiceFilterParams, 'from' | 'to'>): Promise<CampaignVoiceCall[]> {
    let query = supabaseAdmin
        .from('vapi_call_logs')
        .select('id, started_at, customer_phone, customer_name, duration_seconds, status, cost_usd, summary, recording_url, transcript, created_at, vapi_account, type')
        .ilike('vapi_account', SARVAM_ACCOUNT)
        .order('started_at', { ascending: true })
        .limit(10000);

    if (filters.from) {
        query = query.gte('created_at', filters.from);
    }
    if (filters.to) {
        query = query.lte('created_at', filters.to);
    }

    const { data: calls, error } = await query;
    if (error) {
        console.error('[campaign-voice] vapi_call_logs fetch error:', error);
        throw new Error(error.message || 'Failed to fetch vapi_call_logs');
    }

    const rows = calls || [];
    if (rows.length === 0) return [];

    // Resolve lead/campaign attribution only for the phone numbers actually present here.
    const phoneDigitsSet = new Set<string>();
    rows.forEach(r => {
        const digits = last10Digits(r.customer_phone);
        if (digits.length >= 7) phoneDigitsSet.add(digits);
    });

    const leadByPhone = new Map<string, any>();
    if (phoneDigitsSet.size > 0) {
        const orClauses = Array.from(phoneDigitsSet)
            .map(d => [`mobile_number.ilike.%${d}`, `mobile_number_2.ilike.%${d}`, `company_phone.ilike.%${d}`].join(','))
            .join(',');

        const { data: leadRows, error: leadErr } = await supabaseAdmin
            .from('outreach_leads')
            .select('id, full_name, first_name, last_name, mobile_number, mobile_number_2, company_phone, company_name, campaign_id, campaign_key')
            .or(orClauses)
            .limit(5000);

        if (leadErr) {
            console.error('[campaign-voice] outreach_leads attribution lookup error:', leadErr);
        } else {
            (leadRows || []).forEach(l => {
                [l.mobile_number, l.mobile_number_2, l.company_phone].forEach(p => {
                    const digits = last10Digits(p);
                    if (digits.length >= 7 && phoneDigitsSet.has(digits) && !leadByPhone.has(digits)) {
                        leadByPhone.set(digits, l);
                    }
                });
            });
        }
    }

    // Rank calls to the same phone number chronologically to derive a "touch" number (1/2/3+).
    const touchCounters = new Map<string, number>();

    return rows.map(r => {
        const digits = last10Digits(r.customer_phone);
        const lead = digits ? leadByPhone.get(digits) : undefined;

        const touchIndex = (touchCounters.get(digits) || 0) + 1;
        touchCounters.set(digits, touchIndex);
        const callNumber = (Math.min(touchIndex, 3) as 1 | 2 | 3);

        return mapVapiRowToCall(r, lead, callNumber);
    }).sort((a, b) => parseSafeTimestamp(b.callDate) - parseSafeTimestamp(a.callDate));
}

/** Maps a single vapi_call_logs row (+ its resolved outreach_leads attribution, if any)
 *  into the shared CampaignVoiceCall shape. Used by both the bulk fetch above and the
 *  targeted single-lead lookup (getCampaignVoiceCallByLeadId) below. */
function mapVapiRowToCall(r: any, lead: any | undefined, callNumber: 1 | 2 | 3): CampaignVoiceCall {
    const rawCampaignId = lead?.campaign_id !== undefined && lead?.campaign_id !== null ? Number(lead.campaign_id) : null;
    const { campaignId, campaignKey, campaignName, color } = resolveCampaignInfo(rawCampaignId, lead?.campaign_key || null);

    const durationSeconds = r.duration_seconds ? Math.round(Number(r.duration_seconds)) : 0;
    const { category, score, raw } = normalizeVoiceSentiment(null, r.summary);
    const isPicked = isCallPickedUp(r.status, durationSeconds);

    return {
        id: r.id,
        callNumber,
        leadId: lead?.id ?? null,
        leadName: lead
            ? (lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown Lead')
            : (r.customer_name || 'Unknown Lead'),
        phone: r.customer_phone || '—',
        companyName: lead?.company_name || null,
        campaignId,
        campaignKey,
        campaignName,
        campaignColor: color,
        callDate: r.started_at || r.created_at,
        durationSeconds,
        status: r.status || 'Completed',
        sentiment: category,
        rawSentiment: raw,
        sentimentScore: score,
        summary: r.summary || null,
        note: null,
        recordingUrl: r.recording_url || null,
        transcript: r.transcript || null,
        isPickedUp: isPicked,
        costUsd: r.cost_usd !== null && r.cost_usd !== undefined ? Number(r.cost_usd) : null,
        source: 'sarvam',
        vapiCallId: r.id,
        callType: r.type || null,
        isInbound: String(r.type || '').toLowerCase() === 'inboundphonecall',
    } satisfies CampaignVoiceCall;
}

/** Targeted lookup for a single lead's call(s) by outreach_leads.id — used for the
 *  public shareable call-details link. Scoped to one lead's phone numbers only,
 *  never a bulk fetch. If callId (a vapi_call_logs.id) is given, returns that exact
 *  call; otherwise returns the most recent call for the lead. */
export async function getCampaignVoiceCallByLeadId(leadId: string, callId?: string): Promise<{
    lead: { id: string; name: string; phone: string; companyName: string | null } | null;
    call: CampaignVoiceCall | null;
    calls: CampaignVoiceCall[];
}> {
    const { data: lead, error: leadErr } = await supabaseAdmin
        .from('outreach_leads')
        .select('id, full_name, first_name, last_name, mobile_number, mobile_number_2, company_phone, company_name, campaign_id, campaign_key')
        .eq('id', leadId)
        .maybeSingle();

    if (leadErr) {
        console.error('[campaign-voice] getCampaignVoiceCallByLeadId lead lookup error:', leadErr);
    }
    if (!lead) {
        return { lead: null, call: null, calls: [] };
    }

    const leadSummary = {
        id: lead.id,
        name: lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown Lead',
        phone: lead.mobile_number || lead.mobile_number_2 || lead.company_phone || '—',
        companyName: lead.company_name || null,
    };

    const phoneDigitsSet = new Set<string>();
    [lead.mobile_number, lead.mobile_number_2, lead.company_phone].forEach(p => {
        const d = last10Digits(p);
        if (d.length >= 7) phoneDigitsSet.add(d);
    });

    if (phoneDigitsSet.size === 0) {
        return { lead: leadSummary, call: null, calls: [] };
    }

    const orClauses = Array.from(phoneDigitsSet).map(d => `customer_phone.ilike.%${d}`).join(',');

    const { data: rows, error } = await supabaseAdmin
        .from('vapi_call_logs')
        .select('id, started_at, customer_phone, customer_name, duration_seconds, status, cost_usd, summary, recording_url, transcript, created_at, vapi_account, type')
        .ilike('vapi_account', SARVAM_ACCOUNT)
        .or(orClauses)
        .order('started_at', { ascending: true })
        .limit(50);

    if (error) {
        console.error('[campaign-voice] getCampaignVoiceCallByLeadId calls lookup error:', error);
        throw new Error(error.message || 'Failed to fetch call for lead');
    }

    const calls = (rows || [])
        .map((r, idx) => mapVapiRowToCall(r, lead, (Math.min(idx + 1, 3) as 1 | 2 | 3)))
        .sort((a, b) => parseSafeTimestamp(b.callDate) - parseSafeTimestamp(a.callDate));

    const selected = (callId ? calls.find(c => c.vapiCallId === callId) : null) || calls[0] || null;

    return { lead: leadSummary, call: selected, calls };
}

/** Filters a list of campaign voice calls using provided parameters (date range is
 *  already applied at the DB level by fetchSarvamCallsWithAttribution). */
export function filterCampaignVoiceCalls(calls: CampaignVoiceCall[], filters: CampaignVoiceFilterParams = {}): CampaignVoiceCall[] {
    return calls.filter(c => {
        if (filters.campaignIds && filters.campaignIds.length > 0) {
            const cId = c.campaignId !== null && c.campaignId !== undefined ? String(c.campaignId) : 'unknown';
            const cKey = (c.campaignKey || '').toLowerCase();
            const matches = filters.campaignIds.some(fId => {
                const f = fId.trim().toLowerCase();
                return f === cId.toLowerCase() || f === cKey || (f === 'unknown' && (c.campaignId === null || c.campaignId === undefined));
            });
            if (!matches) return false;
        }

        if (filters.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            const phoneDigits = q.replace(/\D/g, '');
            const callDigits = c.phone.replace(/\D/g, '');
            const textMatch =
                c.leadName.toLowerCase().includes(q) ||
                (c.companyName && c.companyName.toLowerCase().includes(q)) ||
                (c.summary && c.summary.toLowerCase().includes(q)) ||
                c.status.toLowerCase().includes(q);
            const digitsMatch = phoneDigits && callDigits.includes(phoneDigits);
            if (!textMatch && !digitsMatch) return false;
        }

        if (filters.callNumber && c.callNumber !== filters.callNumber) {
            return false;
        }

        if (filters.status && filters.status !== 'all') {
            const s = filters.status.toLowerCase();
            if (s === 'picked_up' && !c.isPickedUp) return false;
            if (s === 'missed' && c.isPickedUp) return false;
            if (s !== 'picked_up' && s !== 'missed' && !c.status.toLowerCase().includes(s)) return false;
        }

        if (filters.sentiment && filters.sentiment !== 'all') {
            if (c.sentiment !== filters.sentiment.toLowerCase()) return false;
        }

        if (filters.direction && filters.direction !== 'all') {
            const d = filters.direction.toLowerCase();
            if (d === 'inbound' && !c.isInbound) return false;
            if (d === 'outbound' && c.isInbound) return false;
        }

        return true;
    });
}

/** Pure aggregation step — never re-fetches, so callers that already hold a
 *  filtered call list (e.g. getCampaignVoiceAnalytics) can reuse it instead
 *  of hitting Postgres twice. */
function computeOverviewStats(filtered: CampaignVoiceCall[]): CampaignVoiceOverviewStats {
    let totalCalls = filtered.length;
    let callsPickedUp = 0;
    let callsMissed = 0;
    let positiveSentimentCalls = 0;
    let negativeSentimentCalls = 0;
    let neutralSentimentCalls = 0;
    let totalDurationSeconds = 0;
    let hasCostData = false;
    let totalCostUsd = 0;
    let inboundCalls = 0;
    let inboundPickedUp = 0;

    const uniqueLeadsSet = new Set<string>();

    const campaignMap: Record<string, {
        campaignId: string;
        campaignName: string;
        campaignColor: CampaignColor | 'slate';
        totalCalls: number;
        leadsSet: Set<string>;
        pickedUpCalls: number;
        positiveCalls: number;
        totalDurationSeconds: number;
    }> = {};

    const callNumberMap: Record<number, { count: number; pickedUp: number; positive: number }> = {
        1: { count: 0, pickedUp: 0, positive: 0 },
        2: { count: 0, pickedUp: 0, positive: 0 },
        3: { count: 0, pickedUp: 0, positive: 0 },
    };

    const dailyMap: Record<string, { date: string; totalCalls: number; pickedUp: number; durationSeconds: number }> = {};
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;

    filtered.forEach(c => {
        uniqueLeadsSet.add(c.leadId || c.phone);

        if (c.isPickedUp) callsPickedUp++;
        else callsMissed++;

        if (c.isInbound) {
            inboundCalls++;
            if (c.isPickedUp) inboundPickedUp++;
        }

        if (c.sentiment === 'positive') positiveSentimentCalls++;
        else if (c.sentiment === 'negative') negativeSentimentCalls++;
        else if (c.sentiment === 'neutral') neutralSentimentCalls++;

        totalDurationSeconds += c.durationSeconds;
        if (c.costUsd !== null && c.costUsd !== undefined) {
            hasCostData = true;
            totalCostUsd += c.costUsd;
        }

        const cKey = c.campaignId !== null && c.campaignId !== undefined ? String(c.campaignId) : (c.campaignKey || 'unknown');
        if (!campaignMap[cKey]) {
            campaignMap[cKey] = {
                campaignId: cKey,
                campaignName: c.campaignName,
                campaignColor: c.campaignColor,
                totalCalls: 0,
                leadsSet: new Set(),
                pickedUpCalls: 0,
                positiveCalls: 0,
                totalDurationSeconds: 0,
            };
        }
        campaignMap[cKey].totalCalls++;
        campaignMap[cKey].leadsSet.add(c.leadId || c.phone);
        if (c.isPickedUp) campaignMap[cKey].pickedUpCalls++;
        if (c.sentiment === 'positive') campaignMap[cKey].positiveCalls++;
        campaignMap[cKey].totalDurationSeconds += c.durationSeconds;

        if (callNumberMap[c.callNumber]) {
            callNumberMap[c.callNumber].count++;
            if (c.isPickedUp) callNumberMap[c.callNumber].pickedUp++;
            if (c.sentiment === 'positive') callNumberMap[c.callNumber].positive++;
        }

        if (c.callDate) {
            const d = new Date(c.callDate);
            if (!isNaN(d.getTime())) {
                const dayKey = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                if (!dailyMap[dayKey]) {
                    dailyMap[dayKey] = { date: dayKey, totalCalls: 0, pickedUp: 0, durationSeconds: 0 };
                }
                dailyMap[dayKey].totalCalls++;
                if (c.isPickedUp) dailyMap[dayKey].pickedUp++;
                dailyMap[dayKey].durationSeconds += c.durationSeconds;

                const hour = d.getHours();
                hourMap[hour] = (hourMap[hour] || 0) + 1;
            }
        }
    });

    const uniqueLeadsContacted = uniqueLeadsSet.size;
    const avgDurationSeconds = totalCalls > 0 ? Math.round(totalDurationSeconds / totalCalls) : 0;
    const pickupRate = totalCalls > 0 ? Math.round((callsPickedUp / totalCalls) * 1000) / 10 : 0;
    const completedCount = filtered.filter(c => c.status.toLowerCase().includes('completed') || c.status.toLowerCase().includes('interested')).length;
    const completionRate = totalCalls > 0 ? Math.round((completedCount / totalCalls) * 1000) / 10 : 0;
    const outboundCalls = totalCalls - inboundCalls;
    const inboundRate = totalCalls > 0 ? Math.round((inboundCalls / totalCalls) * 1000) / 10 : 0;

    const campaignBreakdown = Object.values(campaignMap).map(c => ({
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        campaignColor: c.campaignColor,
        totalCalls: c.totalCalls,
        uniqueLeads: c.leadsSet.size,
        pickedUpCalls: c.pickedUpCalls,
        positiveCalls: c.positiveCalls,
        avgDurationSeconds: c.totalCalls > 0 ? Math.round(c.totalDurationSeconds / c.totalCalls) : 0,
    }));

    const callNumberBreakdown = Object.entries(callNumberMap).map(([slot, data]) => ({
        callNumber: Number(slot),
        count: data.count,
        pickedUp: data.pickedUp,
        positive: data.positive,
    }));

    const dailyVolume = Object.values(dailyMap).slice(-14);
    const hourlyDistribution = Object.entries(hourMap).map(([h, count]) => ({
        name: `${h.padStart(2, '0')}:00`,
        calls: count,
    }));

    return {
        totalCalls,
        uniqueLeadsContacted,
        callsPickedUp,
        callsMissed,
        positiveSentimentCalls,
        negativeSentimentCalls,
        neutralSentimentCalls,
        totalDurationSeconds,
        avgDurationSeconds,
        totalCostUsd: hasCostData ? Math.round(totalCostUsd * 100) / 100 : null,
        pickupRate,
        completionRate,
        inboundCalls,
        outboundCalls,
        inboundPickedUp,
        inboundRate,
        campaignBreakdown,
        callNumberBreakdown,
        dailyVolume,
        hourlyDistribution,
    };
}

/** Fetches Overview statistics dynamically for Campaign Voice (sarvam only) */
export async function getCampaignVoiceOverview(filters: CampaignVoiceFilterParams = {}): Promise<CampaignVoiceOverviewStats> {
    const allCalls = await fetchSarvamCallsWithAttribution(filters);
    const filtered = filterCampaignVoiceCalls(allCalls, filters);
    return computeOverviewStats(filtered);
}

/** Fetches paginated campaign voice call logs (sarvam only) */
export async function getCampaignVoiceCallLogs(filters: CampaignVoiceFilterParams = {}) {
    const allCalls = await fetchSarvamCallsWithAttribution(filters);
    const filtered = filterCampaignVoiceCalls(allCalls, filters);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;
    const totalCount = filtered.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return {
        data: paginated,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
    };
}

/** Fetches Analytics data for Campaign Voice (sarvam only) */
export async function getCampaignVoiceAnalytics(filters: CampaignVoiceFilterParams = {}) {
    const allCalls = await fetchSarvamCallsWithAttribution(filters);
    const filtered = filterCampaignVoiceCalls(allCalls, filters);
    const overview = computeOverviewStats(filtered);

    const sentimentDistribution = [
        { name: 'Positive', count: overview.positiveSentimentCalls, color: 'text-emerald-600 bg-emerald-50' },
        { name: 'Neutral', count: overview.neutralSentimentCalls, color: 'text-slate-600 bg-slate-50' },
        { name: 'Negative', count: overview.negativeSentimentCalls, color: 'text-rose-600 bg-rose-50' },
    ];

    const outcomeMap: Record<string, number> = {};
    filtered.forEach(c => {
        const s = c.status || 'Completed';
        outcomeMap[s] = (outcomeMap[s] || 0) + 1;
    });

    const outcomes = Object.entries(outcomeMap).map(([status, count]) => ({
        status,
        count,
    })).sort((a, b) => b.count - a.count);

    return {
        overview,
        sentimentDistribution,
        outcomes,
        campaigns: overview.campaignBreakdown,
        callNumberBreakdown: overview.callNumberBreakdown,
        dailyVolume: overview.dailyVolume,
        hourlyDistribution: overview.hourlyDistribution,
    };
}
