import { NextRequest, NextResponse } from 'next/server';
import { getCampaignWaOverview } from '@/lib/services/campaign-whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const campaignIds = searchParams.getAll('campaignId');

        console.log('[API /api/campaigns/whatsapp/overview] GET request received:', {
            from,
            to,
            campaignIds,
        });

        const stats = await getCampaignWaOverview({
            from,
            to,
            campaignIds: campaignIds.length > 0 ? campaignIds : undefined,
        });

        return NextResponse.json({ stats });
    } catch (error: any) {
        console.error('[API /api/campaigns/whatsapp/overview] Server Error:', {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            stack: error?.stack,
        });

        const errorMessage = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        return NextResponse.json({
            error: errorMessage || 'Internal Server Error',
            code: error?.code || null,
            details: error?.details || null,
        }, { status: 500 });
    }
}
