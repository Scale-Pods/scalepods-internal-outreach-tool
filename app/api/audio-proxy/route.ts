import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL', { status: 400 });
    }

    try {
        const headers: Record<string, string> = {
            'Accept': 'audio/*',
        };

        const range = request.headers.get('range');
        if (range) headers['Range'] = range;

        // Auth for providers
        if (url.includes('api.elevenlabs.io') && process.env.ELEVENLABS_API_KEY) headers['xi-api-key'] = process.env.ELEVENLABS_API_KEY;
        if (url.includes('api.vapi.ai') && process.env.VAPI_PRIVATE_KEY) headers['Authorization'] = `Bearer ${process.env.VAPI_PRIVATE_KEY}`;
        if (url.includes('api.twilio.com') && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }

        const response = await fetch(url, { headers, redirect: 'follow' });

        if (!response.ok && response.status !== 206) {
            console.error('[AudioProxy] Source fetch failed:', { status: response.status, url });
            return new NextResponse('Source fetch failed', { status: response.status });
        }

        const contentType = response.headers.get('Content-Type') || 'audio/mpeg';
        const contentLength = response.headers.get('Content-Length');
        const contentRange = response.headers.get('Content-Range');

        const outHeaders: Record<string, string> = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
        };
        // Only set these when the upstream actually provided them — an empty
        // string value is treated as Content-Length: 0 by some clients, which
        // makes the audio appear to have no data even though bytes are streaming.
        if (contentLength) outHeaders['Content-Length'] = contentLength;
        if (contentRange) outHeaders['Content-Range'] = contentRange;

        return new NextResponse(response.body, {
            status: response.status === 206 ? 206 : 200,
            headers: outHeaders,
        });
    } catch (error) {
        console.error('[AudioProxy] Internal error:', error);
        return new NextResponse('Proxy server error', { status: 500 });
    }
}
