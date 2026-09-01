import { supabaseAdmin } from '@/lib/supabase';

// ── shared constants ──────────────────────────────────────────────────────────

export const WA_STAGE_COUNT = 6;

export type LeadType = 'cold' | 'hot' | 'hubspot_wa';

export const COLD_TABLE = 'ENRICHED_LEADS';
export const HOT_TABLE = 'hubspot_lead';
export const HUBSPOT_WA_TABLE = 'hubspot_wa_outreach';

// ── row shape (matches the jsonb shape returned by get_wa_leads) ────────────

export interface WaStageValue {
    stage: number;
    content: string | null;
    status: string | null;
}

export interface ConversationMessage {
    id?: string;
    role: 'user' | 'bot' | string;
    type?: string;
    message: string;
    direction: 'inbound' | 'outbound' | string;
    timestamp: string | null;
    status?: string | null;
    status_updated_at?: string | null;
    error?: string | null;
}

export interface NormalizedWaLead {
    id: string;
    table: string;
    leadType: LeadType;
    fullName: string;
    phone: string;
    lastContacted: string | null;
    createdAt: string | null;
    lifecycleStage: string | null;
    leadClassification: string | null;
    leadClassificationReason: string | null;
    stages: WaStageValue[];
    conversation: ConversationMessage[];
    raw: any;
}

function truthyText(val: any): boolean {
    if (val === null || val === undefined) return false;
    const s = String(val).trim().toLowerCase();
    return s !== '' && s !== 'no' && s !== 'none' && s !== 'false' && s !== '0';
}

/** Parse a wa_conversation jsonb value (object/array or JSON-encoded string) into a message array */
export function parseWaConversation(raw: any): ConversationMessage[] {
    if (!raw) return [];
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr.filter(m => m && typeof m === 'object');
}

