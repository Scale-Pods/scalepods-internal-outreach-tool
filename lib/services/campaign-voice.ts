import { supabaseAdmin } from '@/lib/supabase';
import { campaignColor, CampaignColor } from '@/lib/services/campaigns';
import { formatCampaignName, resolveCampaignInfo, parseSafeTimestamp } from '@/lib/services/campaign-whatsapp';

export interface CampaignVoiceFilterParams {
    campaignIds?: string[];
    search?: string;
    from?: string;
    to?: string;
    status?: string;
    sentiment?: string; // 'all' | 'positive' | 'negative' | 'neutral'
    page?: number;
    pageSize?: number;
    callNumber?: number; // 1 | 2 | 3
}

export interface CampaignVoiceCall {
    id: string;
    callNumber: 1 | 2 | 3;
    leadId: string;
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
    source: 'sarvam' | 'vapi' | 'twilio' | 'outreach_leads';
    vapiCallId: string | null;
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

export interface CampaignVoiceColdCall {
    id: string;
    callSid: string;
    from: string;
    to: string;
    direction: string;
    status: string;
    durationSeconds: number;
    recordingUrl: string | null;
    transcript: string | null;
    transcriptionStatus: string | null;
    startedAt: string | null;
    createdAt: string | null;
    leadId: string | null;
    leadName: string;
    campaignId: number | null;
    campaignKey: string | null;
    campaignName: string;
    campaignColor: CampaignColor | 'slate';
    isAttributed: boolean;
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
 * Stored sentiment from outreach_leads is the primary source of truth.
 * Note or transcript fallback is ONLY evaluated if sentimentRaw is null or empty.
 * Never invents synthetic confidence scores.
 */
export function normalizeVoiceSentiment(sentimentRaw?: string | null, noteRaw?: string | null): {
    category: 'positive' | 'negative' | 'neutral' | 'unknown';
    score: number | null;
    raw: string | null;
} {
    const raw = sentimentRaw ? String(sentimentRaw).trim() : null;
    const note = noteRaw ? String(noteRaw).trim() : '';

    // Extract genuine score from raw or note if present, but never invent one
    const score = extractSentimentScore(raw) ?? extractSentimentScore(note);

    // 1. PRIMARY SOURCE OF TRUTH: If stored sentiment exists, use it directly
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
        // If stored sentiment is any other non-empty string, categorize as neutral with raw preserved
        return { category: 'neutral', score, raw };
    }

