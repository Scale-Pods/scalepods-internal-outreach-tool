import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Fires when Twilio finishes transcribing a recording.
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const callSid = (formData.get('CallSid') as string) || '';
        const transcriptionSid = (formData.get('TranscriptionSid') as string) || '';
        const transcriptionText = (formData.get('TranscriptionText') as string) || '';
        const transcriptionStatus = (formData.get('TranscriptionStatus') as string) || '';

        if (callSid) {
            await supabaseAdmin.from('twilio_call_logs').update({
                transcription_sid: transcriptionSid,
                transcription_text: transcriptionText,
                transcription_status: transcriptionStatus || 'completed',
                updated_at: new Date().toISOString(),
            }).eq('call_sid', callSid);
        }
    } catch (e) {
        console.error('[Twilio Transcription Callback] Error:', e);
    }

    return new NextResponse('', { status: 204 });
}
