import { NextResponse } from 'next/server';
import { getCampaignVoiceCallByLeadId } from '@/lib/services/campaign-voice';

export const dynamic = 'force-dynamic';

// Public, unauthenticated lookup for the shareable campaign voice call link.
// Keyed by outreach_leads.id (unique) — always resolves to the lead's most recent call.
export async function GET(
    req: Request,
    { params }: { params: Promise<{ leadId: string }> }
) {
    const { leadId } = await params;

    try {
        const result = await getCampaignVoiceCallByLeadId(decodeURIComponent(leadId));

        if (!result.lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }
        if (!result.call) {
            return NextResponse.json({ error: 'No call found for this lead' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[API /api/public/campaign-call] error:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