    // 2. FALLBACK ONLY: If stored sentiment is null or empty, check note keywords
    if (note) {
        const lowerNote = note.toLowerCase();
        if (
            lowerNote.includes('sentiment: positive') ||
            lowerNote.includes('positive') ||
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
        if (lowerNote.includes('sentiment: neutral')) {
            return { category: 'neutral', score, raw: null };
        }
    }

    return { category: 'unknown', score: null, raw: null };
}

/** Extracts [ref <call_id>] from call note if present */
export function extractRefCallId(note?: string | null): string | null {
    if (!note) return null;
    const match = note.match(/\[ref\s+([^\]]+)\]/i);
    return match ? match[1].trim() : null;
}

/** Extracts duration in seconds from note string (e.g. "124s." or "45s") */
export function extractDurationFromNote(note?: string | null): number {
    if (!note) return 0;
    const match = note.match(/(\d+)\s*s\b/i);
    return match ? parseInt(match[1], 10) : 0;
}

/** Builds CampaignVoiceCall objects from outreach_leads row and matched vapi_call_logs */
export function buildCampaignVoiceCallsFromLead(
    lead: any,
    vapiMapByRef: Map<string, any>,
    vapiMapByPhone: Map<string, any[]>
): CampaignVoiceCall[] {
    const calls: CampaignVoiceCall[] = [];
    const leadPhone = (lead.mobile_number || lead.company_phone || '').trim();
    const phoneDigits = leadPhone.replace(/\D/g, '').slice(-10);

    const rawCampaignId = lead.campaign_id !== undefined && lead.campaign_id !== null ? Number(lead.campaign_id) : null;
    const { campaignId, campaignKey, campaignName, color } = resolveCampaignInfo(rawCampaignId, lead.campaign_key || null);

    const slots: (1 | 2 | 3)[] = [1, 2, 3];

    slots.forEach(slot => {
        const date = lead[`call_${slot}_date`];
        const status = lead[`call_${slot}_status`];
        const sentiment = lead[`call_${slot}_sentiment`];
        const note = lead[`call_${slot}_note`];
        const recording = lead[`call_recording_${slot}`];

        // If slot has no call recorded, skip
        if (!date && !status && !sentiment && !note) {
            return;
        }

        const refId = extractRefCallId(note);
        let vapiCall: any = null;

        if (refId && vapiMapByRef.has(refId)) {
            vapiCall = vapiMapByRef.get(refId);
        } else if (phoneDigits && vapiMapByPhone.has(phoneDigits)) {
            const candidates = vapiMapByPhone.get(phoneDigits) || [];
            if (candidates.length === 1) {
                // Exactly one valid candidate -> match
                vapiCall = candidates[0];
            } else {
                // Ambiguous: multiple call candidates match this phone number.
                // Never assign an ambiguous call to a lead.
                vapiCall = null;
            }
        }

        const durationSeconds = vapiCall?.duration_seconds
            ? Math.round(Number(vapiCall.duration_seconds))
            : extractDurationFromNote(note);

        const { category, score, raw } = normalizeVoiceSentiment(sentiment, note || vapiCall?.summary);
        const effectiveStatus = status || vapiCall?.status || 'Completed';
        const isPicked = isCallPickedUp(effectiveStatus, durationSeconds, lead.call_reply_track);

        const effectiveDate = date || vapiCall?.started_at || vapiCall?.created_at || lead.created_at;

        calls.push({
            id: refId || vapiCall?.id || `${lead.id}-call-${slot}`,
            callNumber: slot,
            leadId: lead.id,
            leadName: lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown Lead',
            phone: leadPhone || vapiCall?.customer_phone || '—',
            companyName: lead.company_name || null,
            campaignId,
            campaignKey,
            campaignName,
            campaignColor: color,
            callDate: effectiveDate,
            durationSeconds,
            status: effectiveStatus,
            sentiment: category,
            rawSentiment: raw,
            sentimentScore: score,
            summary: vapiCall?.summary || note || null,
            note: note || null,
            recordingUrl: recording || vapiCall?.recording_url || null,
            transcript: vapiCall?.transcript || null,
            isPickedUp: isPicked,
            costUsd: vapiCall?.cost_usd ? Number(vapiCall.cost_usd) : null,
            source: vapiCall?.source === 'sarvam' ? 'sarvam' : (vapiCall ? 'vapi' : 'outreach_leads'),
            vapiCallId: refId || vapiCall?.id || null,
        });
    });

    return calls;
}

/** Fetches and normalizes all campaign voice calls from outreach_leads & vapi_call_logs */
export async function getAllCampaignVoiceCalls(): Promise<CampaignVoiceCall[]> {
    // 1. Fetch outreach_leads with call activity
    const { data: leads, error: leadErr } = await supabaseAdmin
        .from('outreach_leads')
        .select(`
            id, full_name, first_name, last_name, mobile_number, mobile_number_2, company_phone, company_name,
            campaign_id, campaign_key, voice_status, voice_touches, call_reply_track, replied,
            call_1_date, call_1_status, call_1_sentiment, call_1_note, call_recording_1,
            call_2_date, call_2_status, call_2_sentiment, call_2_note, call_recording_2,
            call_3_date, call_3_status, call_3_sentiment, call_3_note, call_recording_3,
            created_at, updated_at
        `)
        .or('call_1_date.not.is.null,call_1_status.not.is.null,call_1_sentiment.not.is.null,call_2_date.not.is.null,call_2_status.not.is.null,call_3_date.not.is.null,call_3_status.not.is.null,voice_status.not.is.null');

    if (leadErr) {
        console.error('[campaign-voice] outreach_leads fetch error:', leadErr);
        throw new Error(leadErr.message || 'Failed to fetch outreach_leads for voice');
    }

    // 2. Fetch vapi_call_logs
    const { data: vapiLogs, error: vapiErr } = await supabaseAdmin
        .from('vapi_call_logs')
        .select('*');

    if (vapiErr) {
        console.error('[campaign-voice] vapi_call_logs fetch error:', vapiErr);
    }

    // Index vapi_call_logs by ID and phone suffix
    const vapiMapByRef = new Map<string, any>();
    const vapiMapByPhone = new Map<string, any[]>();

    (vapiLogs || []).forEach(v => {
        if (v.id) vapiMapByRef.set(String(v.id).trim(), v);
        const digits = (v.customer_phone || '').replace(/\D/g, '').slice(-10);
        if (digits) {
            const arr = vapiMapByPhone.get(digits) || [];
            arr.push(v);
            vapiMapByPhone.set(digits, arr);
        }
    });

    const allCalls: CampaignVoiceCall[] = [];
    (leads || []).forEach(l => {
        const leadCalls = buildCampaignVoiceCallsFromLead(l, vapiMapByRef, vapiMapByPhone);
        allCalls.push(...leadCalls);
    });

    // Sort calls descending by callDate
    allCalls.sort((a, b) => {
        const tA = parseSafeTimestamp(a.callDate);
        const tB = parseSafeTimestamp(b.callDate);
        return tB - tA;
    });

    return allCalls;
}

/** Filters a list of campaign voice calls using provided parameters */
export function filterCampaignVoiceCalls(calls: CampaignVoiceCall[], filters: CampaignVoiceFilterParams = {}): CampaignVoiceCall[] {
    return calls.filter(c => {
        // Campaign filter
        if (filters.campaignIds && filters.campaignIds.length > 0) {
            const cId = c.campaignId !== null && c.campaignId !== undefined ? String(c.campaignId) : 'unknown';
            const cKey = (c.campaignKey || '').toLowerCase();
            const matches = filters.campaignIds.some(fId => {
                const f = fId.trim().toLowerCase();
                return f === cId.toLowerCase() || f === cKey || (f === 'unknown' && (c.campaignId === null || c.campaignId === undefined));
            });
            if (!matches) return false;
        }

        // Search filter (lead name, phone, company, summary, note)
        if (filters.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            const phoneDigits = q.replace(/\D/g, '');
            const callDigits = c.phone.replace(/\D/g, '');
            const textMatch =
                c.leadName.toLowerCase().includes(q) ||
                (c.companyName && c.companyName.toLowerCase().includes(q)) ||
                (c.summary && c.summary.toLowerCase().includes(q)) ||
                (c.note && c.note.toLowerCase().includes(q)) ||
                c.status.toLowerCase().includes(q);
            const digitsMatch = phoneDigits && callDigits.includes(phoneDigits);
            if (!textMatch && !digitsMatch) return false;
        }

        // Call Number filter
        if (filters.callNumber && c.callNumber !== filters.callNumber) {
            return false;
        }

        // Status filter
        if (filters.status && filters.status !== 'all') {
            const s = filters.status.toLowerCase();
            if (s === 'picked_up' && !c.isPickedUp) return false;
            if (s === 'missed' && c.isPickedUp) return false;
            if (s !== 'picked_up' && s !== 'missed' && !c.status.toLowerCase().includes(s)) return false;
        }

        // Sentiment filter
        if (filters.sentiment && filters.sentiment !== 'all') {
            if (c.sentiment !== filters.sentiment.toLowerCase()) return false;
        }

        // Date range filter
        if (!filters.from && !filters.to) return true;
        const time = parseSafeTimestamp(c.callDate);
        if (!time) return false;
        if (filters.from && time < parseSafeTimestamp(filters.from, false)) return false;
        if (filters.to && time > parseSafeTimestamp(filters.to, true)) return false;

        return true;
    });
}

/** Fetches Overview statistics dynamically for Campaign Voice */
export async function getCampaignVoiceOverview(filters: CampaignVoiceFilterParams = {}): Promise<CampaignVoiceOverviewStats> {
    const allCalls = await getAllCampaignVoiceCalls();
    const filtered = filterCampaignVoiceCalls(allCalls, filters);

    let totalCalls = filtered.length;
    let callsPickedUp = 0;
    let callsMissed = 0;
    let positiveSentimentCalls = 0;
    let negativeSentimentCalls = 0;
    let neutralSentimentCalls = 0;
    let totalDurationSeconds = 0;
    let hasCostData = false;
    let totalCostUsd = 0;

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
        uniqueLeadsSet.add(c.leadId);

        if (c.isPickedUp) {
            callsPickedUp++;
        } else {
            callsMissed++;
        }

        if (c.sentiment === 'positive') positiveSentimentCalls++;
        else if (c.sentiment === 'negative') negativeSentimentCalls++;
        else if (c.sentiment === 'neutral') neutralSentimentCalls++;

        totalDurationSeconds += c.durationSeconds;
        if (c.costUsd !== null && c.costUsd !== undefined) {
            hasCostData = true;
            totalCostUsd += c.costUsd;
        }

        // Campaign breakdown
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
        campaignMap[cKey].leadsSet.add(c.leadId);
        if (c.isPickedUp) campaignMap[cKey].pickedUpCalls++;
        if (c.sentiment === 'positive') campaignMap[cKey].positiveCalls++;
        campaignMap[cKey].totalDurationSeconds += c.durationSeconds;

        // Call number breakdown
        if (callNumberMap[c.callNumber]) {
            callNumberMap[c.callNumber].count++;
            if (c.isPickedUp) callNumberMap[c.callNumber].pickedUp++;
            if (c.sentiment === 'positive') callNumberMap[c.callNumber].positive++;
        }

        // Daily trend
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
        campaignBreakdown,
        callNumberBreakdown,
        dailyVolume,
        hourlyDistribution,
    };
}

