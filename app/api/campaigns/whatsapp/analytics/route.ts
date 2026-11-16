import { NextRequest, NextResponse } from 'next/server';
import { getCampaignWaAnalytics } from '@/lib/services/campaign-whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const campaignIds = searchParams.getAll('campaignId');

        const analytics = await getCampaignWaAnalytics({
            from,
            to,
            campaignIds: campaignIds.length > 0 ? campaignIds : undefined,
        });

        return NextResponse.json(analytics);
    } catch (error: any) {
        console.error('[API /api/campaigns/whatsapp/analytics] error:', error);
        const errorMessage = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        return NextResponse.json({
            error: errorMessage || 'Internal Server Error',
            code: error?.code || null,
            details: error?.details || null,
        }, { status: 500 });
    }
}
