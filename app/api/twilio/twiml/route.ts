import { NextRequest, NextResponse } from 'next/server';
import { isAllowedCallerNumber } from '@/lib/services/caller-numbers';

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

function twimlResponse(body: string) {
    return new NextResponse(`${xmlHeader}\n<Response>${body}</Response>`, {
        headers: { 'Content-Type': 'text/xml' },
    });
}

export async function POST(req: NextRequest) {
    const defaultCallerId = process.env.TWILIO_PHONE_NUMBER;

    if (!defaultCallerId) {
        return twimlResponse('<Say>Service is not configured.</Say>');
    }

    const formData = await req.formData();

    // The dialer sends which of our numbers to call from as "CallerId" (a
    // custom Device.connect param — "From" is reserved by Twilio for the
    // client identity, so we can't reuse it here). Only accept it if it's
    // one of our known, voice-capable numbers — otherwise fall back to the
    // default so a bad/missing value can't be used as caller ID.
    const requestedFrom = (formData.get('CallerId') as string | null)?.trim() || '';
    const callerId = isAllowedCallerNumber(requestedFrom) ? requestedFrom : defaultCallerId;

    const rawTo = (formData.get('To') as string | null) ?? '';

    // Strip all chars that aren't digits, +, spaces, dashes, parens — then re-check
    const sanitized = rawTo.replace(/[^\d+\s\-().]/g, '').trim();
    const digitsOnly = sanitized.replace(/[\s\-().]/g, '');

    if (!digitsOnly || !/^\+?\d{7,15}$/.test(digitsOnly)) {
        return twimlResponse('<Say>Invalid or missing phone number.</Say>');
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '');
    const statusCallback = `${baseUrl}/api/twilio/status-callback`;
    const recordingCallback = `${baseUrl}/api/twilio/recording-callback`;

    return twimlResponse(
        `<Dial callerId="${callerId}" timeout="30" record="record-from-answer-dual" ` +
        `recordingStatusCallback="${recordingCallback}" recordingStatusCallbackEvent="completed" ` +
        `action="${statusCallback}">` +
        `<Number>${sanitized}</Number>` +
        `</Dial>`
    );
}
