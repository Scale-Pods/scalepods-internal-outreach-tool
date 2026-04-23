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

    try {
        const cacheKey = `meta-leads-final-v1-${fromParam || 'all'}-${toParam || 'now'}`;
        
        const allData = await getOrSetCache(cacheKey, 5 * 60 * 1000, async () => {
            const limit = 1000;
            
            // 1. Get total count
            let countUrl = `${baseUrl}/meta_lead_tracker?select=*&limit=1`;
            if (fromParam) countUrl += `&created_at=gte.${new Date(fromParam).toISOString()}`;
            
            const countRes = await fetch(countUrl, { headers, cache: 'no-store', method: 'HEAD' });
            const contentRange = countRes.headers.get('content-range');
            let totalCount = parseInt(contentRange?.split('/')[1] || "0");
            
            // Fallback: Ensure visibility
            if (totalCount === 0) {
                const fbRes = await fetch(`${baseUrl}/meta_lead_tracker?select=*&limit=1`, { headers, cache: 'no-store', method: 'HEAD' });
                totalCount = parseInt(fbRes.headers.get('content-range')?.split('/')[1] || "0");
            }

            if (totalCount === 0) return [];

            // 2. Parallel Fetching
            const pageCount = Math.ceil(Math.min(totalCount, 30000) / limit);
            const fetchPromises = [];

            for (let i = 0; i < pageCount; i++) {
                const offset = i * limit;
                let url = `${baseUrl}/meta_lead_tracker?select=*&limit=${limit}&offset=${offset}&order=created_at.desc.nullslast`;
                if (fromParam) {
                    url += `&created_at=gte.${new Date(fromParam).toISOString()}`;
                }
                fetchPromises.push(fetch(url, { headers, cache: 'no-store' }).then(r => r.ok ? r.json() : []));
            }

            const results = await Promise.all(fetchPromises);
            const flat = results.flat().filter(Boolean);
            console.log(`Success: Found ${totalCount} Meta records. Loaded ${flat.length}.`);
            return flat;
        });

        return NextResponse.json({ leads: allData });
    } catch (error: any) {
        return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }
}
