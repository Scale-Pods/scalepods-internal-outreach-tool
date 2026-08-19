import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

// Twilio's <Dial action> callback — fires once the dialed leg ends. We use it
// to upsert the parent call's outcome (status/duration) into twilio_call_logs.
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const parentCallSid = (formData.get('CallSid') as string) || '';
        const from = (formData.get('From') as string) || '';
        const to = (formData.get('To') as string) || '';
        const direction = (formData.get('Direction') as string) || '';
        const dialCallStatus = (formData.get('DialCallStatus') as string) || '';
        const dialCallDuration = parseInt((formData.get('DialCallDuration') as string) || '0', 10) || 0;
        const timestamp = (formData.get('Timestamp') as string) || '';

        if (parentCallSid) {
            await supabaseAdmin.from('twilio_call_logs').upsert({
                call_sid: parentCallSid,
                from_number: from,
                to_number: to,
                direction,
                status: dialCallStatus || 'completed',
                duration_seconds: dialCallDuration,
                started_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
                ended_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'call_sid' });
        }
    } catch (e) {
        console.error('[Twilio Status Callback] Error:', e);
    }

    // Nothing further to say — end the call gracefully.
    return new NextResponse(`${xmlHeader}\n<Response></Response>`, {
        headers: { 'Content-Type': 'text/xml' },
    });
}
