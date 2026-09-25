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
        const uniqueChats = new Set(messages.map(m => m.chatId).filter(Boolean)).size;
        const totalDailyCap = quota.reduce((sum, q) => sum + q.dailyCap, 0);
        const totalSentToday = quota.reduce((sum, q) => sum + q.sentCount, 0);
        const totalRemaining = quota.reduce((sum, q) => sum + q.remainingQuota, 0);

        const threads = buildConversationThreads(messages, leads);

        // Per-account bifurcation across Leads, Conversations & Quota Tracker,
        // keyed by the known Account IDs (falls back to "Unassigned" for blanks/unknowns).
        const accountIds = new Set<string>([
            ...LINKEDIN_ACCOUNTS.map(a => a.accountId),
            ...leads.map(l => l.accountId).filter(Boolean),
            ...quota.map(q => q.accountId).filter(Boolean),
        ]);

        const accountBreakdown = Array.from(accountIds).map(accountId => {
            const meta = getAccountMeta(accountId);
            const accountLeads = leads.filter(l => l.accountId === accountId);
            const accountConnected = accountLeads.filter(l => l.status.trim() && l.connectionStatus.trim()).length;
            const accountThreads = threads.filter(t => t.accountId === accountId);
            const accountQuota = quota.filter(q => q.accountId === accountId);

            return {
                accountId,
                name: meta.name,
                color: meta.color,
                totalLeads: accountLeads.length,
                connectedLeads: accountConnected,
                notConnectedLeads: accountLeads.length - accountConnected,
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
            totalMessages: messages.length,
            uniqueConversations: uniqueChats,
            quota: {
                dailyCap: totalDailyCap,
                sentCount: totalSentToday,
                remaining: totalRemaining,
            },
            accountBreakdown,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
