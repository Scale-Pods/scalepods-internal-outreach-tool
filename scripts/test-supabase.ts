import { createClient } from "@supabase/supabase-js";

const url = "https://sezrqpphfafjbnhuypji.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlenJxcHBoZmFmamJuaHV5cGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUwMTU1NCwiZXhwIjoyMDkwMDc3NTU0fQ.rrPNJxELHXaKXsjhWApvwEPxGwMCGYSURaohzqVry9I";
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from("leads_scraper_gmap")
    .select("*", { count: "exact", head: false });

  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log("Total rows:", data?.length);
  }
}

test();