/** Fetches paginated campaign voice call logs */
export async function getCampaignVoiceCallLogs(filters: CampaignVoiceFilterParams = {}) {
    const allCalls = await getAllCampaignVoiceCalls();
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

/** Fetches cold call logs from twilio_call_logs associated with campaign leads */
export async function getCampaignVoiceColdCalls(filters: CampaignVoiceFilterParams = {}) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 15;

    // 1. Fetch twilio_call_logs with date filtering if present
    let query = supabaseAdmin
        .from('twilio_call_logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.from) {
        const fromDate = new Date(filters.from);
        query = query.gte('created_at', fromDate.toISOString());
    }
    if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setUTCHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
    }
    query = query.limit(1000);

    const { data: twilioRows, error: twilioErr } = await query;
    if (twilioErr) {
        console.error('[campaign-voice] twilio_call_logs fetch error:', twilioErr);
        throw new Error(twilioErr.message || 'Failed to fetch twilio_call_logs');
    }

    // 2. Fetch outreach_leads to match phone numbers
    const { data: leadRows } = await supabaseAdmin
        .from('outreach_leads')
        .select('id, full_name, first_name, last_name, mobile_number, mobile_number_2, company_phone, campaign_id, campaign_key');

    // Index outreach_leads by 10-digit phone, detecting duplicates across leads
    const phoneToLeadsMap = new Map<string, any[]>();
    (leadRows || []).forEach(l => {
        [l.mobile_number, l.mobile_number_2, l.company_phone].forEach(p => {
            if (!p) return;
            const digits = String(p).replace(/\D/g, '').slice(-10);
            if (digits.length >= 7) {
                const list = phoneToLeadsMap.get(digits) || [];
                if (!list.some(existing => existing.id === l.id)) {
                    list.push(l);
                }
                phoneToLeadsMap.set(digits, list);
            }
        });
    });

    const mapped: CampaignVoiceColdCall[] = (twilioRows || []).map(row => {
        const toDigits = String(row.to_number || '').replace(/\D/g, '').slice(-10);
        const fromDigits = String(row.from_number || '').replace(/\D/g, '').slice(-10);

        const toCandidates = toDigits ? (phoneToLeadsMap.get(toDigits) || []) : [];
        const fromCandidates = fromDigits ? (phoneToLeadsMap.get(fromDigits) || []) : [];
        const candidates = toCandidates.length > 0 ? toCandidates : fromCandidates;

        let matchedLead: any = null;
        let isAmbiguous = false;

        if (candidates.length === 1) {
            matchedLead = candidates[0];
        } else if (candidates.length > 1) {
            isAmbiguous = true;
        }

        let campaignId: number | null = null;
        let campaignKey: string | null = null;
        let campaignName = isAmbiguous
            ? 'Unattributed (Ambiguous Phone Match)'
            : 'Unattributed / Direct Dialer';
        let color: CampaignColor | 'slate' = 'slate';
        let isAttributed = false;

        if (matchedLead && !isAmbiguous) {
            isAttributed = true;
            const rawId = matchedLead.campaign_id !== undefined && matchedLead.campaign_id !== null ? Number(matchedLead.campaign_id) : null;
            const resolved = resolveCampaignInfo(rawId, matchedLead.campaign_key || null);
            campaignId = resolved.campaignId;
            campaignKey = resolved.campaignKey;
            campaignName = resolved.campaignName;
            color = resolved.color;
        }

        const leadName = matchedLead && !isAmbiguous
            ? (matchedLead.full_name || [matchedLead.first_name, matchedLead.last_name].filter(Boolean).join(' ') || 'Campaign Contact')
            : (isAmbiguous ? 'Unattributed (Ambiguous Phone Match)' : 'Unattributed Contact');

        return {
            id: row.call_sid || String(row.id),
            callSid: row.call_sid,
            from: row.from_number || '—',
            to: row.to_number || '—',
            direction: row.direction || 'outbound',
            status: row.status || 'unknown',
            durationSeconds: row.duration_seconds || 0,
            recordingUrl: row.recording_url || null,
            transcript: row.transcription_text || null,
            transcriptionStatus: row.transcription_status || null,
            startedAt: row.started_at || null,
            createdAt: row.created_at || null,
            leadId: matchedLead && !isAmbiguous ? matchedLead.id : null,
            leadName,
            campaignId,
            campaignKey,
            campaignName,
            campaignColor: color,
            isAttributed,
        };
    });

    // Apply filtering
    let filtered = mapped.filter(c => {
        // Campaign filter
        if (filters.campaignIds && filters.campaignIds.length > 0) {
            const cId = c.campaignId !== null && c.campaignId !== undefined ? String(c.campaignId) : 'unattributed';
            const cKey = (c.campaignKey || '').toLowerCase();
            const matches = filters.campaignIds.some(fId => {
                const f = fId.trim().toLowerCase();
                return f === cId.toLowerCase() || f === cKey || (f === 'unattributed' && !c.isAttributed);
            });
            if (!matches) return false;
        }

        // Search filter
        if (filters.search && filters.search.trim()) {
            const q = filters.search.trim().toLowerCase();
            const digits = q.replace(/\D/g, '');
            const textMatch =
                c.leadName.toLowerCase().includes(q) ||
                c.from.toLowerCase().includes(q) ||
                c.to.toLowerCase().includes(q) ||
                (c.transcript && c.transcript.toLowerCase().includes(q)) ||
                c.status.toLowerCase().includes(q);
            const digitsMatch = digits && (c.to.replace(/\D/g, '').includes(digits) || c.from.replace(/\D/g, '').includes(digits));
            if (!textMatch && !digitsMatch) return false;
        }

        // Status filter
        if (filters.status && filters.status !== 'all') {
            if (c.status.toLowerCase() !== filters.status.toLowerCase()) return false;
        }

        // Date range
        if (!filters.from && !filters.to) return true;
        const time = parseSafeTimestamp(c.createdAt || c.startedAt);
        if (!time) return false;
        if (filters.from && time < parseSafeTimestamp(filters.from, false)) return false;
        if (filters.to && time > parseSafeTimestamp(filters.to, true)) return false;

        return true;
    });

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

/** Fetches Analytics data for Campaign Voice */
export async function getCampaignVoiceAnalytics(filters: CampaignVoiceFilterParams = {}) {
    const overview = await getCampaignVoiceOverview(filters);
    const allCalls = await getAllCampaignVoiceCalls();
    const filtered = filterCampaignVoiceCalls(allCalls, filters);

    // Sentiment breakdown
    const sentimentDistribution = [
        { name: 'Positive', count: overview.positiveSentimentCalls, color: 'text-emerald-600 bg-emerald-50' },
        { name: 'Neutral', count: overview.neutralSentimentCalls, color: 'text-slate-600 bg-slate-50' },
        { name: 'Negative', count: overview.negativeSentimentCalls, color: 'text-rose-600 bg-rose-50' },
    ];

    // Outcome breakdown (Interested, Callback, No Answer, etc.)
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

