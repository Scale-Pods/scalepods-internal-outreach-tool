import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        let fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);

        let toDate = toParam ? new Date(toParam) : new Date();
        toDate.setHours(23, 59, 59, 999);

        const { data, error } = await supabaseAdmin
            .from('twilio_call_logs')
            .select('*')
            .gte('created_at', fromDate.toISOString())
            .lte('created_at', toDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) {
            console.error('[Twilio Calls] Fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
        }

        const results = (data || []).map((row: any) => ({
            id: row.call_sid,
            callSid: row.call_sid,
            from: row.from_number,
            to: row.to_number,
            phone: row.to_number,
            direction: row.direction,
            status: row.status,
            durationSeconds: row.duration_seconds || 0,
            recordingUrl: row.recording_url,
            audio_url: row.recording_url,
            transcript: row.transcription_text,
            transcriptionStatus: row.transcription_status,
            startedAt: row.started_at,
            createdAt: row.created_at,
        }));

        return NextResponse.json(results);
    } catch (e) {
        console.error('[Twilio Calls] Exception:', e);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}
