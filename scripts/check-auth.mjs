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

async function check() {
  const { data: tourney } = await client.from('tournaments').select('*').eq('id', '74873ece-457d-4cb9-8f8b-439fc2044880').single();
  console.log('Tournament:', tourney);

  const { data: profiles, error: pErr } = await client.from('profiles').select('id, role, email');
  console.log('Profiles:', profiles, pErr);
}

check();
