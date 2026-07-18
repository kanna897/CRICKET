// import { supabase } from "./supabase";

/**
 * Awards Engine
 * Automatically calculates tournament awards based on statistics.
 */

export async function calculateTournamentAwards(tournamentId: string) {
  // 1. Fetch all players and their cumulative stats in the given tournament
  // This would typically involve an aggregation query from the ball_by_ball and matches tables.
  
  // For the sake of MVP skeleton, we define the logic structure.
  
  // Example Aggregation Logic (In reality, we'd use a Supabase RPC / SQL View for performance):
  // const { data: stats } = await supabase.rpc('get_tournament_player_stats', { t_id: tournamentId });
  
  // 2. Identify Orange Cap (Most Runs)
  // const orangeCap = stats.sort((a, b) => b.total_runs - a.total_runs)[0];
  
  // 3. Identify Purple Cap (Most Wickets)
  // const purpleCap = stats.sort((a, b) => b.total_wickets - a.total_wickets)[0];
  
  // 4. Identify Highest Score
  // const highestScore = stats.sort((a, b) => b.highest_score - a.highest_score)[0];
  
  // 5. Update the Awards table
  
  /*
  const awardsToInsert = [
    { tournament_id: tournamentId, category: 'Orange Cap', player_id: orangeCap.player_id, description: `${orangeCap.total_runs} Runs` },
    { tournament_id: tournamentId, category: 'Purple Cap', player_id: purpleCap.player_id, description: `${purpleCap.total_wickets} Wickets` }
  ];
  
  await supabase.from('awards').delete().eq('tournament_id', tournamentId); // Clear old
  await supabase.from('awards').insert(awardsToInsert);
  */
  
  console.log(`Calculated awards for tournament ${tournamentId}`);
}

export async function calculateMatchAwards(matchId: string) {
  // 1. Fetch all performances in the specific match
  // 2. Algorithm to determine Player of the Match:
  //    (Runs * 1) + (Wickets * 20) + (Catches * 10) + Bonus for StrikeRate/Economy
  
  // 3. Update the matches table with player_of_match_id
  
  console.log(`Calculated Player of the Match for ${matchId}`);
}
