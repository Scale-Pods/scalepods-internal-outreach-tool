import { NextResponse } from 'next/server';
import { getSarvamCostSummary } from '@/lib/services/campaign-voice';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const summary = await getSarvamCostSummary();
        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('[API /api/campaigns/voice/sarvam-cost] error:', error);
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
}
