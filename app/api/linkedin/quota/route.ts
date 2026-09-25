import { NextResponse } from 'next/server';
import { getLinkedInQuota, LINKEDIN_ACCOUNTS } from '@/lib/services/linkedin-sheets';

export async function GET() {
    try {
        const quota = await getLinkedInQuota();
        return NextResponse.json({ data: quota, accounts: LINKEDIN_ACCOUNTS });
    } catch (error: any) {
        return NextResponse.json({ data: [], accounts: LINKEDIN_ACCOUNTS, error: error.message }, { status: 500 });
    }
}
