import { NextRequest, NextResponse } from 'next/server';
import { getChannelStats, getChannelCampaignOptions, type OutreachChannel } from '@/lib/services/campaigns';

const VALID_CHANNELS: OutreachChannel[] = ['email', 'whatsapp', 'voice'];

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const channelParam = searchParams.get('channel');
        if (!VALID_CHANNELS.includes(channelParam as OutreachChannel)) {
            return NextResponse.json({ error: 'channel must be one of email, whatsapp, voice' }, { status: 400 });
        }
        const channel = channelParam as OutreachChannel;

        const [stats, campaignOptions] = await Promise.all([
            getChannelStats(channel),
            getChannelCampaignOptions(channel),
        ]);

        return NextResponse.json({ stats, campaignOptions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
