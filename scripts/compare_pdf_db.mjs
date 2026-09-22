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

const rawParsedPath = path.resolve(__dirname, 'all_parsed_matches.json');
const pdfMatches = JSON.parse(fs.readFileSync(rawParsedPath, 'utf-8'));

async function compareWithPdf() {
  console.log("=== COMPARING DATABASE SCORECARDS WITH PDF FILES ===");
  const { data: dbMatches } = await supabase.from('matches').select('*').eq('tournament_id', TOURNAMENT_ID).order('match_number');
  const { data: players } = await supabase.from('players').select('id, name');
  const playerMap = new Map(players.map(p => [p.id, p.name]));

  for (let idx = 0; idx < dbMatches.length; idx++) {
    const dbM = dbMatches[idx];
    const pdfM = pdfMatches[idx];
    console.log(`\n======================================================`);
    console.log(`MATCH #${dbM.match_number} (${pdfM.filename}): ${pdfM.team_a} vs ${pdfM.team_b}`);
    console.log(`======================================================`);

    const { data: inningsList } = await supabase.from('innings').select('*').eq('match_id', dbM.id).order('innings_number');
    for (const inn of inningsList) {
      const pdfInn = inn.innings_number === 1 ? pdfM.innings_1 : pdfM.innings_2;
      const { data: balls } = await supabase.from('ball_by_ball').select('*').eq('innings_id', inn.id);

      console.log(`\nInnings ${inn.innings_number} (${pdfInn.team_name}):`);
      console.log(`  PDF Total: ${pdfInn.total_runs}/${pdfInn.total_wickets} in ${pdfInn.overs} overs (Extras: ${pdfInn.extras.total})`);
      console.log(`  DB Total:  ${inn.total_runs}/${inn.total_wickets} in ${inn.overs_completed} overs (Extras: ${inn.extras}, Balls in DB: ${balls.length})`);

      // Compare Batters
      for (const pdfB of pdfInn.batting) {
        const pId = players.find(p => p.name === pdfB.name)?.id;
        const facedBalls = balls.filter(b => b.batsman_id === pId);
        const runsScored = facedBalls.reduce((sum, b) => sum + b.runs, 0);
        const legalBalls = facedBalls.filter(b => b.is_legal).length;
        const fours = facedBalls.filter(b => b.runs === 4).length;
        const sixes = facedBalls.filter(b => b.runs === 6).length;

        const matchRuns = runsScored === pdfB.runs;
        const matchBalls = legalBalls === pdfB.balls;
        const match4s = fours === pdfB.fours;
        const match6s = sixes === pdfB.sixes;

        if (!matchRuns || !matchBalls || !match4s || !match6s) {
          console.log(`  ⚠️ Batter Mismatch: ${pdfB.name} -> PDF: ${pdfB.runs}r (${pdfB.balls}b, ${pdfB.fours}x4, ${pdfB.sixes}x6) | DB Calc: ${runsScored}r (${legalBalls}b, ${fours}x4, ${sixes}x6)`);
        }
      }

      // Compare Bowlers
      for (const pdfBw of pdfInn.bowling) {
        const pId = players.find(p => p.name === pdfBw.name)?.id;
        const bowledBalls = balls.filter(b => b.bowler_id === pId);
        const wickets = bowledBalls.filter(b => b.is_wicket && b.dismissal_type !== 'run_out').length;
        const wides = bowledBalls.filter(b => b.extras_type === 'wide').length;
        const noBalls = bowledBalls.filter(b => b.extras_type === 'no_ball').length;
        const runsConceded = bowledBalls.reduce((sum, b) => sum + b.runs + b.extras, 0);

        if (wickets !== pdfBw.wickets || runsConceded !== pdfBw.runs) {
          console.log(`  ⚠️ Bowler Mismatch: ${pdfBw.name} -> PDF: ${pdfBw.wickets}w, ${pdfBw.runs}r | DB Calc: ${wickets}w, ${runsConceded}r`);
        }
      }
    }
  }
}

compareWithPdf().catch(console.error);
