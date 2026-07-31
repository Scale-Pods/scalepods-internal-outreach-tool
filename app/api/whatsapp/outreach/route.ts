import { NextResponse } from 'next/server';
import { fetchWaLeads, computeWaMetrics, hasWaActivity } from '@/lib/services/whatsapp-outreach';

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

        const allLeads = await fetchWaLeads();
        const coldLeads = allLeads.filter(l => l.leadType === 'cold' && hasWaActivity(l));
        const hotLeads = allLeads.filter(l => l.leadType === 'hot' && hasWaActivity(l));

        return NextResponse.json({
            cold: {
                metrics: computeWaMetrics(coldLeads, from, to),
                leads: coldLeads,
            },
            hot: {
                metrics: computeWaMetrics(hotLeads, from, to),
                leads: hotLeads,
            },
        });
    } catch (error: any) {
        console.error('WhatsApp outreach API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
