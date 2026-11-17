import { NextRequest, NextResponse } from 'next/server';
import { getChannelStats, getChannelCampaignOptions, type OutreachChannel } from '@/lib/services/campaigns';

export const dynamic = 'force-dynamic';

const VALID_CHANNELS: OutreachChannel[] = ['email', 'whatsapp', 'voice'];

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const channelParam = searchParams.get('channel');
        if (!VALID_CHANNELS.includes(channelParam as OutreachChannel)) {
            return NextResponse.json({ error: 'channel must be one of email, whatsapp, voice' }, { status: 400 });
        }
        const channel = channelParam as OutreachChannel;
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;

        const [stats, campaignOptions] = await Promise.all([
            getChannelStats(channel, { from, to }),
            getChannelCampaignOptions(channel),
        ]);

        return NextResponse.json({ stats, campaignOptions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
