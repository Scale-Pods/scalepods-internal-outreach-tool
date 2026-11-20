import { NextResponse } from 'next/server';
import {
    getLinkedInConversations, getLinkedInLeads, buildConversationThreads,
    LINKEDIN_ACCOUNTS, clearLinkedInCache,
} from '@/lib/services/linkedin-sheets';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const refresh = searchParams.get('refresh') === 'true';
        if (refresh) {
            clearLinkedInCache();
        }
        const [messages, leads] = await Promise.all([
            getLinkedInConversations(refresh),
            getLinkedInLeads(refresh),
        ]);
        const threads = buildConversationThreads(messages, leads, refresh);
        return NextResponse.json(
            { threads, messages, leads, accounts: LINKEDIN_ACCOUNTS },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' } }
        );
    } catch (error: any) {
        return NextResponse.json({ threads: [], messages: [], leads: [], accounts: LINKEDIN_ACCOUNTS, error: error.message }, { status: 500 });
    }
}
