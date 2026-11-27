import { NextResponse } from 'next/server';
import { getCampaignAliasesWithSummary } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const result = await getCampaignAliasesWithSummary();
        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { aliases: {}, campaigns: [], error: error.message },
            { status: 500 }
        );
    }
}
