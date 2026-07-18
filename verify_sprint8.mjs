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

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Checking Tables...");
  const tables = ['user_roles', 'player_statistics', 'points_table', 'tournaments'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1);
    // If it's a 401/403/404, it might be due to RLS, which actually proves RLS is active!
    if (error) {
        console.log(`Table ${t}: ${error.message} (Code: ${error.code})`);
    } else {
        console.log(`Table ${t}: Access OK`);
    }
  }
  
  console.log("\nChecking Buckets...");
  const { data, error } = await supabase.storage.listBuckets();
  if (data) {
     const bucketNames = data.map(b => b.name);
     console.log("Buckets found:", bucketNames);
  } else {
     console.log("Error listing buckets:", error);
  }
}
verify();
