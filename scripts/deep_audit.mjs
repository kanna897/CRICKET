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

async function audit() {
  console.log("=== TOURNAMENT AUDIT ===");
  const { data: tourney } = await supabase.from('tournaments').select('*').eq('id', TOURNAMENT_ID).single();
  console.log("Tournament:", tourney.name, "| Status:", tourney.status, "| Overs:", tourney.overs);

  const { data: teams } = await supabase.from('teams').select('*').eq('tournament_id', TOURNAMENT_ID);
  console.log("\nTeams:", teams.map(t => `${t.name} (id: ${t.id})`));

  const { data: matches } = await supabase.from('matches').select('*').eq('tournament_id', TOURNAMENT_ID).order('match_number');
  console.log("\nMatches count:", matches.length);
  for (const m of matches) {
    const tA = teams.find(t => t.id === m.team_a_id)?.name;
    const tB = teams.find(t => t.id === m.team_b_id)?.name;
    const win = teams.find(t => t.id === m.winner_id)?.name;
    const { data: inngs } = await supabase.from('innings').select('*').eq('match_id', m.id).order('innings_number');
    console.log(`\nMatch #${m.match_number} (${m.competition_stage}): ${tA} vs ${tB} | Winner: ${win} | Date: ${m.match_date} ${m.match_time}`);
    for (const inn of inngs) {
      const batTeam = teams.find(t => t.id === inn.batting_team_id)?.name;
      const { count: ballCount } = await supabase.from('ball_by_ball').select('id', { count: 'exact', head: true }).eq('innings_id', inn.id);
      console.log(`   Inn ${inn.innings_number}: ${batTeam} -> ${inn.total_runs}/${inn.total_wickets} (${inn.overs_completed} ov, ${ballCount} balls)`);
    }
  }

  const { data: players } = await supabase.from('players').select('id, name, team_id');
  console.log(`\nTotal players in DB: ${players.length}`);
}

audit();
