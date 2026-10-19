import { NextResponse } from 'next/server';
import { getOutreachLeads } from '@/lib/services/campaigns';

export async function GET() {
    try {
        const leads = await getOutreachLeads();
        return NextResponse.json({ data: leads });
    } catch (error: any) {
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }
}
