import { NextResponse } from 'next/server';
import { getLinkedInQuota } from '@/lib/services/linkedin-sheets';

export async function GET() {
    try {
        const quota = await getLinkedInQuota();
        return NextResponse.json({ data: quota });
    } catch (error: any) {
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }
}
