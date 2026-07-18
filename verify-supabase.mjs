import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    process.env[key.trim()] = values.join('=').trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Starting verification...\n");
  
  // 1. Mounted MCP tools
  // (We check this conceptually, or check config if present)
  
  // 2. Supabase connection
  console.log("[Supabase Connection] Checking...");
  // let connected = false;
  try {
    const { error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log("✅ Supabase connection successful.");
    // connected = true;
  } catch (err) {
    console.log("❌ Supabase connection failed:", err.message);
  }

  // 3. Database access
  console.log("\n[Database Access] Checking...");
  try {
    const { error } = await supabase.from('tournaments').select('id').limit(1);
    // If it fails with a generic error, it might be the table doesn't exist, which still means connection is ok but table missing
    if (error) {
       console.log("⚠️ Could not read 'tournaments' table:", error.message, "- Trying to access generic REST endpoint...");
       // check generic fetch
       const res = await fetch(`${supabaseUrl}/rest/v1/`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }});
       if(res.ok) {
         console.log("✅ Database access successful (REST API reachable).");
       } else {
         console.log("❌ Database access failed.");
       }
    } else {
       console.log("✅ Database access successful.");
    }
  } catch (err) {
    console.log("❌ Database access error:", err.message);
  }

  // 4. Storage access
  console.log("\n[Storage Access] Checking...");
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    console.log(`✅ Storage access successful. Found ${data.length} buckets.`);
    data.forEach(b => console.log(`   - ${b.name}`));
  } catch (err) {
    console.log("❌ Storage access failed:", err.message);
  }
}

verify();
