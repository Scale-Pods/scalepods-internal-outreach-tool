import { NextResponse } from 'next/server';


export async function GET() {
    // Dynamically get Supabase config from env
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        console.error("Critical Error: Supabase config is missing in env.");
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    // Ensure we have the base URL without trailing slash
    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

    const headers = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    const fetchTable = async (tableName: string) => {
        let allData: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            // Construct URL without potential double slashes, including pagination
            const url = `${baseUrl}/${tableName}?select=*&offset=${offset}&limit=${limit}`;

            // Legacy AbortController for Node 22 compatibility
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            try {
                const response = await fetch(url, {
                    headers,
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const contentType = response.headers.get("content-type");

                if (contentType && contentType.includes("text/html")) {
                    const htmlSnippet = (await response.text()).substring(0, 200);
                    console.error(`Error: HTML returned from ${tableName}. Snippet: ${htmlSnippet}`);
                    break;
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Error fetching ${tableName} (${response.status}):`, errorText);
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
            } catch (err: any) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    console.error(`Timeout error for ${tableName}: Request aborted after 60s.`);
                } else {
                    console.error(`Fetch error for ${tableName}:`, err);
                }
                break;
            }
        }

        // console.log(`Successfully fetched ${tableName}: ${allData.length} records`);
        return allData;
    };

    try {
        const [icpLeads, metaLeads] = await Promise.all([
            fetchTable("icp_tracker"),
            fetchTable("meta_lead_tracker")
        ]);

        // Tag sources before returning
        const leads = [
            ...icpLeads.map(l => ({ ...l, _table: 'icp_tracker' })),
            ...metaLeads.map(l => ({ ...l, _table: 'meta_lead_tracker' }))
        ];

        return NextResponse.json({
            leads
        });

    } catch (error: any) {
        console.error('Fetch error:', error);
        return NextResponse.json({
            leads: [],
            error: error.message
        }, { status: 500 });
    }
}
