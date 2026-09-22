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

async function checkEliminator() {
  const tourneyId = '74873ece-457d-4cb9-8f8b-439fc2044880';
  const { data: matches } = await client.from('matches').select('*').eq('tournament_id', tourneyId);
  console.log('Matches:', matches.map(m => ({ id: m.id, title: m.title, round: m.bracket_round, slot: m.bracket_slot, status: m.status })));
  
  for (const m of matches) {
    const { data: inn } = await client.from('innings').select('*').eq('match_id', m.id);
    if (inn && inn.length > 0) {
      console.log('--- Match:', m.title || m.id, 'Status:', m.status, 'Winner:', m.winner_id);
      for (const i of inn) {
        console.log(`  Innings ${i.innings_number}: total_runs=${i.total_runs}, wickets=${i.total_wickets}, balls=${i.balls_bowled}, target=${i.target}`);
        const { data: balls } = await client.from('ball_by_ball').select('*').eq('innings_id', i.id).order('created_at');
        console.log(`    Total balls in DB: ${balls?.length || 0}`);
        if (balls && balls.length > 0) {
          const last5 = balls.slice(-5);
          for (const b of last5) {
            console.log(`      Ball ${b.over_number}.${b.ball_number}: batsman=${b.batsman_id}, bowler=${b.bowler_id}, runs=${b.runs}, extras=${b.extras}, is_wicket=${b.is_wicket}, dismissal=${b.dismissal_type}, player_out=${b.player_out_id}, fielder=${b.fielder_id}`);
          }
        }
      }
    }
  }
}
checkEliminator();
