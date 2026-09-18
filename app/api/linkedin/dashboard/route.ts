import { NextResponse } from 'next/server';
import { getLinkedInLeads, getLinkedInConversations, getLinkedInQuota } from '@/lib/services/linkedin-sheets';

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
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
