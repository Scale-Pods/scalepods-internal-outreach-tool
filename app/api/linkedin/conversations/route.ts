import { NextResponse } from 'next/server';
import { getLinkedInConversations, getLinkedInLeads, buildConversationThreads } from '@/lib/services/linkedin-sheets';

export async function GET() {
    try {
        const [messages, leads] = await Promise.all([
            getLinkedInConversations(),
            getLinkedInLeads(),
        ]);
        const threads = buildConversationThreads(messages, leads);
        return NextResponse.json({ threads, messages, leads });
    } catch (error: any) {
        return NextResponse.json({ threads: [], messages: [], leads: [], error: error.message }, { status: 500 });
    }
}
