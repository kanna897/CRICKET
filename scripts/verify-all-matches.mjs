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

async function verifyAllMatches() {
  const tourneyId = '74873ece-457d-4cb9-8f8b-439fc2044880';
  const { data: teams } = await client.from('teams').select('id, name').eq('tournament_id', tourneyId);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
  
  const { data: matches } = await client.from('matches')
    .select('id, title, team_a_id, team_b_id, winner_id, status, overs_per_match, wickets_per_innings, match_date, player_of_match_id, player_of_match_summary, competition_stage, bracket_round, bracket_slot')
    .eq('tournament_id', tourneyId)
    .order('created_at');

  console.log('--- ALL MATCHES CHECK ---');
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const { data: innings } = await client.from('innings')
      .select('id, innings_number, batting_team_id, bowling_team_id, total_runs, total_wickets, balls_bowled, target')
      .eq('match_id', m.id)
      .order('innings_number');

    const inn1 = innings?.find(inn => inn.innings_number === 1);
    const inn2 = innings?.find(inn => inn.innings_number === 2);
    
    let resultText = '';
    const winnerName = teamMap[m.winner_id] || 'TBD';
    if (!m.winner_id) {
      resultText = m.status === 'completed' ? 'Match tied.' : 'Scheduled';
    } else if (inn2 && inn2.batting_team_id === m.winner_id) {
      const maxWickets = m.wickets_per_innings || 10;
      const wicketsRemaining = Math.max(maxWickets - (inn2.total_wickets || 0), 0);
      resultText = `${winnerName} win by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}.`;
    } else if (inn1 && inn2) {
      const runMargin = Math.max((inn1.total_runs || 0) - (inn2.total_runs || 0), 0);
      resultText = `${winnerName} win by ${runMargin} run${runMargin === 1 ? '' : 's'}.`;
    }

    const { data: pom } = m.player_of_match_id ? await client.from('players').select('name').eq('id', m.player_of_match_id).single() : { data: null };

    console.log(`\nMatch #${i+1} [${m.competition_stage.toUpperCase()}] ID: ${m.id}`);
    console.log(`  Title: ${m.title || 'N/A'}`);
    console.log(`  Teams: ${teamMap[m.team_a_id]} vs ${teamMap[m.team_b_id]}`);
    if (inn1) console.log(`  Innings 1: ${teamMap[inn1.batting_team_id]} -> ${inn1.total_runs}/${inn1.total_wickets} (${Math.floor(inn1.balls_bowled/6)}.${inn1.balls_bowled%6} ov)`);
    if (inn2) console.log(`  Innings 2: ${teamMap[inn2.batting_team_id]} -> ${inn2.total_runs}/${inn2.total_wickets} (${Math.floor(inn2.balls_bowled/6)}.${inn2.balls_bowled%6} ov) [Target: ${inn2.target}]`);
    console.log(`  Status: ${m.status}`);
    console.log(`  Winner: ${winnerName}`);
    console.log(`  Result Banner: "${resultText}"`);
    console.log(`  Player of Match: ${pom?.name || 'N/A'} (${m.player_of_match_summary || ''})`);
  }
}
verifyAllMatches();
