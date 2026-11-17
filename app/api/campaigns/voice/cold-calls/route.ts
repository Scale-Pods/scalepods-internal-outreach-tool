import { NextRequest, NextResponse } from 'next/server';
import { getCampaignVoiceColdCalls } from '@/lib/services/campaign-voice';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '15', 10);
        const search = searchParams.get('search') || undefined;
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const status = searchParams.get('status') || undefined;
        const campaignIds = searchParams.getAll('campaignId');

        const result = await getCampaignVoiceColdCalls({
            page,
            pageSize,
            search,
            from,
            to,
            status,
            campaignIds: campaignIds.length > 0 ? campaignIds : undefined,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[API /api/campaigns/voice/cold-calls] error:', error);
        const errorMessage = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        return NextResponse.json({
            error: errorMessage || 'Internal Server Error',
            code: error?.code || null,
            details: error?.details || null,
        }, { status: 500 });
    }
}

