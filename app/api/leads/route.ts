import { NextResponse } from 'next/server';
import { getOrSetCache } from '@/lib/cache-utils';

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) return NextResponse.json({ error: "Config missing" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const typeParam = searchParams.get('type') || 'email';
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
        const activeTo = toParam;

        try {
            // 1. Get total count
            let countUrl = `${baseUrl}/${tableName}?select=*&limit=1`;
            if (formattedCol) {
                if (activeFrom) countUrl += `&${encodeURIComponent(formattedCol)}=gte.${new Date(activeFrom).toISOString()}`;
                if (activeTo) countUrl += `&${encodeURIComponent(formattedCol)}=lte.${new Date(activeTo).toISOString()}`;
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
                if (formattedCol) {
                    if (activeFrom) url += `&${encodeURIComponent(formattedCol)}=gte.${new Date(activeFrom).toISOString()}`;
                    if (activeTo) url += `&${encodeURIComponent(formattedCol)}=lte.${new Date(activeTo).toISOString()}`;
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
        const cacheKey = `leads-final-v1-${fromParam || 'all'}-${toParam || 'now'}-${typeParam}`;
        
        const leads = await getOrSetCache(cacheKey, 5 * 60 * 1000, async () => {
            const icpDateCol = typeParam === 'whatsapp' ? 'Whatsapp Last Contacted' : 'Email Last Contacted';
            
            const [icpLeads, metaLeads, enrichedLeads, masterLeads] = await Promise.all([
                fetchTableTurbo("icp_tracker", icpDateCol),
                fetchTableTurbo("meta_lead_tracker", "created_at"),
                fetchTableTurbo("ENRICHED_LEADS", icpDateCol),
                fetchTableTurbo("master_leads_unique")
            ]);

            const lifecycleMap = new Map();
            if (masterLeads) {
                masterLeads.forEach((m: any) => {
                    if (m.company_phone_number && m.lifecyclestage) {
                        const cleanedPhone = String(m.company_phone_number).replace(/\D/g, '');
                        lifecycleMap.set(cleanedPhone, m.lifecyclestage);
                    }
                });
            }

            const formatLifecycleStage = (stage: string) => {
                if (!stage) return stage;
                const s = String(stage).toLowerCase().trim();
                switch (s) {
                    case "3773603577": return "Not Interested/DND";
                    case "3736289008": return "Will Buy Later";
                    case "opportunity": return "Meeting Booked";
                    case "salesqualifiedlead": return "Attempting Contact";
                    case "3737191101": return "Connected";
                    case "marketingqualifiedlead": return "Junk";
                    default: return stage;
                }
            };

            const getLifecycle = (phoneRaw: any) => {
                if (!phoneRaw) return undefined;
                const cleaned = String(phoneRaw).replace(/\D/g, '');
                const rawStage = lifecycleMap.get(cleaned);
                return rawStage ? formatLifecycleStage(rawStage) : undefined;
            };

            return [
                ...(icpLeads || []).map((l: any) => {
                    const phone = l.personal_phone;
                    return { 
                        ...l, _table: 'icp_tracker', phone, 
                        lifecyclestage: getLifecycle(phone),
                        name: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Guest',
                        Voice_1: l["Voice_1_Status"], Voice_2: l["Voice_2_Status"]
                    };
                }),
                ...(metaLeads || []).map((l: any) => {
                    const phone = l.company_phone_number;
                    return { 
                        ...l, _table: 'meta_lead_tracker', phone, 
                        lifecyclestage: getLifecycle(phone),
                        name: l.full_name || 'Guest' 
                    };
                }),
                ...(enrichedLeads || []).map((l: any) => {
                    const phone = l.company_phone_number;
                    return { 
                        ...l, _table: 'ENRICHED_LEADS', phone, 
                        lifecyclestage: getLifecycle(phone),
                        name: `${l["First Name"] || ''} ${l["Last Name"] || ''}`.trim() || 'Guest' 
                    };
                })
            ];
        });

        return NextResponse.json({ leads });
    } catch (error: any) {
        return NextResponse.json({ leads: [], error: error.message }, { status: 500 });
    }
}
