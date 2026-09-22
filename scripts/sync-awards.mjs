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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const TOURNAMENT_ID = '74873ece-457d-4cb9-8f8b-439fc2044880';
const ADMIN_EMAIL = 'crickpulse2026@gmail.com';
const ADMIN_PASSWORD = 'CrickAdmin26@#';

async function syncAwardsAndStats() {
  console.log('🔑 Authenticating...');
  await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  const { data: matches } = await supabase.from('matches').select('*').eq('tournament_id', TOURNAMENT_ID);
  
  // Clear old awards for this tourney
  await supabase.from('awards').delete().eq('tournament_id', TOURNAMENT_ID);

  console.log('🏅 Inserting Player of the Match awards...');
  for (const m of matches) {
    if (m.player_of_match_id) {
      const { error } = await supabase.from('awards').insert({
        tournament_id: TOURNAMENT_ID,
        player_id: m.player_of_match_id,
        award_type: 'player_of_the_match'
      });
      if (error) console.error('Error inserting award:', error);
    }
  }

  const { count: awardsCount } = await supabase.from('awards').select('id', { count: 'exact', head: true }).eq('tournament_id', TOURNAMENT_ID);
  console.log(`✅ Total Awards in DB: ${awardsCount}`);
}

syncAwardsAndStats().catch(console.error);
