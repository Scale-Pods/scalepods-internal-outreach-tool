import { NextResponse } from 'next/server';
import { getLinkedInLeads, LINKEDIN_ACCOUNTS } from '@/lib/services/linkedin-sheets';

export async function GET() {
    try {
        const leads = await getLinkedInLeads();
        return NextResponse.json({ data: leads, accounts: LINKEDIN_ACCOUNTS });
    } catch (error: any) {
        return NextResponse.json({ data: [], accounts: LINKEDIN_ACCOUNTS, error: error.message }, { status: 500 });
    }
}
