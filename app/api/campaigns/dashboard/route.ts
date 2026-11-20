import { NextRequest, NextResponse } from 'next/server';
import { getCampaignsDashboardStats, getCampaignsSummary } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        // The master dashboard only needs the top-line stats, not the
        // per-campaign breakdown — skip that extra full-table aggregate RPC
        // for it to cut one more round trip off the hot path.
        const skipCampaigns = searchParams.get('skipCampaigns') === 'true';

        const [stats, campaigns] = await Promise.all([
            getCampaignsDashboardStats({ from, to }),
            skipCampaigns ? Promise.resolve([]) : getCampaignsSummary(),
        ]);

        return NextResponse.json({
            ...stats,
            campaigns,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
