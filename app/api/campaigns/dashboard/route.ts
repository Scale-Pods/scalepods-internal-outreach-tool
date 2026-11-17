import { NextRequest, NextResponse } from 'next/server';
import { getCampaignsDashboardStats, getCampaignsSummary } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;

        const [stats, campaigns] = await Promise.all([
            getCampaignsDashboardStats({ from, to }),
            getCampaignsSummary(),
        ]);

        return NextResponse.json({
            ...stats,
            campaigns,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
