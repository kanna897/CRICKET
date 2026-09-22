import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) env[key.trim()] = values.join('=').trim();
});

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: tournaments, error } = await client
    .from('tournaments')
    .select('*')
    .is('deleted_at', null);

  console.log('--- Tournaments in DB ---');
  if (error) console.error('Error fetching tournaments:', error);
  else {
    for (const t of tournaments) {
      console.log(`ID: ${t.id} | Name: "${t.name}" | Status: ${t.status} | Overs: ${t.overs || t.overs_per_match}`);
      const { data: teams } = await client.from('teams').select('id, name').eq('tournament_id', t.id).is('deleted_at', null);
      console.log(`  Teams (${teams?.length || 0}):`, teams?.map(tm => tm.name).join(', '));
      const { count } = await client.from('matches').select('id', { count: 'exact', head: true }).eq('tournament_id', t.id);
      console.log(`  Existing Matches: ${count}`);
    }
  }
}

run();
