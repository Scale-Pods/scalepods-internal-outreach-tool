import { supabaseAdmin } from '@/lib/supabase';

// ── shared constants ──────────────────────────────────────────────────────────

export const WA_STAGE_COUNT = 6;

export type LeadType = 'cold' | 'hot' | 'hubspot_wa';

export const COLD_TABLE = 'ENRICHED_LEADS';
export const HOT_TABLE = 'hubspot_lead';
export const HUBSPOT_WA_TABLE = 'hubspot_wa_outreach';

// ── row shape ─────────────────────────────────────────────────────────────────

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
    const direct = lead.raw['Whatsapp Last Contacted'] || lead.raw['whatsapp_last_contacted'];
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

// ── column selections ─────────────────────────────────────────────────────────

// Whatsapp_1..5 are capitalized on both tables, but stage 6 is lowercase
// (whatsapp_6 / whatsapp_6_status) on ENRICHED_LEADS while hubspot_lead keeps it capitalized.
const WA_STAGE_COLS_1_5 = Array.from({ length: WA_STAGE_COUNT - 1 }, (_, i) => i + 1)
    .flatMap(i => [`"Whatsapp_${i}"`, `"Whatsapp_${i}_status"`])
    .join(', ');

const ENRICHED_LEADS_COLUMNS = `
    id, lead_uuid, full_name, "First Name", "Last Name", company_phone_number, personal_phone,
    "Whatsapp Last Contacted", wa_conversation, created_at,
    ${WA_STAGE_COLS_1_5}, whatsapp_6, whatsapp_6_status
`;

const HUBSPOT_LEAD_COLUMNS = `
    lead_id, full_name, "First Name", "Last Name", company_phone_number, personal_phone,
    "Whatsapp Last Contacted", lifecyclestage, wa_conversation, created_at,
    ${WA_STAGE_COLS_1_5}, "Whatsapp_6", "Whatsapp_6_status"
`;

// hubspot_wa_outreach only carries a single WhatsApp drip stage.
const HUBSPOT_WA_OUTREACH_COLUMNS = `
    lead_id, full_name, company_phone_number, lifecyclestage,
    "Whatsapp Last Contacted", "Whatsapp_1", "Whatsapp_1_status", wa_conversation,
    "Lead_Classification", "Lead_Classification_Reason", created_at
`;

async function fetchAll(tableName: string, columns: string, limit = 20000) {
    try {
        const { data, error } = await supabaseAdmin.from(tableName).select(columns).limit(limit);
        if (error) {
            console.error(`[whatsapp-outreach] fetch error for ${tableName}:`, error.message);
            return [];
        }
        return data || [];
    } catch (e: any) {
        console.error(`[whatsapp-outreach] fetch exception for ${tableName}:`, e.message);
        return [];
    }
}

// ── normalization ─────────────────────────────────────────────────────────────

export function normalizeWaRow(row: any, table: string, leadType: LeadType, stageCount: number = WA_STAGE_COUNT): NormalizedWaLead {
    const stages: WaStageValue[] = [];
    for (let i = 1; i <= stageCount; i++) {
        // Stage 6 is lowercase (whatsapp_6/whatsapp_6_status) on ENRICHED_LEADS.
        stages.push({
            stage: i,
            content: row[`Whatsapp_${i}`] ?? row[`whatsapp_${i}`] ?? null,
            status: row[`Whatsapp_${i}_status`] ?? row[`whatsapp_${i}_status`] ?? null,
        });
    }

    const conversation = parseWaConversation(row.wa_conversation);

    const id = String(row.lead_uuid || row.id || row.lead_id || row.company_phone_number || `${table}-${Math.random().toString(36).slice(2)}`);
    const fullName = String(
        row.full_name || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim() || 'Unknown Lead'
    );
    const phone = String(row.company_phone_number || row.personal_phone || '');

    return {
        id,
        table,
        leadType,
        fullName,
        phone,
        lastContacted: row['Whatsapp Last Contacted'] || null,
        createdAt: row.created_at || null,
        lifecycleStage: row.lifecyclestage || null,
        leadClassification: row['Lead_Classification'] || null,
        leadClassificationReason: row['Lead_Classification_Reason'] || null,
        stages,
        conversation,
        raw: row,
    };
}

export async function fetchWaLeads(): Promise<NormalizedWaLead[]> {
    const [enrichedRows, hubspotRows, hubspotWaRows] = await Promise.all([
        fetchAll(COLD_TABLE, ENRICHED_LEADS_COLUMNS),
        fetchAll(HOT_TABLE, HUBSPOT_LEAD_COLUMNS),
        fetchAll(HUBSPOT_WA_TABLE, HUBSPOT_WA_OUTREACH_COLUMNS),
    ]);

    return [
        ...enrichedRows.map((r: any) => normalizeWaRow(r, COLD_TABLE, 'cold')),
        ...hubspotRows.map((r: any) => normalizeWaRow(r, HOT_TABLE, 'hot')),
        ...hubspotWaRows.map((r: any) => normalizeWaRow(r, HUBSPOT_WA_TABLE, 'hubspot_wa', 1)),
    ];
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

export async function getWaDashboardData(from: Date, to: Date) {
    const allLeads = await fetchWaLeads();
    const coldLeads = allLeads.filter(l => l.leadType === 'cold' && hasWaActivity(l));
    const hotLeads = allLeads.filter(l => l.leadType === 'hot' && hasWaActivity(l));
    const hubspotWaLeads = allLeads.filter(l => l.leadType === 'hubspot_wa' && hasWaActivity(l));

    return {
        cold: computeWaMetrics(coldLeads, from, to),
        hot: computeWaMetrics(hotLeads, from, to),
        hubspotWa: computeWaMetrics(hubspotWaLeads, from, to),
    };
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
