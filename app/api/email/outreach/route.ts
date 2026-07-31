import { NextResponse } from 'next/server';
import { fetchOutreachLeads, computeMetrics } from '@/lib/services/email-outreach';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        from.setHours(0, 0, 0, 0);
        const to = toParam ? new Date(toParam) : new Date();
        to.setHours(23, 59, 59, 999);

        const allLeads = await fetchOutreachLeads();
        const coldLeads = allLeads.filter(l => l.leadType === 'cold');
        const hotLeads = allLeads.filter(l => l.leadType === 'hot');

        return NextResponse.json({
            cold: {
                metrics: computeMetrics(coldLeads, from, to),
                leads: coldLeads,
            },
            hot: {
                metrics: computeMetrics(hotLeads, from, to),
                leads: hotLeads,
            },
        });
    } catch (error: any) {
        console.error('Email outreach API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
