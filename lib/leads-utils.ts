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

