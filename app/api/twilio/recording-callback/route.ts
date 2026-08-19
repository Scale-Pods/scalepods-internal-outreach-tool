import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Fires when a call recording finishes processing. Saves the recording,
// then requests a transcription (delivered async to transcription-callback).
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();

        const callSid = (formData.get('CallSid') as string) || '';
        const recordingSid = (formData.get('RecordingSid') as string) || '';
        const recordingUrl = (formData.get('RecordingUrl') as string) || '';
        const recordingStatus = (formData.get('RecordingStatus') as string) || '';

        if (callSid && recordingStatus === 'completed' && recordingUrl) {
            await supabaseAdmin.from('twilio_call_logs').upsert({
                call_sid: callSid,
                recording_sid: recordingSid,
                recording_url: `${recordingUrl}.mp3`,
                transcription_status: 'in-progress',
                updated_at: new Date().toISOString(),
            }, { onConflict: 'call_sid' });

            // Request transcription for this recording (async — result posted to
            // transcription-callback once ready).
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '');

            if (accountSid && authToken && recordingSid) {
                const transcriptionCallback = `${baseUrl}/api/twilio/transcription-callback`;
                const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

                await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}/Transcriptions.json`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Basic ${auth}`,
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            TranscriptionCallback: transcriptionCallback,
                        }),
                    }
                ).catch((e) => console.error('[Twilio Recording Callback] Transcription request failed:', e));
            }
        }
    } catch (e) {
        console.error('[Twilio Recording Callback] Error:', e);
    }

    return new NextResponse('', { status: 204 });
}
