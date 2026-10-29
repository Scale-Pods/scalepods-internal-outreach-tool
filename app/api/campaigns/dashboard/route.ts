import { NextResponse } from 'next/server';
import { getCampaignsDashboardStats, getCampaignsSummary } from '@/lib/services/campaigns';

export async function GET() {
    try {
        const [stats, campaigns] = await Promise.all([
            getCampaignsDashboardStats(),
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
