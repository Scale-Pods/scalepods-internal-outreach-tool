// LinkedIn outreach data source — reads directly from a public Google Sheet
// (no service account needed; the sheet is shared as "Anyone with the link can view").
// Each tab is fetched via the Google Visualization "gviz" CSV export endpoint.

const SHEET_ID = process.env.LINKEDIN_SHEET_ID || '1JYPKybN07Ee41-LpQzIj6axwHj5MmWKeLhX_pLYoQfk';

// The sheet now splits Leads and Conversations into batches:
// - "Leads" / "Old Conversations" (Old batch)
// - "New Leads" / "New Conversations" (New batch)
// - "New Leads_1" / "New Conversations_1" (New_1 batch)
// Quota Tracker is unchanged.
const OLD_LEADS_SHEET_NAME = 'Leads';
const NEW_LEADS_SHEET_NAME = 'New Leads';
const NEW_LEADS_1_SHEET_NAME = 'New Leads_1';
const OLD_CONVERSATIONS_SHEET_NAME = 'Old Conversations';
const NEW_CONVERSATIONS_SHEET_NAME = 'New Conversations';
const NEW_CONVERSATIONS_1_SHEET_NAME = 'New Conversations_1';
const QUOTA_SHEET_NAME = 'Quota Tracker';

export type DataBatch = 'old' | 'new' | 'new_1';

// Known LinkedIn sender accounts (Account ID -> display name), shared across
// Dashboard / Chat / Leads / Analytics so every page bifurcates data the same way.
export interface LinkedInAccount {
    accountId: string; // primary / canonical ID
    accountIds: string[]; // all associated IDs including historical rotations
    name: string;
    color: string; // tailwind color token, e.g. "blue"
}

export const LINKEDIN_ACCOUNTS: LinkedInAccount[] = [
    {
        accountId: 'THgf5G4aQ_6ySkG97g3-UA',
        accountIds: ['THgf5G4aQ_6ySkG97g3-UA', 'z7ijp3_8QGSei2SxwwrekQ'],
        name: 'Adnan Shaikh',
        color: 'blue',
    },
    {
        accountId: 'skWloOywQJeCP9Ys3eXt9g',
        accountIds: ['skWloOywQJeCP9Ys3eXt9g'],
        name: 'Vishnu Girish',
        color: 'violet',
    },
    {
        accountId: '9SwCve6hQDGCULIufHvCZQ',
        accountIds: ['9SwCve6hQDGCULIufHvCZQ'],
        name: 'Raunak Kumar',
        color: 'emerald',
    },
];

const UNKNOWN_ACCOUNT_COLOR = 'slate';

export function getAccountMeta(accountId: string | null | undefined): { name: string; color: string; canonicalId?: string } {
    const id = (accountId || '').trim();
    if (!id) return { name: 'Unassigned', color: UNKNOWN_ACCOUNT_COLOR };
    const known = LINKEDIN_ACCOUNTS.find(a => a.accountIds.includes(id) || a.accountId === id);
    if (known) return { name: known.name, color: known.color, canonicalId: known.accountId };
    return { name: id, color: UNKNOWN_ACCOUNT_COLOR };
}

export function isAccountMatch(account: LinkedInAccount, accountId: string | null | undefined): boolean {
    const id = (accountId || '').trim();
    if (!id) return false;
    return account.accountIds.includes(id) || account.accountId === id;
}

/**
 * Checks if a given date string or Date falls within [from, to] (inclusive).
 * Safely parses ISO timestamp strings, date-time strings, and 'YYYY-MM-DD' dates.
 * If both from and to are undefined/null, returns true (no filter active).
 * If dateVal is empty/null/undefined, returns false when a filter range is active.
 */
export function isDateInRange(
    dateVal: string | Date | null | undefined,
    from?: Date | null,
    to?: Date | null
): boolean {
    if (!from && !to) return true;
    if (!dateVal) return false;

    let time: number;
    if (dateVal instanceof Date) {
        time = dateVal.getTime();
    } else {
        const s = String(dateVal).trim();
        if (!s) return false;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, d] = s.split('-').map(Number);
            time = new Date(y, m - 1, d, 12, 0, 0).getTime();
        } else {
            time = new Date(s).getTime();
        }
    }

    if (isNaN(time)) return false;

    if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (time < start.getTime()) return false;
    }

    if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (time > end.getTime()) return false;
    }

    return true;
}

