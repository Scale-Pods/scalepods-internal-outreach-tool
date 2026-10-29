import { NextRequest, NextResponse } from 'next/server';
import { getOutreachLeadDetail } from '@/lib/services/campaigns';

// Full per-lead detail (email bodies, step statuses, replies) — fetched
// on-demand for exactly one lead, e.g. when a list-page row is clicked.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const lead = await getOutreachLeadDetail(id);
        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        return NextResponse.json({ data: lead });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
