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
    {
        accountId: 'TzfoLZKqRmun89zQUVCSzw',
        accountIds: ['TzfoLZKqRmun89zQUVCSzw'],
        name: 'Divit Chandak',
        color: 'amber',
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
 * Extracts ISO timestamp string from a 64-bit snowflake ID (e.g. Unipile invitation_id).
 * The timestamp is stored in the higher 42 bits: ms = Number(BigInt(snowflakeId) >> 22n).
 */
export function extractSnowflakeDate(snowflakeId: string | null | undefined): string | null {
    if (!snowflakeId) return null;
    const s = String(snowflakeId).trim();
    if (!/^\d{16,21}$/.test(s)) return null;
    try {
        const ms = Number(BigInt(s) >> 22n);
        const d = new Date(ms);
        const yr = d.getUTCFullYear();
        if (yr >= 2020 && yr <= 2030) return d.toISOString();
    } catch {
        return null;
    }
    return null;
}

/**
 * Normalizes a date or date-string boundary.
 * For pure 'YYYY-MM-DD' dates or boundary dates without a specific time,
 * sets start dates to 00:00:00.000 and end dates to 23:59:59.999.
 */
export function normalizeDateBoundary(val: Date | string | null | undefined, isEnd = false): Date | null {
    if (!val) return null;
    let d: Date;
    if (val instanceof Date) {
        d = new Date(val.getTime());
    } else {
        const s = String(val).trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, dNum] = s.split('-').map(Number);
            return isEnd
                ? new Date(y, m - 1, dNum, 23, 59, 59, 999)
                : new Date(y, m - 1, dNum, 0, 0, 0, 0);
        }
        d = new Date(s);
    }
    if (isNaN(d.getTime())) return null;
    if (isEnd && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) {
        d.setHours(23, 59, 59, 999);
    }
    return d;
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

    if (from && time < from.getTime()) return false;
    if (to && time > to.getTime()) return false;

    return true;
}

/**
 * Checks if a lead falls within [from, to] (inclusive).
 * Matches if EITHER the outreach invitation was sent in that period (decoded from invitation_id),
 * OR a follow-up action / message was sent in that period (lastActionSentAt).
 * If both from and to are empty/null, returns true (no filter active).
 */
export function isLeadInDateRange(
    lead: LinkedInLead,
    from?: Date | null,
    to?: Date | null
): boolean {
    if (!from && !to) return true;
    return isDateInRange(lead.invitationSentAt, from, to) || isDateInRange(lead.lastActionSentAt, from, to);
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
    invitationId: string;
    invitationSentAt: string;
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
    'invitation_id': 'invitationId',
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

// Shared in-memory cache and in-flight de-duping stored on globalThis so that
// all Next.js API routes (/api/linkedin/dashboard, /api/linkedin/leads,
// /api/linkedin/conversations, /api/linkedin/quota) share the exact same parsed
// datasets without separate re-fetches from Google Sheets.
const SHEET_CACHE_TTL_MS = 180_000; // 3 minutes fresh
const STALE_MAX_AGE_MS = 900_000; // 15 minutes stale-while-revalidate

interface GlobalLinkedInServerCache {
    sheetCache: Map<string, { timestamp: number; rows: string[][] }>;
    sheetInFlight: Map<string, Promise<string[][]>>;
    parsedLeads?: { timestamp: number; data: LinkedInLead[] };
    parsedConversations?: { timestamp: number; data: LinkedInMessage[] };
    parsedQuota?: { timestamp: number; data: LinkedInQuota[] };
    parsedThreads?: { timestamp: number; data: LinkedInConversationThread[] };
}

const globalForLinkedIn = globalThis as unknown as {
    __linkedInServerCache?: GlobalLinkedInServerCache;
};

if (!globalForLinkedIn.__linkedInServerCache) {
    globalForLinkedIn.__linkedInServerCache = {
        sheetCache: new Map(),
        sheetInFlight: new Map(),
    };
}

const serverCache = globalForLinkedIn.__linkedInServerCache;

export function clearLinkedInCache() {
    serverCache.sheetCache.clear();
    serverCache.sheetInFlight.clear();
    delete serverCache.parsedLeads;
    delete serverCache.parsedConversations;
    delete serverCache.parsedQuota;
    delete serverCache.parsedThreads;
}

function triggerBackgroundFetch(sheetName: string) {
    executeSheetFetch(sheetName).catch((err) => {
        console.warn(`[LinkedIn Sheets] Background revalidation failed for "${sheetName}":`, err?.message || err);
    });
}

async function executeSheetFetch(sheetName: string): Promise<string[][]> {
    const existing = serverCache.sheetInFlight.get(sheetName);
    if (existing) return existing;

    const promise = (async () => {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) {
                const cached = serverCache.sheetCache.get(sheetName);
                console.warn(`[LinkedIn Sheets] Failed to fetch "${sheetName}" sheet (${res.status}).${cached ? ' Serving last known rows.' : ' Returning empty rows.'}`);
                return cached?.rows ?? [];
            }
            const text = await res.text();
            const rows = parseCsv(text);
            serverCache.sheetCache.set(sheetName, { timestamp: Date.now(), rows });
            return rows;
        } catch (err: any) {
            const cached = serverCache.sheetCache.get(sheetName);
            console.error(`[LinkedIn Sheets] Network or fetch error for "${sheetName}":`, err?.message || err);
            return cached?.rows ?? [];
        } finally {
            serverCache.sheetInFlight.delete(sheetName);
        }
    })();

    serverCache.sheetInFlight.set(sheetName, promise);
    return promise;
}

