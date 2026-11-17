import { NextRequest, NextResponse } from 'next/server';
import { getCampaignVoiceOverview } from '@/lib/services/campaign-voice';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const status = searchParams.get('status') || undefined;
        const sentiment = searchParams.get('sentiment') || undefined;
        const campaignIds = searchParams.getAll('campaignId');

        const stats = await getCampaignVoiceOverview({
            from,
            to,
            status,
            sentiment,
            campaignIds: campaignIds.length > 0 ? campaignIds : undefined,
        });

        return NextResponse.json({ stats });
    } catch (error: any) {
        console.error('[API /api/campaigns/voice/overview] error:', error);
        const errorMessage = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        return NextResponse.json({
            error: errorMessage || 'Internal Server Error',
            code: error?.code || null,
            details: error?.details || null,
        }, { status: 500 });
    }
}