export interface LinkedInLead {
    batch: DataBatch;
    fullName: string;
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
    replyText: string;
}

export interface LinkedInMessage {
    batch: DataBatch;
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
    'Full Name': 'fullName',
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
    'Reply Text': 'replyText',
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
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            console.warn(`[LinkedIn Sheets] Failed to fetch "${sheetName}" sheet (${res.status}). Returning empty rows.`);
            return [];
        }
        const text = await res.text();
        return parseCsv(text);
    } catch (err: any) {
        console.error(`[LinkedIn Sheets] Network or fetch error for "${sheetName}":`, err?.message || err);
        return [];
    }
}

function rowsToObjects<T>(rows: string[][], columnMap: Record<string, keyof T>, batch?: DataBatch): T[] {
    if (rows.length === 0) return [];
    const header = rows[0];
    const indexMap: Partial<Record<keyof T, number>> = {};
    header.forEach((col, idx) => {
        const key = columnMap[col.trim()];
        if (key) indexMap[key] = idx;
    });

    return rows.slice(1).map(row => {
        const obj: any = batch ? { batch } : {};
        for (const key of Object.keys(columnMap) as (keyof typeof columnMap)[]) {
            const mappedKey = columnMap[key];
            const idx = indexMap[mappedKey];
            obj[mappedKey] = (idx !== undefined && row && row[idx] !== undefined && row[idx] !== null) ? String(row[idx]).trim() : '';
        }
        return obj as T;
    });
}

/** Fetches "Leads" (old), "New Leads" (new), and "New Leads_1" (new_1) tabs and merges them, each row tagged with its batch. */
export async function getLinkedInLeads(): Promise<LinkedInLead[]> {
    const [oldRows, newRows, new1Rows] = await Promise.all([
        fetchSheetRows(OLD_LEADS_SHEET_NAME),
        fetchSheetRows(NEW_LEADS_SHEET_NAME),
        fetchSheetRows(NEW_LEADS_1_SHEET_NAME),
    ]);
    return [
        ...rowsToObjects<LinkedInLead>(oldRows, LEADS_COLUMNS, 'old'),
        ...rowsToObjects<LinkedInLead>(newRows, LEADS_COLUMNS, 'new'),
        ...rowsToObjects<LinkedInLead>(new1Rows, LEADS_COLUMNS, 'new_1'),
    ];
}

/** Fetches "Old Conversations", "New Conversations", and "New Conversations_1" tabs and merges them, each row tagged with its batch. */
export async function getLinkedInConversations(): Promise<LinkedInMessage[]> {
    const [oldRows, newRows, new1Rows] = await Promise.all([
        fetchSheetRows(OLD_CONVERSATIONS_SHEET_NAME),
        fetchSheetRows(NEW_CONVERSATIONS_SHEET_NAME),
        fetchSheetRows(NEW_CONVERSATIONS_1_SHEET_NAME),
    ]);
    return [
        ...rowsToObjects<LinkedInMessage>(oldRows, CONVERSATIONS_COLUMNS, 'old'),
        ...rowsToObjects<LinkedInMessage>(newRows, CONVERSATIONS_COLUMNS, 'new'),
        ...rowsToObjects<LinkedInMessage>(new1Rows, CONVERSATIONS_COLUMNS, 'new_1'),
    ];
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
    batch: DataBatch;
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
        const key = `${msg.batch}:${msg.chatId || msg.personId}`;
        if (!msg.chatId && !msg.personId) continue;
        let thread = threads.get(key);
        if (!thread) {
            const lead = leadsByPersonId.get(msg.personId) || null;
            thread = {
                batch: msg.batch,
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
        thread.messages.sort((a, b) => {
            const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
            const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
            return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
        });
        const last = thread.messages[thread.messages.length - 1];
        thread.lastMessageAt = last?.sentAt || null;
    }

    return Array.from(threads.values()).sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    });
}
