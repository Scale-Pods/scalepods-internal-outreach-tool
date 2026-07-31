export interface ConsolidatedLead {
    id: string;
    lead_id?: string;
    name: string;
    phone: string;
    email: string;
    replied: string;
    current_loop: string;
    source_loop: string;
    stages_passed: string[];
    stage_data: Record<string, any>; // Stores raw column values for each stage
    created_at: string;
    updated_at: string;
    last_contacted?: string;
    sender_email?: string;
    dropped?: string | boolean;
    collapsed_date?: string;
    email_replied?: string;
    whatsapp_replied?: string;
    "W.P_1 TS"?: string;
    "W.P_2 TS"?: string;
    unsubscribed?: string;
    [key: string]: any;
}

function getVal(obj: any, keys: string[]) {
    if (!obj) return undefined;
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    const normalizedTargetKeys = keys.map(k => k.toLowerCase().replace(/[\s._-]/g, ''));
    for (const actualKey in obj) {
        const normalizedActual = actualKey.toLowerCase().replace(/[\s._-]/g, '');
        if (normalizedTargetKeys.includes(normalizedActual)) {
            return obj[actualKey];
        }
    }
    return undefined;
}

/** Parse a wa_conversation JSONB value into an array of conversation messages */
export function parseWaConversation(raw: any): any[] {
    if (!raw) return [];
    let arr = raw;
    if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return arr;
}

/** Parse status strings like "Delivered - 2026-03-12 10:00:00" or "read" into a Date (or null) */
export function parseStatusDate(tsRaw: string | null): Date | null {
    if (!tsRaw) return null;
    const content = String(tsRaw).trim();
    if (!content) return null;

    // Try the whole string as an ISO/timestamp first
    const whole = new Date(content.replace(' ', 'T'));
    if (!isNaN(whole.getTime())) return whole;

    // Split "Delivered - 2026-03-12 10:00:00"
    const parts = content.split(' - ');
    if (parts.length >= 2) {
        const datePart = parts[parts.length - 1].trim();
        const d = new Date(datePart.replace(/(^\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$2-$1').replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
    }

    // Trailing ISO timestamp embedded in content
    const isoMatch = content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
    if (isoMatch) {
        const d = new Date(isoMatch[1]);
        if (!isNaN(d.getTime())) return d;
    }

    return null;
}

/** Resolve the best available "Whatsapp Last Contacted" date for a lead */
export function getWhatsappLastContacted(lead: any): string | null {
    if (!lead) return null;

    const direct = lead["Whatsapp Last Contacted"] || lead["whatsapp_last_contacted"];
    const directDate = parseStatusDate(direct || null);
    if (directDate) return directDate.toISOString();

    // wa_conversation timestamps
    const conversation = parseWaConversation(lead.wa_conversation || lead["wa_conversation"]);
    let lastTs: string | null = null;
    for (const m of conversation) {
        const ts = m?.timestamp || m?.status_updated_at;
        if (ts && (!lastTs || new Date(ts).getTime() > new Date(lastTs).getTime())) lastTs = ts;
    }
    if (lastTs) {
        const d = new Date(lastTs);
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Latest status timestamp from Whatsapp_1..6 status columns
    for (let i = 6; i >= 1; i--) {
        const status = lead[`Whatsapp_${i}_status`] || lead[`whatsapp_${i}_status`] || lead[`Whatsapp_${i}_Status`];
        const d = parseStatusDate(status || null);
        if (d) return d.toISOString();
    }

    // Latest message content ISO timestamp
    for (let i = 6; i >= 1; i--) {
        const raw = lead[`Whatsapp_${i}`];
        if (raw) {
            const d = parseStatusDate(String(raw) || null);
            if (d) return d.toISOString();
        }
    }

    return lead.created_at || null;
}

export function consolidateLeads(data: any): ConsolidatedLead[] {
    const rawLeads = Array.isArray(data) ? data : (data?.leads || []);

    return rawLeads.map((l: any, idx: number) => {
        const stages: string[] = [];
        const stage_data: Record<string, any> = {};

        // Track source
        const _table = l._table || (l.full_name ? 'meta_lead_tracker' : 'icp_tracker');

        // 1. WhatsApp Stages (icp_tracker: Whatsapp_1, meta_lead_tracker: W.P_1)
        for (let i = 1; i <= 25; i++) {
            const keys = [`Whatsapp_${i}`, `W.P_${i}`, `WhatsApp ${i}`];
            const val = getVal(l, keys);
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                const stageKey = `WhatsApp ${i}`;
                stages.push(stageKey);
                stage_data[stageKey] = val;
            }
        }

        // 2. Email Stages (Email_1 to Email_6)
        for (let i = 1; i <= 6; i++) {
            const key = `Email_${i}`;
            const val = l[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                stages.push(key);
                stage_data[key] = val;
            }
        }

        // 3. Voice Stages
        for (let i = 1; i <= 3; i++) {
            const key = `Voice_${i}`;
            const val = l[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                stages.push(key);
                stage_data[key] = val;
            }
        }

        // 4. Common Fields
        const leadId = getVal(l, ["id", "Person ID", "Lead ID"]) || `lead-${idx}`;
        const name = String(getVal(l, ["Full Name", "full_name", "Name", "name"]) || "Unknown Lead");
        const email = String(getVal(l, ["Email", "email"]) || "No Email");
        const phone = String(getVal(l, ["Phone", "phone", "phone_number", "Phone Number", "whatsapp_number", "Company Phone Number"]) || "");

        // Replied logic (Meta uses WTS_Reply_Track or W.P_Replied_X)
        const emailReplied = l.email_replied || l.Email_Replied;
        const wpReplied = l.whatsapp_replied || l.WTS_Reply_Track;

        let hasReplied = (emailReplied && String(emailReplied).toLowerCase() !== 'no' && String(emailReplied).toLowerCase() !== 'none') ||
            (wpReplied && String(wpReplied).toLowerCase() !== 'no' && String(wpReplied).toLowerCase() !== 'none');

        if (!hasReplied) {
            for (let i = 1; i <= 25; i++) {
                const r = l[`W.P_Replied_${i}`] || l[`Whatsapp_${i}_replied`] || l[`User_Replied_${i}`];
                if (r && String(r).toLowerCase() !== 'no' && String(r).toLowerCase() !== 'none') {
                    hasReplied = true;
                    break;
                }
            }
        }

        return {
            ...l,
            id: String(leadId),
            lead_id: leadId,
            name,
            phone,
            email,
            replied: hasReplied ? "Yes" : "No",
            current_loop: l.current_loop || "Campaign",
            source_loop: l.source_loop || (l.ad_id ? 'Meta Ads' : 'Campaign'),
            stages_passed: stages,
            stage_data,
            created_at: l.created_at || new Date().toISOString(),
            updated_at: l.updated_at,
            last_contacted: getVal(l, ["Last Contacted", "whatsapp_last_contacted", "Email Last Contacted"]),
            _table
        };
    });
}