/** Parse status strings like "Delivered - 2026-03-12 10:00:00" or plain ISO into a Date (or null) */
function parseStatusDate(tsRaw: any): Date | null {
    if (!tsRaw) return null;
    const content = String(tsRaw).trim();
    if (!content) return null;

    const whole = new Date(content.replace(' ', 'T'));
    if (!isNaN(whole.getTime())) return whole;

    const parts = content.split(' - ');
    if (parts.length >= 2) {
        const datePart = parts[parts.length - 1].trim();
        const d = new Date(datePart.replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
    }

    const isoMatch = content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
    if (isoMatch) {
        const d = new Date(isoMatch[1]);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

/** Resolve the best "last contacted" timestamp for a lead */
export function getWaLastContacted(lead: NormalizedWaLead): string | null {
    const direct = lead.raw['Whatsapp Last Contacted'] || lead.raw['whatsapp_last_contacted'] || lead.lastContacted;
    const directDate = parseStatusDate(direct);
    if (directDate) return directDate.toISOString();

    let lastTs: string | null = null;
    for (const m of lead.conversation) {
        const ts = m.timestamp || m.status_updated_at;
        if (ts && (!lastTs || new Date(ts).getTime() > new Date(lastTs).getTime())) lastTs = ts;
    }
    if (lastTs) {
        const d = new Date(lastTs);
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    for (let i = WA_STAGE_COUNT; i >= 1; i--) {
        const d = parseStatusDate(lead.stages[i - 1]?.status);
        if (d) return d.toISOString();
    }

    return lead.createdAt;
}

// ── fetch: full lead rows across the 3 tables, via get_wa_leads RPC ─────────
// stages/conversation are built server-side in Postgres (see
// supabase/migrations/add_wa_outreach_leads.sql) — this is now a thin
// batched-pagination wrapper around the RPC.

const RPC_BATCH_SIZE = 1000;
const RPC_MAX_ROWS = 20000;

export async function fetchWaLeads(leadType?: LeadType): Promise<NormalizedWaLead[]> {
    const allRows: NormalizedWaLead[] = [];
    let offset = 0;

    try {
        while (offset < RPC_MAX_ROWS) {
            const { data, error } = await supabaseAdmin.rpc('get_wa_leads', {
                p_lead_type: leadType ?? null,
                p_limit: RPC_BATCH_SIZE,
                p_offset: offset,
            });

            if (error) {
                console.error('[whatsapp-outreach] get_wa_leads RPC error:', error.message);
                break;
            }
            if (!data || data.length === 0) break;

            data.forEach((row: any) => {
                allRows.push({
                    ...row,
                    conversation: parseWaConversation(row.conversation),
                    raw: row.raw || {},
                });
            });
            offset += RPC_BATCH_SIZE;

            if (data.length < RPC_BATCH_SIZE) break;
        }
    } catch (e: any) {
        console.error('[whatsapp-outreach] get_wa_leads exception:', e?.message || e);
    }

    return allRows;
}

/** Does this lead have any WhatsApp activity at all (sent or received)? */
export function hasWaActivity(lead: NormalizedWaLead): boolean {
    if (lead.stages.some(s => truthyText(s.content))) return true;
    if (lead.conversation.length > 0) return true;
    return false;
}

/** Count of outbound (bot) messages — Whatsapp_1-6 drip stages + outbound wa_conversation entries */
export function countSentMessages(lead: NormalizedWaLead): number {
    let count = lead.stages.filter(s => truthyText(s.content)).length;
    count += lead.conversation.filter(m => m.role === 'bot' || m.direction === 'outbound').length;
    return count;
}

/** Has the lead replied (inbound message from the user in wa_conversation)? */
export function hasReplied(lead: NormalizedWaLead): boolean {
    return lead.conversation.some(m => m.role === 'user' || m.direction === 'inbound');
}

function inRange(dateStr: string | null, from: Date, to: Date): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    return d >= from && d <= to;
}

// ── aggregated metrics ────────────────────────────────────────────────────────

export interface WaMetrics {
    totalLeads: number;
    contactedLeads: number;
    messagesSent: number;
    botMessages: number;
    stageSentCounts: number[]; // length 6
    repliedLeads: number;
    totalReplies: number;
    failedMessages: number;
    replyRate: number;
}

// Client-side JS aggregation over already-fetched leads — kept for callers
// that have a NormalizedWaLead[] in hand already. For a fresh from/to
// query, prefer getWaOutreachMetricsRpc() below, which computes this
// server-side in a single round trip.
export function computeWaMetrics(leads: NormalizedWaLead[], from: Date, to: Date): WaMetrics {
    const stageSentCounts = new Array(WA_STAGE_COUNT).fill(0);
    let contactedLeads = 0;
    let messagesSent = 0;
    let botMessages = 0;
    let repliedLeads = 0;
    let totalReplies = 0;
    let failedMessages = 0;

    const inScope = leads.filter(l => inRange(getWaLastContacted(l) || l.createdAt, from, to));

    inScope.forEach(lead => {
        const sentStages = lead.stages.filter(s => truthyText(s.content));
        const outboundConv = lead.conversation.filter(m => m.role === 'bot' || m.direction === 'outbound');
        const leadSent = sentStages.length + outboundConv.length;

        if (leadSent > 0) {
            contactedLeads++;
            messagesSent += leadSent;
            botMessages += leadSent;
            sentStages.forEach(s => stageSentCounts[s.stage - 1]++);
        }

        sentStages.forEach(s => {
            if ((s.status || '').toLowerCase().includes('failed')) failedMessages++;
        });
        outboundConv.forEach(m => {
            if ((m.status || m.status_updated_at || '').toString().toLowerCase().includes('failed') || m.error) failedMessages++;
        });

        if (hasReplied(lead)) {
            repliedLeads++;
            totalReplies += Math.max(lead.conversation.filter(m => m.role === 'user' || m.direction === 'inbound').length, 1);
        }
    });

    return {
        totalLeads: inScope.length,
        contactedLeads,
        messagesSent,
        botMessages,
        stageSentCounts,
        repliedLeads,
        totalReplies,
        failedMessages,
        replyRate: contactedLeads > 0 ? (repliedLeads / contactedLeads) * 100 : 0,
    };
}

// Server-side metrics via get_wa_outreach_metrics RPC.
export async function getWaOutreachMetricsRpc(
    fromIso: string,
    toIso: string,
    leadType: LeadType
): Promise<WaMetrics> {
    const { data, error } = await supabaseAdmin.rpc('get_wa_outreach_metrics', {
        p_from: fromIso,
        p_to: toIso,
        p_lead_type: leadType,
    });

    if (error) {
        console.error('[whatsapp-outreach] get_wa_outreach_metrics RPC error:', error.message);
        return {
            totalLeads: 0, contactedLeads: 0, messagesSent: 0, botMessages: 0,
            stageSentCounts: [0, 0, 0, 0, 0, 0],
            repliedLeads: 0, totalReplies: 0, failedMessages: 0, replyRate: 0,
        };
    }

    const row = data?.[0] || {};
    return {
        totalLeads: row.total_leads || 0,
        contactedLeads: row.contacted_leads || 0,
        messagesSent: row.messages_sent || 0,
        botMessages: row.messages_sent || 0, // RPC doesn't split bot vs total — same value in the old JS too (botMessages += leadSent, identical to messagesSent)
        stageSentCounts: [
            row.stage_1_sent || 0, row.stage_2_sent || 0, row.stage_3_sent || 0,
            row.stage_4_sent || 0, row.stage_5_sent || 0, row.stage_6_sent || 0,
        ],
        repliedLeads: row.replied_leads || 0,
        totalReplies: row.replied_leads || 0, // RPC counts replied leads, not raw reply-message count — see get_email_outreach_metrics's identical note
        failedMessages: row.failed_messages || 0,
        replyRate: row.reply_rate || 0,
    };
}

export async function getWaDashboardData(from: Date, to: Date) {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const [cold, hot, hubspotWa] = await Promise.all([
        getWaOutreachMetricsRpc(fromIso, toIso, 'cold'),
        getWaOutreachMetricsRpc(fromIso, toIso, 'hot'),
        getWaOutreachMetricsRpc(fromIso, toIso, 'hubspot_wa'),
    ]);

    return { cold, hot, hubspotWa };
}

// ── unified conversation timeline (bot drips + wa_conversation, chronological) ──

export interface TimelineEntry {
    type: 'bot' | 'user';
    label: string;
    content: string;
    date: string | null;
    status?: string | null;
    sequence: number;
}

export function buildConversationTimeline(lead: NormalizedWaLead): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];
    let seq = 1;

    // 1. Bot drip messages: Whatsapp_1..6 (the initial outbound templates)
    const stageContents = new Set<string>();
    lead.stages.forEach(s => {
        if (!truthyText(s.content)) return;
        const trimmed = String(s.content).trim();
        stageContents.add(trimmed);
        const d = parseStatusDate(s.status);
        timeline.push({
            type: 'bot',
            label: `Whatsapp ${s.stage}`,
            content: trimmed,
            date: d ? d.toISOString() : null,
            status: s.status,
            sequence: seq++,
        });
    });

    // 2. Full wa_conversation exchange (chronological) — this is where the
    // real back-and-forth conversation lives once the lead starts replying.
    // Skip any outbound message that just repeats a Whatsapp_N template
    // (the drip send and its wa_conversation echo are the same message).
    const sorted = [...lead.conversation].sort(
        (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
    sorted.forEach(m => {
        const content = m.message || '';
        if (!content || !String(content).trim()) return;
        const trimmed = String(content).trim();
        const isUser = m.role === 'user' || m.direction === 'inbound';
        if (!isUser && stageContents.has(trimmed)) return;
        timeline.push({
            type: isUser ? 'user' : 'bot',
            label: isUser ? 'User Reply' : 'Bot Reply',
            content: trimmed,
            date: m.timestamp || m.status_updated_at || null,
            status: isUser ? null : (m.status || m.status_updated_at || null),
            sequence: seq++,
        });
    });

    return timeline;
}
