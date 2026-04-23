import { NextResponse } from 'next/server';
import { getOrSetCache } from '@/lib/cache-utils';

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) return NextResponse.json({ error: "Config missing" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    
    // EXPLICIT HEADERS for exact counting
    const headers = { 
        "apikey": secretKey, 
        "Authorization": `Bearer ${secretKey}`, 
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    };

    const fetchTableTurbo = async (tableName: string, dateCol?: string) => {
        const limit = 1000;
        const formattedCol = dateCol?.includes(" ") ? `"${dateCol}"` : dateCol;

        const activeFrom = fromParam;

        try {
            // 1. Get total count
            let countUrl = `${baseUrl}/${tableName}?select=*&limit=1`;
            if (activeFrom && formattedCol) {
                countUrl += `&${encodeURIComponent(formattedCol)}=gte.${new Date(activeFrom).toISOString()}`;
            }
            
            const countRes = await fetch(countUrl, { headers, cache: 'no-store', method: 'HEAD' });
            const contentRange = countRes.headers.get('content-range');
            let totalCount = parseInt(contentRange?.split('/')[1] || "0");
            
            // Fallback: If filtered count is 0, get total table count to ensure visibility
            if (totalCount === 0) {
                const fbRes = await fetch(`${baseUrl}/${tableName}?select=*&limit=1`, { headers, cache: 'no-store', method: 'HEAD' });
                totalCount = parseInt(fbRes.headers.get('content-range')?.split('/')[1] || "0");
            }

            if (totalCount === 0) return [];

            // 2. Parallel Fetching
            const pageCount = Math.ceil(Math.min(totalCount, 50000) / limit);
            const fetchPromises = [];

            for (let i = 0; i < pageCount; i++) {
                const offset = i * limit;
                let url = `${baseUrl}/${tableName}?select=*&limit=${limit}&offset=${offset}`;
                if (activeFrom && formattedCol) {
                    url += `&${encodeURIComponent(formattedCol)}=gte.${new Date(activeFrom).toISOString()}`;
                }
                if (formattedCol) url += `&order=${encodeURIComponent(formattedCol)}.desc.nullslast`;
                
                fetchPromises.push(fetch(url, { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : []));
            }

            const results = await Promise.all(fetchPromises);
            const flat = results.flat().filter(Boolean);
            console.log(`Success: Found ${totalCount} records in ${tableName}. Loaded ${flat.length}.`);
            return flat;
        } catch (e) {
            console.error(`Error for ${tableName}:`, e);
            return [];
        }
    };

    try {
        const cacheKey = `leads-final-v1-${fromParam || 'all'}-${toParam || 'now'}`;
        
        const leads = await getOrSetCache(cacheKey, 5 * 60 * 1000, async () => {
            const [icpLeads, metaLeads] = await Promise.all([
                fetchTableTurbo("icp_tracker", "Email Last Contacted"),
                fetchTableTurbo("meta_lead_tracker", "created_at")
            ]);

            return [
                ...(icpLeads || []).map((l: any) => ({ 
                    ...l, _table: 'icp_tracker', phone: l.personal_phone, 
                    name: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Guest',
                    Voice_1: l["Voice_1_Status"], Voice_2: l["Voice_2_Status"]
                })),
                ...(metaLeads || []).map((l: any) => ({ ...l, _table: 'meta_lead_tracker', phone: l.company_phone_number, name: l.full_name || 'Guest' }))
            ];
        });

        return NextResponse.json({ leads });
    } catch (error: any) {
        return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }
}
