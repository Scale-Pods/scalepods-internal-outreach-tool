import { NextResponse } from 'next/server';
import {
    getLinkedInLeads, getLinkedInConversations, getLinkedInQuota,
    buildConversationThreads, LINKEDIN_ACCOUNTS, getAccountMeta,
} from '@/lib/services/linkedin-sheets';

export async function GET() {
    try {
        const [leads, messages, quota] = await Promise.all([
            getLinkedInLeads(),
            getLinkedInConversations(),
            getLinkedInQuota(),
        ]);

        // A lead counts as "accepted / connected" only when both Status and
        // Connection Status (from the Leads sheet) are filled in.
        const connected = leads.filter(l => l.status.trim() && l.connectionStatus.trim()).length;
        const notConnected = leads.length - connected;

        // A connection request has gone out once Status is populated — this is the
        // correct denominator for connection rate. (Quota Tracker's "Sent Count" is a
        // daily-reset counter, not a cumulative total, so it can't be used here — it
        // previously produced rates over 100%.)
        const requestsSent = leads.filter(l => l.status.trim()).length;

        // A lead counts as "replied" when the Reply Text column has content.
        const repliedLeads = leads.filter(l => l.replyText.trim());
        const replied = repliedLeads.length;
        const uniqueChats = new Set(messages.map(m => m.chatId).filter(Boolean)).size;
        const totalDailyCap = quota.reduce((sum, q) => sum + q.dailyCap, 0);
        const totalSentToday = quota.reduce((sum, q) => sum + q.sentCount, 0);
        const totalRemaining = quota.reduce((sum, q) => sum + q.remainingQuota, 0);

        const threads = buildConversationThreads(messages, leads);

        // Per-account bifurcation across Leads, Conversations & Quota Tracker.
        // Restricted to the known LinkedIn sender accounts only — stray/unknown
        // Account IDs picked up from the sheet (e.g. test rows) are excluded.
        const accountIds = LINKEDIN_ACCOUNTS.map(a => a.accountId);

        const accountBreakdown = accountIds.map(accountId => {
            const meta = getAccountMeta(accountId);
            const accountLeads = leads.filter(l => l.accountId === accountId);
            const accountConnected = accountLeads.filter(l => l.status.trim() && l.connectionStatus.trim()).length;
            const accountReplied = accountLeads.filter(l => l.replyText.trim()).length;
            const accountThreads = threads.filter(t => t.accountId === accountId);
            const accountQuota = quota.filter(q => q.accountId === accountId);

            return {
                accountId,
                name: meta.name,
                color: meta.color,
                totalLeads: accountLeads.length,
                connectedLeads: accountConnected,
                notConnectedLeads: accountLeads.length - accountConnected,
                repliedLeads: accountReplied,
                conversations: accountThreads.length,
                messages: accountThreads.reduce((sum, t) => sum + t.messages.length, 0),
                quota: {
                    dailyCap: accountQuota.reduce((sum, q) => sum + q.dailyCap, 0),
                    sentCount: accountQuota.reduce((sum, q) => sum + q.sentCount, 0),
                    remaining: accountQuota.reduce((sum, q) => sum + q.remainingQuota, 0),
                },
            };
        }).sort((a, b) => b.totalLeads - a.totalLeads);

        return NextResponse.json({
            totalLeads: leads.length,
            connectedLeads: connected,
            notConnectedLeads: notConnected,
            repliedLeads: replied,
            totalMessages: messages.length,
            uniqueConversations: uniqueChats,
            quota: {
                dailyCap: totalDailyCap,
                sentCount: totalSentToday,
                remaining: totalRemaining,
            },
            // Connection rate = accepted/connected leads ÷ connection requests sent
            // (leads with a non-empty Status), not ÷ total leads.
            requestsSent,
            accountBreakdown,
            // Actual reply content, from the Leads sheet "Reply Text" column.
            replies: repliedLeads
                .map(l => ({
                    personId: l.personId,
                    fullName: l.fullName,
                    companyName: l.companyName,
                    accountId: l.accountId,
                    accountName: getAccountMeta(l.accountId).name,
                    replyText: l.replyText,
                    lastActionSentAt: l.lastActionSentAt,
                }))
                .sort((a, b) => new Date(b.lastActionSentAt).getTime() - new Date(a.lastActionSentAt).getTime()),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
