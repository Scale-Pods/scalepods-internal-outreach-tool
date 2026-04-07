const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sezrqpphfafjbnhuypji.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenJxcHBoZmFmamJuaHV5cGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUwMTU1NCwiZXhwIjoyMDkwMDc3NTU0fQ.rrPNJxELHXaKXsjhWApvwEPxGwMCGYSURaohzqVry9I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAllTables() {
    // Try common email-related table names
    const tableNames = [
        'leads', 'contacts', 'emails', 'email_campaigns', 'email_logs',
        'email_sent', 'sent_emails', 'email_analytics', 'campaigns',
        'email_templates', 'bounces', 'unsubscribed', 'subscribers',
        'outreach', 'prospects', 'email_tracking', 'messages',
        'whatsapp_leads', 'whatsapp_messages', 'call_logs',
        'properties', 'email_sequences', 'sequences'
    ];
    
    console.log('=== Checking all potential tables ===\n');
    
    for (const table of tableNames) {
        const { data, error } = await supabase.from(table).select('*').limit(2);
        if (!error) {
            console.log(`\n✅ TABLE: ${table}`);
            console.log(`   Columns: ${data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty table)'}`);
            if (data.length > 0) {
                console.log(`   Sample row:`, JSON.stringify(data[0], null, 2).substring(0, 500));
            }
        }
    }
}

checkAllTables().catch(console.error);
