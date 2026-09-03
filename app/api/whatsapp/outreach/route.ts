import { NextResponse } from 'next/server';
import { fetchWaLeads, computeWaMetrics } from '@/lib/services/whatsapp-outreach';

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

        const [coldLeads, hotLeads, hubspotWaLeads] = await Promise.all([
            fetchWaLeads('cold', from, to),
            fetchWaLeads('hot', from, to),
            fetchWaLeads('hubspot_wa', from, to),
        ]);

        return NextResponse.json({
            cold: {
                metrics: computeWaMetrics(coldLeads, from, to),
                leads: coldLeads,
            },
            hot: {
                metrics: computeWaMetrics(hotLeads, from, to),
                leads: hotLeads,
            },
            hubspotWa: {
                metrics: computeWaMetrics(hubspotWaLeads, from, to),
                leads: hubspotWaLeads,
            },
        });
    } catch (error: any) {
        console.error('WhatsApp outreach API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
