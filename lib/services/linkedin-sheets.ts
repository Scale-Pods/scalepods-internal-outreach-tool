// LinkedIn outreach data source — reads directly from a public Google Sheet
// (no service account needed; the sheet is shared as "Anyone with the link can view").
// Each tab is fetched via the Google Visualization "gviz" CSV export endpoint.

const SHEET_ID = process.env.LINKEDIN_SHEET_ID || '1JYPKybN07Ee41-LpQzIj6axwHj5MmWKeLhX_pLYoQfk';

const LEADS_SHEET_NAME = 'Leads';
const CONVERSATIONS_SHEET_NAME = 'Conversations';
const QUOTA_SHEET_NAME = 'Quota Tracker';

// Known LinkedIn sender accounts (Account ID -> display name), shared across
// Dashboard / Chat / Leads / Analytics so every page bifurcates data the same way.
export interface LinkedInAccount {
    accountId: string;
    name: string;
    color: string; // tailwind color token, e.g. "blue"
}

export const LINKEDIN_ACCOUNTS: LinkedInAccount[] = [
    { accountId: 'THgf5G4aQ_6ySkG97g3-UA', name: 'Adnan Shaikh', color: 'blue' },
    { accountId: 'skWloOywQJeCP9Ys3eXt9g', name: 'Vishnu Girish', color: 'violet' },
    { accountId: '9SwCve6hQDGCULIufHvCZQ', name: 'Raunak Kumar', color: 'emerald' },
];

const UNKNOWN_ACCOUNT_COLOR = 'slate';

export function getAccountMeta(accountId: string | null | undefined): { name: string; color: string } {
    const id = (accountId || '').trim();
    if (!id) return { name: 'Unassigned', color: UNKNOWN_ACCOUNT_COLOR };
    const known = LINKEDIN_ACCOUNTS.find(a => a.accountId === id);
    if (known) return { name: known.name, color: known.color };
    return { name: id, color: UNKNOWN_ACCOUNT_COLOR };
}

export interface LinkedInLead {
    companyName: string;
    companyWebsite: string;
    email: string;
    linkedIn: string;
    title: string;
    city: string;
    state: string;
    country: string;
    personId: string;
    companyPhoneNumber: string;
    providerId: string;
    accountId: string;
    status: string;
    connectionStatus: string;
    sequenceStep: string;
    nextActionDue: string;
    lastActionSentAt: string;
}

export interface LinkedInMessage {
    personId: string;
    providerId: string;
    message: string;
    sentAt: string;
    object: string;
    messageId: string;
    chatId: string;
}

export interface LinkedInQuota {
    accountId: string;
    date: string;
    dailyCap: number;
    sentCount: number;
    remainingQuota: number;
    lastSentAt: string;
    object: string;
    invitationId: string;
}

const LEADS_COLUMNS: Record<string, keyof LinkedInLead> = {
    'Company Name': 'companyName',
    'Company Website': 'companyWebsite',
    'Email': 'email',
    'LinkedIn': 'linkedIn',
    'Title': 'title',
    'City': 'city',
    'State': 'state',
    'Country': 'country',
    'Person ID': 'personId',
    'Company Phone Number': 'companyPhoneNumber',
    'Provider ID': 'providerId',
    'Account ID': 'accountId',
    'Status': 'status',
    'Connection Status': 'connectionStatus',
    'Sequence Step': 'sequenceStep',
    'Next Action Due': 'nextActionDue',
    'Last Action Sent At': 'lastActionSentAt',
};

const CONVERSATIONS_COLUMNS: Record<string, keyof LinkedInMessage> = {
    'Person ID': 'personId',
    'Provider ID': 'providerId',
    'Message': 'message',
    'Sent At / Timestamp': 'sentAt',
    'object': 'object',
    'message_id': 'messageId',
    'chat_id': 'chatId',
};

