import { NextResponse } from 'next/server';
import { getLinkedInQuota, LINKEDIN_ACCOUNTS, clearLinkedInCache } from '@/lib/services/linkedin-sheets';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const refresh = searchParams.get('refresh') === 'true';
        if (refresh) {
            clearLinkedInCache();
        }
        const quota = await getLinkedInQuota(refresh);
        return NextResponse.json(
            { data: quota, accounts: LINKEDIN_ACCOUNTS },
            { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' } }
        );
    } catch (error: any) {
        return NextResponse.json({ data: [], accounts: LINKEDIN_ACCOUNTS, error: error.message }, { status: 500 });
    }
}