async function fetchSheetRows(sheetName: string, force = false): Promise<string[][]> {
    const cached = serverCache.sheetCache.get(sheetName);
    const now = Date.now();

    // 1. Fresh cache hit: return immediately
    if (!force && cached && now - cached.timestamp < SHEET_CACHE_TTL_MS) {
        return cached.rows;
    }

    // 2. Stale-while-revalidate: return last known rows instantly, trigger background fetch
    if (!force && cached && now - cached.timestamp < STALE_MAX_AGE_MS && cached.rows.length > 0) {
        if (!serverCache.sheetInFlight.has(sheetName)) {
            triggerBackgroundFetch(sheetName);
        }
        return cached.rows;
    }

    // 3. In-flight de-duping
    const existing = serverCache.sheetInFlight.get(sheetName);
    if (!force && existing) return existing;

    return executeSheetFetch(sheetName);
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
export async function getLinkedInLeads(force = false): Promise<LinkedInLead[]> {
    const now = Date.now();
    if (!force && serverCache.parsedLeads && now - serverCache.parsedLeads.timestamp < SHEET_CACHE_TTL_MS) {
        return serverCache.parsedLeads.data;
    }

    const [oldRows, newRows, new1Rows] = await Promise.all([
        fetchSheetRows(OLD_LEADS_SHEET_NAME, force),
        fetchSheetRows(NEW_LEADS_SHEET_NAME, force),
        fetchSheetRows(NEW_LEADS_1_SHEET_NAME, force),
    ]);
    const leads = [
        ...rowsToObjects<LinkedInLead>(oldRows, LEADS_COLUMNS, 'old'),
        ...rowsToObjects<LinkedInLead>(newRows, LEADS_COLUMNS, 'new'),
        ...rowsToObjects<LinkedInLead>(new1Rows, LEADS_COLUMNS, 'new_1'),
    ];
    for (const lead of leads) {
        lead.invitationSentAt = extractSnowflakeDate(lead.invitationId) || '';
    }

    serverCache.parsedLeads = { timestamp: Date.now(), data: leads };
    return leads;
}

/** Fetches "Old Conversations", "New Conversations", and "New Conversations_1" tabs and merges them, each row tagged with its batch. */
export async function getLinkedInConversations(force = false): Promise<LinkedInMessage[]> {
    const now = Date.now();
    if (!force && serverCache.parsedConversations && now - serverCache.parsedConversations.timestamp < SHEET_CACHE_TTL_MS) {
        return serverCache.parsedConversations.data;
    }

    const [oldRows, newRows, new1Rows] = await Promise.all([
        fetchSheetRows(OLD_CONVERSATIONS_SHEET_NAME, force),
        fetchSheetRows(NEW_CONVERSATIONS_SHEET_NAME, force),
        fetchSheetRows(NEW_CONVERSATIONS_1_SHEET_NAME, force),
    ]);
    const messages = [
        ...rowsToObjects<LinkedInMessage>(oldRows, CONVERSATIONS_COLUMNS, 'old'),
        ...rowsToObjects<LinkedInMessage>(newRows, CONVERSATIONS_COLUMNS, 'new'),
        ...rowsToObjects<LinkedInMessage>(new1Rows, CONVERSATIONS_COLUMNS, 'new_1'),
    ];

    serverCache.parsedConversations = { timestamp: Date.now(), data: messages };
    return messages;
}

export async function getLinkedInQuota(force = false): Promise<LinkedInQuota[]> {
    const now = Date.now();
    if (!force && serverCache.parsedQuota && now - serverCache.parsedQuota.timestamp < SHEET_CACHE_TTL_MS) {
        return serverCache.parsedQuota.data;
    }

    const rows = await fetchSheetRows(QUOTA_SHEET_NAME, force);
    const objs = rowsToObjects<any>(rows, QUOTA_COLUMNS);
    const quota = objs.map(o => ({
        ...o,
        dailyCap: Number(o.dailyCap) || 0,
        sentCount: Number(o.sentCount) || 0,
        remainingQuota: Number(o.remainingQuota) || 0,
    }));

    serverCache.parsedQuota = { timestamp: Date.now(), data: quota };
    return quota;
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
    leads: LinkedInLead[],
    force = false
): LinkedInConversationThread[] {
    const now = Date.now();
    if (!force && serverCache.parsedThreads && now - serverCache.parsedThreads.timestamp < SHEET_CACHE_TTL_MS) {
        return serverCache.parsedThreads.data;
    }

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

    const result = Array.from(threads.values()).sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    });

    serverCache.parsedThreads = { timestamp: Date.now(), data: result };
    return result;
}
