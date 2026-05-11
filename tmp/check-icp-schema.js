
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
    if (!supabaseUrl || !secretKey) {
        console.error("Missing env vars");
        return;
    }
    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const headers = { 
        "apikey": secretKey, 
        "Authorization": `Bearer ${secretKey}`, 
        "Content-Type": "application/json"
    };

    try {
        const res = await fetch(`${baseUrl}/icp_tracker?select=*&limit=1`, { headers });
        const data = await res.json();
        console.log("Sample record:", JSON.stringify(data[0], null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

checkSchema();
