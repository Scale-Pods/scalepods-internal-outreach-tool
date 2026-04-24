import { NextResponse } from 'next/server';

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const tableName = "gmap_leadsv2";
    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    try {
        while (hasMore) {
            let queryParts = [`select=*`, `offset=${offset}`, `limit=${limit}`, `order=scraped_at.desc` ];
            
            if (from && to) {
                queryParts.push(`scraped_at=gte.${from}`);
                queryParts.push(`scraped_at=lte.${to}`);
            } else if (from) {
                queryParts.push(`scraped_at=gte.${from}`);
            } else if (to) {
                queryParts.push(`scraped_at=lte.${to}`);
            }

            const url = `${baseUrl}/${tableName}?${queryParts.join('&')}`;
            const response = await fetch(url, {
                headers,
                cache: 'no-store'
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error fetching ${tableName}:`, errorText);
                break;
            }

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
        console.error('Fetch error:', error);
        return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }
}
