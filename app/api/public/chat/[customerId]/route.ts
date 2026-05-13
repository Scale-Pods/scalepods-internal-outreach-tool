import { NextResponse } from 'next/server';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ customerId: string }> }
) {
    const { customerId } = await params;
    const { searchParams } = new URL(req.url);
    const sourceTable = searchParams.get('source');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) return NextResponse.json({ error: "Config missing" }, { status: 500 });

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = { 
        "apikey": secretKey, 
        "Authorization": `Bearer ${secretKey}`, 
        "Content-Type": "application/json"
    };

    const searchVal = decodeURIComponent(customerId).trim();
    const isPhone = /^\d+$/.test(searchVal.replace(/\D/g, ''));

    // Tables to search
    const tables = sourceTable 
        ? [sourceTable] 
        : ['icp_tracker', 'meta_lead_tracker', 'ENRICHED_LEADS'];

    try {
        for (const table of tables) {
            let query = `${baseUrl}/${table}?select=*`;
            
            // Try searching by ID
            const idRes = await fetch(`${query}&id=eq.${searchVal}`, { headers });
            let data = await idRes.json();

            if (data && data.length > 0) {
                return NextResponse.json({ lead: { ...data[0], _table: table } });
            }

            // If not found by ID and looks like a phone, try searching by phone columns
            if (isPhone) {
                const phoneVal = searchVal.replace(/\D/g, '');
                const phoneCols = table === 'icp_tracker' 
                    ? ['personal_phone', 'Phone'] 
                    : ['company_phone_number', 'phone', 'Phone'];

                for (const col of phoneCols) {
                    try {
                        const phoneRes = await fetch(`${query}&${col}=ilike.*${phoneVal}*`, { headers });
                        if (phoneRes.ok) {
                            const data = await phoneRes.json();
                            if (data && data.length > 0) {
                                return NextResponse.json({ lead: { ...data[0], _table: table } });
                            }
                        }
                    } catch (e) {
                        console.error(`Column ${col} not found in ${table}`);
                    }
                }
            }
        }

        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