const QUOTA_COLUMNS: Record<string, keyof LinkedInQuota> = {
    'Account ID': 'accountId',
    'Date': 'date',
    'Daily Cap': 'dailyCap',
    'Sent Count': 'sentCount',
    'Remaining Quota': 'remainingQuota',
    'Last Sent At': 'lastSentAt',
    'object': 'object',
    'invitation_id': 'invitationId',
};

/** Minimal CSV parser that handles quoted fields, embedded commas/newlines and "" escapes. */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += c;
            }
            continue;
        }

        if (c === '"') { inQuotes = true; continue; }
        if (c === ',') { row.push(field); field = ''; continue; }
        if (c === '\r') continue;
        if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        field += c;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

async function fetchSheetRows(sheetName: string): Promise<string[][]> {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to fetch "${sheetName}" sheet (${res.status}). Make sure it is shared as "Anyone with the link can view".`);
    }
    const text = await res.text();
    return parseCsv(text);
}

function rowsToObjects<T>(rows: string[][], columnMap: Record<string, keyof T>): T[] {
    if (rows.length === 0) return [];
    const header = rows[0];
    const indexMap: Partial<Record<keyof T, number>> = {};
    header.forEach((col, idx) => {
        const key = columnMap[col.trim()];
        if (key) indexMap[key] = idx;
    });

    return rows.slice(1).map(row => {
        const obj: any = {};
        for (const key of Object.keys(columnMap) as (keyof typeof columnMap)[]) {
            const mappedKey = columnMap[key];
            const idx = indexMap[mappedKey];
            obj[mappedKey] = idx !== undefined ? (row[idx] ?? '').trim() : '';
        }
        return obj as T;
    });
}

export async function getLinkedInLeads(): Promise<LinkedInLead[]> {
    const rows = await fetchSheetRows(LEADS_SHEET_NAME);
    return rowsToObjects<LinkedInLead>(rows, LEADS_COLUMNS);
}

export async function getLinkedInConversations(): Promise<LinkedInMessage[]> {
    const rows = await fetchSheetRows(CONVERSATIONS_SHEET_NAME);
    return rowsToObjects<LinkedInMessage>(rows, CONVERSATIONS_COLUMNS);
}

export async function getLinkedInQuota(): Promise<LinkedInQuota[]> {
    const rows = await fetchSheetRows(QUOTA_SHEET_NAME);
    const objs = rowsToObjects<any>(rows, QUOTA_COLUMNS);
    return objs.map(o => ({
        ...o,
        dailyCap: Number(o.dailyCap) || 0,
        sentCount: Number(o.sentCount) || 0,
        remainingQuota: Number(o.remainingQuota) || 0,
    }));
}

export interface LinkedInConversationThread {
    chatId: string;
    personId: string;
    providerId: string;
    accountId: string;
    lead: LinkedInLead | null;
    messages: LinkedInMessage[];
    lastMessageAt: string | null;
}

/** Groups raw conversation messages into per-lead threads, joined against the leads list (which carries Account ID). */
export function buildConversationThreads(
    messages: LinkedInMessage[],
    leads: LinkedInLead[]
): LinkedInConversationThread[] {
    const leadsByPersonId = new Map(leads.map(l => [l.personId, l]));
    const threads = new Map<string, LinkedInConversationThread>();

    for (const msg of messages) {
        const key = msg.chatId || msg.personId;
        if (!key) continue;
        let thread = threads.get(key);
        if (!thread) {
            const lead = leadsByPersonId.get(msg.personId) || null;
            thread = {
                chatId: msg.chatId,
                personId: msg.personId,
                providerId: msg.providerId,
                accountId: lead?.accountId || '',
                lead,
                messages: [],
                lastMessageAt: null,
            };
            threads.set(key, thread);
        }
        thread.messages.push(msg);
    }

    for (const thread of threads.values()) {
        thread.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
        const last = thread.messages[thread.messages.length - 1];
        thread.lastMessageAt = last?.sentAt || null;
    }

    return Array.from(threads.values()).sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return dateB - dateA;
    });
}
