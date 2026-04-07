const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sezrqpphfafjbnhuypji.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenJxcHBoZmFmamJuaHV5cGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUwMTU1NCwiZXhwIjoyMDkwMDc3NTU0fQ.rrPNJxELHXaKXsjhWApvwEPxGwMCGYSURaohzqVry9I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const users = [
    { email: 'raunak@scalepods.co', password: 'raunak@scalepods', full_name: 'Raunak' },
    { email: 'adnan@scalepods.co', password: 'adnan@scalepods', full_name: 'Adnan' },
    { email: 'info@scalepods.co', password: 'ScalePods@123', full_name: 'ScalePods Info' },
];

async function seedUsers() {
    console.log('Seeding users...\n');

    for (const user of users) {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(user.password, salt);

        // Check if user already exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single();

        if (existing) {
            // Update the password
            const { error } = await supabase
                .from('users')
                .update({ password_hash, full_name: user.full_name })
                .eq('email', user.email);

            if (error) {
                console.error(`Error updating ${user.email}:`, error.message);
            } else {
                console.log(`Updated: ${user.email}`);
            }
        } else {
            // Insert new user
            const { error } = await supabase
                .from('users')
                .insert([{
                    email: user.email,
                    password_hash,
                    full_name: user.full_name,
                }]);

            if (error) {
                console.error(`Error creating ${user.email}:`, error.message);
            } else {
                console.log(`Created: ${user.email}`);
            }
        }
    }

    console.log('\nDone! All users seeded.');
}

seedUsers().catch(console.error);
