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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const dataPath = path.resolve(__dirname, 'exact_parsed_matches_with_balls.json');
const matchesData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const TOURNAMENT_ID = '74873ece-457d-4cb9-8f8b-439fc2044880';
const ADMIN_EMAIL = 'crickpulse2026@gmail.com';
const ADMIN_PASSWORD = 'CrickAdmin26@#';

async function main() {
  console.log('🔑 Authenticating as Admin (' + ADMIN_EMAIL + ')...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  if (authError || !authData.user) {
    console.error('❌ Admin authentication failed:', authError);
    process.exit(1);
  }
  console.log(`✅ Authenticated successfully as user ID: ${authData.user.id}`);
  const userId = authData.user.id;

  // 1. Verify tournament
  const { data: tourney, error: tErr } = await supabase
    .from('tournaments')
    .select('id, name, organizer_id')
    .eq('id', TOURNAMENT_ID)
    .single();

  if (tErr || !tourney) {
    console.error('❌ Tournament not found:', tErr);
    process.exit(1);
  }
  console.log(`✅ Target Tournament: "${tourney.name}" (${tourney.id})`);

  // 2. Clean prior match data if any
  const { data: oldMatches } = await supabase.from('matches').select('id').eq('tournament_id', TOURNAMENT_ID);
  if (oldMatches && oldMatches.length > 0) {
    console.log(`🧹 Removing ${oldMatches.length} old matches for clean import...`);
    for (const om of oldMatches) {
      await supabase.from('matches').delete().eq('id', om.id);
    }
  }

  // 3. Setup Teams
  const teamNames = ['AVENGERS', 'RISING TITANS', 'ROYAL STRIKERS', 'PRIME XI'];
  const teamMap = new Map();

  for (let i = 0; i < teamNames.length; i++) {
    const tName = teamNames[i];
    let { data: existingTeam } = await supabase
      .from('teams')
      .select('id, name')
      .eq('tournament_id', TOURNAMENT_ID)
      .eq('name', tName)
      .maybeSingle();

    if (!existingTeam) {
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({
          tournament_id: TOURNAMENT_ID,
          name: tName,
          team_name: tName,
          fixture_order: i + 1,
          organizer_id: userId
        })
        .select('id, name')
        .single();

      if (teamErr) {
        console.error(`❌ Failed to create team ${tName}:`, teamErr);
        process.exit(1);
      }
      existingTeam = newTeam;

      // Link in tournament_teams
      await supabase.from('tournament_teams').insert({
        tournament_id: TOURNAMENT_ID,
        team_id: existingTeam.id
      }).maybeSingle();
    }
    teamMap.set(tName, existingTeam.id);
    console.log(`✅ Team confirmed: ${tName} -> ${existingTeam.id}`);
  }

  // 4. Setup Players
  const playerMap = new Map();
  const teamRosters = new Map();
  for (const tName of teamNames) teamRosters.set(tName, new Set());

  for (const m of matchesData) {
    for (const b of m.innings_1.batting) teamRosters.get(m.team_a)?.add(b.name);
    for (const b of m.innings_2.batting) teamRosters.get(m.team_b)?.add(b.name);
    for (const b of m.innings_1.bowling) teamRosters.get(m.team_b)?.add(b.name);
    for (const b of m.innings_2.bowling) teamRosters.get(m.team_a)?.add(b.name);
    for (const b of m.innings_1.batting) {
      if (b.bowler) teamRosters.get(m.team_b)?.add(b.bowler);
      if (b.fielder) teamRosters.get(m.team_b)?.add(b.fielder);
    }
    for (const b of m.innings_2.batting) {
      if (b.bowler) teamRosters.get(m.team_a)?.add(b.bowler);
      if (b.fielder) teamRosters.get(m.team_a)?.add(b.fielder);
    }
  }

  let phoneCounter = 770100000;
  for (const [tName, playersSet] of teamRosters.entries()) {
    const teamId = teamMap.get(tName);
    console.log(`\nRegistering players for ${tName} (${playersSet.size} players)...`);

    for (const pName of playersSet) {
      let { data: existingPlayer } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)
        .eq('name', pName)
        .maybeSingle();

      if (!existingPlayer) {
        phoneCounter++;
        const phone = `+94${phoneCounter}`;
        const { data: newPlayer, error: pErr } = await supabase
          .from('players')
          .insert({
            team_id: teamId,
            name: pName,
            player_name: pName,
            role: 'all-rounder',
            playing_role: 'all_rounder',
            phone_number: phone,
            contact_number: phone
          })
          .select('id, name')
          .single();

        if (pErr) {
          console.error(`❌ Failed to create player ${pName} for ${tName}:`, pErr);
        } else {
          existingPlayer = newPlayer;
        }
      }

      if (existingPlayer) {
        playerMap.set(`${tName}:${pName}`, existingPlayer.id);
        playerMap.set(pName, existingPlayer.id);
      }
    }
  }

  console.log(`\n✅ Registered all team players (Player map size: ${playerMap.size})`);

  function getPlayerId(name, preferredTeam = null) {
    if (!name) return null;
    if (preferredTeam && playerMap.has(`${preferredTeam}:${name}`)) {
      return playerMap.get(`${preferredTeam}:${name}`);
    }
    return playerMap.get(name) || null;
  }

  // 5. Import Matches, Innings, Ball-by-Ball
  for (let mIdx = 0; mIdx < matchesData.length; mIdx++) {
    const m = matchesData[mIdx];
    const teamAId = teamMap.get(m.team_a);
    const teamBId = teamMap.get(m.team_b);
    const winnerId = teamMap.get(m.winner) || null;
    const tossWinnerId = teamMap.get(m.toss_winner) || null;
    const potmId = getPlayerId(m.potm, m.winner);

    const matchNumber = mIdx + 1;
    const isPlayoff = m.stage === 'playoff';

    console.log(`\n--------------------------------------------------`);
    console.log(`Importing Match #${matchNumber}: ${m.team_a} vs ${m.team_b} (${m.stage.toUpperCase()})`);

    // Insert Match
    const { data: matchRecord, error: mInsertErr } = await supabase
      .from('matches')
      .insert({
        tournament_id: TOURNAMENT_ID,
        organizer_id: userId,
        team_a_id: teamAId,
        team_b_id: teamBId,
        match_number: matchNumber,
        match_type: 'tournament',
        match_scope: 'tournament',
        competition_stage: isPlayoff ? 'knockout' : 'league',
        title: isPlayoff ? 'Qualifier 1' : `League Match ${matchNumber}`,
        status: 'completed',
        match_date: m.date,
        match_time: m.time,
        overs_per_match: 8,
        balls_per_over: 6,
        wickets_per_innings: 10,
        toss_winner_id: tossWinnerId,
        toss_decision: m.toss_decision,
        winner_id: winnerId,
        result_type: 'win',
        player_of_match_id: potmId,
        player_of_match_summary: `${m.potm} (${m.winner})`
      })
      .select('id')
      .single();

    if (mInsertErr || !matchRecord) {
      console.error(`❌ Failed to insert match #${matchNumber}:`, mInsertErr);
      continue;
    }

    const matchId = matchRecord.id;
    console.log(`✅ Match created: ${matchId}`);

    // Insert POTM Award
    if (potmId) {
      await supabase.from('awards').insert({
        tournament_id: TOURNAMENT_ID,
        player_id: potmId,
        category: 'Player of the Match',
        description: `Match #${matchNumber}: ${m.team_a} vs ${m.team_b}`
      });
    }

    // Insert Innings 1 & 2
    const inningsList = [
      { num: 1, data: m.innings_1, battingTeam: m.team_a, bowlingTeam: m.team_b, battingId: teamAId, bowlingId: teamBId },
      { num: 2, data: m.innings_2, battingTeam: m.team_b, bowlingTeam: m.team_a, battingId: teamBId, bowlingId: teamAId }
    ];

    for (const inn of inningsList) {
      const innData = inn.data;
      const ballsBowled = Math.round(Math.floor(innData.overs) * 6 + ((innData.overs % 1) * 10));

      const strikerId = getPlayerId(innData.batting[0]?.name, inn.battingTeam);
      const nonStrikerId = getPlayerId(innData.batting[1]?.name, inn.battingTeam);
      const bowlerId = getPlayerId(innData.bowling[0]?.name, inn.bowlingTeam);

      const { data: innRecord, error: innErr } = await supabase
        .from('innings')
        .insert({
          match_id: matchId,
          innings_number: inn.num,
          batting_team_id: inn.battingId,
          bowling_team_id: inn.bowlingId,
          total_runs: innData.total_runs,
          total_wickets: innData.total_wickets,
          balls_bowled: ballsBowled,
          overs_completed: innData.overs,
          extras: innData.extras.total,
          is_completed: true,
          striker_id: strikerId,
          non_striker_id: nonStrikerId,
          current_bowler_id: bowlerId
        })
        .select('id')
        .single();

      if (innErr || !innRecord) {
        console.error(`❌ Failed to insert innings ${inn.num} for match #${matchNumber}:`, innErr);
        continue;
      }

      const inningsId = innRecord.id;
      console.log(`  ✅ Innings ${inn.num} inserted (${innData.total_runs}/${innData.total_wickets} in ${innData.overs} ov) -> ID: ${inningsId}`);

      // Insert Deliveries in batches
      const ballRows = innData.deliveries.map((deliv) => {
        const batsmanId = getPlayerId(deliv.batsman_name, inn.battingTeam);
        const nonStrikerBallId = getPlayerId(deliv.non_striker_name, inn.battingTeam);
        const delivBowlerId = getPlayerId(deliv.bowler_name, inn.bowlingTeam);
        const playerOutId = deliv.player_out_name ? getPlayerId(deliv.player_out_name, inn.battingTeam) : null;
        const fielderId = deliv.fielder_name ? getPlayerId(deliv.fielder_name, inn.bowlingTeam) : null;

        return {
          innings_id: inningsId,
          over_number: deliv.over_number,
          ball_number: deliv.ball_number,
          batsman_id: batsmanId,
          non_striker_id: nonStrikerBallId,
          bowler_id: delivBowlerId,
          runs: deliv.runs,
          extras: deliv.extras,
          extras_type: deliv.extras_type,
          is_wicket: deliv.is_wicket,
          is_legal: deliv.is_legal,
          dismissal_type: deliv.dismissal_type,
          player_out_id: playerOutId,
          fielder_id: fielderId,
          commentary: deliv.is_wicket
            ? `WICKET! ${deliv.player_out_name} is ${deliv.dismissal_type?.replace('_', ' ')}`
            : deliv.runs === 6 ? 'SIX! Smashed over the boundary!'
            : deliv.runs === 4 ? 'FOUR! Beautiful boundary shot!'
            : deliv.extras > 0 ? `${deliv.extras_type?.toUpperCase()} delivery`
            : `${deliv.runs} run${deliv.runs === 1 ? '' : 's'}`
        };
      });

      for (let c = 0; c < ballRows.length; c += 50) {
        const chunk = ballRows.slice(c, c + 50);
        const { error: bErr } = await supabase.from('ball_by_ball').insert(chunk);
        if (bErr) {
          console.error(`  ❌ Error inserting ball batch at ${c}:`, bErr);
        }
      }
      console.log(`  ✅ Inserted ${ballRows.length} deliveries for Innings ${inn.num}`);
    }

    // Match Squads & Playing XI
    const squadInserts = [];
    const playingXiInserts = [];

    for (const b of m.innings_1.batting) {
      const pId = getPlayerId(b.name, m.team_a);
      if (pId) {
        squadInserts.push({ match_id: matchId, player_id: pId, team_id: teamAId, is_captain: false });
        playingXiInserts.push({ match_id: matchId, player_id: pId, team_id: teamAId, is_playing: true });
      }
    }
    for (const b of m.innings_2.batting) {
      const pId = getPlayerId(b.name, m.team_b);
      if (pId) {
        squadInserts.push({ match_id: matchId, player_id: pId, team_id: teamBId, is_captain: false });
        playingXiInserts.push({ match_id: matchId, player_id: pId, team_id: teamBId, is_playing: true });
      }
    }

    if (squadInserts.length > 0) {
      await supabase.from('match_squads').insert(squadInserts).maybeSingle();
      await supabase.from('playing_xi').insert(playingXiInserts).maybeSingle();
    }
  }

  // 6. Update Tournament status
  await supabase.from('tournaments').update({ status: 'completed' }).eq('id', TOURNAMENT_ID);
  console.log('\n========================================================');
  console.log('🎉 ALL 7 MATCHES SUCCESSFULLY IMPORTED INTO DATABASE!');
  console.log('========================================================');
}

main().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
