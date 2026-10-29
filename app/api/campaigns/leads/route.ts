import { NextRequest, NextResponse } from 'next/server';
import { getOutreachLeadsPage, type OutreachChannel } from '@/lib/services/campaigns';

const VALID_CHANNELS: OutreachChannel[] = ['email', 'whatsapp', 'voice'];

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '15', 10) || 15));
        const search = searchParams.get('search') || undefined;
        const campaignIds = searchParams.getAll('campaignId').filter(Boolean);
        const channelParam = searchParams.get('channel');
        const channel = VALID_CHANNELS.includes(channelParam as OutreachChannel) ? (channelParam as OutreachChannel) : undefined;
        const statusFilter = searchParams.getAll('status').filter(Boolean);
        const activeOnly = searchParams.get('activeOnly') === 'true';

        const result = await getOutreachLeadsPage({
            page,
            pageSize,
            search,
            campaignIds: campaignIds.length ? campaignIds : undefined,
            channel,
            statusFilter: statusFilter.length ? statusFilter : undefined,
            activeOnly,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ data: [], totalCount: 0, page: 1, pageSize: 15, error: error.message }, { status: 500 });
    }
}
