import { NextRequest, NextResponse } from 'next/server';
import { getCampaignWaLeadDetail } from '@/lib/services/campaign-whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const lead = await getCampaignWaLeadDetail(id);
        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }
        return NextResponse.json({ lead });
    } catch (error: any) {
        console.error('[API /api/campaigns/whatsapp/leads/[id]] error:', error);
        const errorMessage = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        return NextResponse.json({
            error: errorMessage || 'Internal Server Error',
            code: error?.code || null,
            details: error?.details || null,
        }, { status: 500 });
    }
}
