import { NextResponse } from 'next/server';
import {
    getOutreachLeads, buildCampaignSummaries, countEmailStepsSent, hasEmailReply,
} from '@/lib/services/campaigns';

export async function GET() {
    try {
        const leads = await getOutreachLeads();
        const campaigns = buildCampaignSummaries(leads);

        const totalLeads = leads.length;
        const emailSent = leads.filter(l => countEmailStepsSent(l) > 0).length;
        const emailReplied = leads.filter(hasEmailReply).length;
        const unsubscribed = leads.filter(l => l.unsubscribed).length;
        const bounced = leads.filter(l => l.bounced).length;
        const whatsappActive = leads.filter(l => !!l.whatsappStatus).length;
        const voiceActive = leads.filter(l => !!l.voiceStatus).length;
        const contacted = leads.filter(l => l.leadStatus === 'contacted').length;
        const newLeads = leads.filter(l => l.leadStatus === 'new').length;

        return NextResponse.json({
            totalLeads,
            totalCampaigns: campaigns.length,
            emailSent,
            emailReplied,
            unsubscribed,
            bounced,
            whatsappActive,
            voiceActive,
            contacted,
            newLeads,
            campaigns,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
