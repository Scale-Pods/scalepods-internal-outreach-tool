const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sezrqpphfafjbnhuypji.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenJxcHBoZmFmamJuaHV5cGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUwMTU1NCwiZXhwIjoyMDkwMDc3NTU0fQ.rrPNJxELHXaKXsjhWApvwEPxGwMCGYSURaohzqVry9I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function listTables() {
    // Use raw SQL via rpc to list tables
    const { data, error } = await supabase.rpc('exec_sql', {
        sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    });
    
    if (error) {
        console.log('RPC method not available, trying direct query...');
        // Try querying some known tables
        const tables = ['users', 'user', 'accounts', 'profiles', 'password_resets'];
        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (!error) {
                console.log(`Table '${table}' EXISTS - columns:`, data.length > 0 ? Object.keys(data[0]) : '(empty)');
                if (data.length > 0) console.log('  Sample:', JSON.stringify(data[0]));
            } else {
                console.log(`Table '${table}': ${error.message}`);
            }
        }
    } else {
        console.log('Tables:', data);
    }
}

listTables().catch(console.error);
