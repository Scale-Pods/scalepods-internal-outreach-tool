import { NextResponse } from 'next/server';

export async function GET() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const url = `${baseUrl}/meta_lead_tracker?select=*&offset=${offset}&limit=${limit}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch(url, {
                headers,
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error fetching meta_lead_tracker (${response.status}):`, errorText);
                break;
            }

            const data = await response.json();
            if (Array.isArray(data)) {
                allData = allData.concat(data);
                hasMore = data.length >= limit;
                offset += limit;
            } else {
                hasMore = false;
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            console.error('meta_lead_tracker fetch error:', err);
            break;
        }
    }

    return NextResponse.json({ leads: allData });
}
