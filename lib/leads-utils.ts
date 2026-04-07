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
    // If the input is { leads: [] } or just the array itself
    const rawLeads = Array.isArray(data) ? data : (data?.leads || []);
    
    return rawLeads.map((l: any, idx: number) => {
        const stages: string[] = [];
        const stage_data: Record<string, any> = {};

        // 1. Unified mapping for all 6 Email stages from icp_tracker
        for (let i = 1; i <= 6; i++) {
            const key = `Email_${i}`;
            const val = l[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                stages.push(key);
                stage_data[key] = val;
            }
        }

        // 2. WhatsApp stages from icp_tracker (1-5)
        for (let i = 1; i <= 5; i++) {
            const key = `Whatsapp_${i}`;
            const val = l[key];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                stages.push(key);
                stage_data[key] = val;
            }
        }

        // 3. Normalized values using getVal (to handle spaces and case differences)
        const leadId = getVal(l, ["id", "id", "Person ID", "Lead ID"]) || `lead-${idx}`;
        const name = String(getVal(l, ["Full Name", "Name"]) || "Unknown Lead");
        const email = String(getVal(l, ["Email"]) || "No Email");
        const phone = String(getVal(l, ["Phone", "Company Phone Number"]) || "");
        
        // Use "Email Last Contacted" for the main contacted field
        const lastContacted = getVal(l, ["Email Last Contacted", "Whatsapp Last Contacted", "Voice Last Contacted", "Last Contacted"]);
        
        // Use "SENDERS  EMAIL" (double space possibility handled via getVal normalization if needed)
        const sender = getVal(l, ["SENDERS  EMAIL", "Senders email", "Sender Email"]);
        
        // Replied/Unsubscribed
        const replied = String(getVal(l, ["Replied", "Email_Replied", "W.P_Replied"]) || "No");
        const unsubscribed = String(getVal(l, ["Unsubscribed"]) || "No");

        return {
            id: String(leadId),
            lead_id: leadId,
            name,
            phone,
            email,
            replied,
            current_loop: "Campaign",
            source_loop: "Campaign",
            stages_passed: stages,
            stage_data,
            created_at: getVal(l, ["created_at"]) || new Date().toISOString(),
            updated_at: getVal(l, ["updated_at"]),
            last_contacted: lastContacted,
            sender_email: sender,
            email_replied: replied,
            unsubscribed,
            ...l // spread original data for additional fields
        };
    });
}

