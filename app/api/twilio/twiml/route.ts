import { NextRequest, NextResponse } from 'next/server';

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

function twimlResponse(body: string) {
    return new NextResponse(`${xmlHeader}\n<Response>${body}</Response>`, {
        headers: { 'Content-Type': 'text/xml' },
    });
}

export async function POST(req: NextRequest) {
    const callerId = process.env.TWILIO_PHONE_NUMBER;

    if (!callerId) {
        return twimlResponse('<Say>Service is not configured.</Say>');
    }

    const formData = await req.formData();
    const rawTo = (formData.get('To') as string | null) ?? '';

    // Strip all chars that aren't digits, +, spaces, dashes, parens — then re-check
    const sanitized = rawTo.replace(/[^\d+\s\-().]/g, '').trim();
    const digitsOnly = sanitized.replace(/[\s\-().]/g, '');

    if (!digitsOnly || !/^\+?\d{7,15}$/.test(digitsOnly)) {
        return twimlResponse('<Say>Invalid or missing phone number.</Say>');
    }

    return twimlResponse(
        `<Dial callerId="${callerId}" timeout="30" record="do-not-record"><Number>${sanitized}</Number></Dial>`
    );
}
