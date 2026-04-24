import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    const tableName = "LinkedIn_leads";
    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    try {
        while (hasMore) {
            let queryParts = [`select=*`, `offset=${offset}`, `limit=${limit}`, `order=unique_id.desc` ];
            
            const url = `${baseUrl}/${tableName}?${queryParts.join('&')}`;
            const response = await fetch(url, {
                headers,
                cache: 'no-store'
            });

            if (!response.ok) break;

            const data = await response.json();
            if (Array.isArray(data)) {
                allData = allData.concat(data);
                if (data.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                hasMore = false;
            }
        }

        return NextResponse.json({ data: allData });
    } catch (error: any) {
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const campaignName = searchParams.get('campaign_name');

    if (!campaignName) {
        return NextResponse.json({ error: "Campaign name required" }, { status: 400 });
    }

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    try {
        const response = await fetch(`${baseUrl}/LinkedIn_leads?campaign_name=eq.${encodeURIComponent(campaignName)}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to delete" }, { status: response.status });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
