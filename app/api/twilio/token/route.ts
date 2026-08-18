import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export const runtime = 'nodejs';

export async function GET() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
        return NextResponse.json(
            { error: 'Twilio voice not configured. Add TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID to .env.local' },
            { status: 500 }
        );
    }

    try {
        const secret = new TextEncoder().encode(apiKeySecret);
        const now = Math.floor(Date.now() / 1000);

        const token = await new SignJWT({
            grants: {
                identity: 'browser-client',
                voice: {
                    outgoing: { application_sid: twimlAppSid },
                },
            },
        })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT', cty: 'twilio-fpa;v=1' })
            .setJti(`${apiKeySid}-${now}`)
            .setIssuer(apiKeySid)
            .setSubject(accountSid)
            .setIssuedAt(now)
            .setNotBefore(now)
            .setExpirationTime(now + 3600)
            .sign(secret);

        return NextResponse.json({ token });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Token generation failed' }, { status: 500 });
    }
}
