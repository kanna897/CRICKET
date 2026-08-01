import type { SupabaseClient } from "@supabase/supabase-js";
import { loserOf, type IplPlayoffMatch } from "@/lib/ipl-playoffs";

type TournamentSettings = { overs: number | null; venue: string | null; organizer_id: string | null };

function nextDate(value: string | null, days = 1) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function syncIplPlayoffMatches(supabase: SupabaseClient, tournamentId: string) {
  const [{ data: rows, error }, { data: tournament }] = await Promise.all([
    supabase.from("matches").select("id,team_a_id,team_b_id,winner_id,status,bracket_round,bracket_slot,match_date").eq("tournament_id", tournamentId).eq("competition_stage", "knockout").order("bracket_round").order("bracket_slot"),
    supabase.from("tournaments").select("overs,venue,organizer_id").eq("id", tournamentId).maybeSingle(),
  ]);
  if (error) throw error;
  const matches = (rows || []) as IplPlayoffMatch[];
  const semiFinals = matches.filter((match) => match.bracket_round === 10).sort((a, b) => a.bracket_slot - b.bracket_slot);
  const knockoutFinal = matches.find((match) => match.bracket_round === 11 && match.bracket_slot === 1);
  const settings = tournament as TournamentSettings | null;
  if (semiFinals.length === 2 && semiFinals.every((match) => match.winner_id) && !knockoutFinal) {
    const { error: insertError } = await supabase.from("matches").insert({
      tournament_id: tournamentId, team_a_id: semiFinals[0].winner_id, team_b_id: semiFinals[1].winner_id,
      match_date: nextDate(semiFinals[1].match_date), overs_per_match: settings?.overs || 20,
      ground: settings?.venue || null, status: "scheduled", competition_stage: "knockout",
      bracket_round: 11, bracket_slot: 1, assigned_scorer_id: settings?.organizer_id || null, scoring_locked: false,
    });
    if (insertError) throw insertError;
    return;
  }
  if (semiFinals.length) return;
  const q1 = matches.find((match) => match.bracket_round === 1 && match.bracket_slot === 1);
  const eliminator = matches.find((match) => match.bracket_round === 1 && match.bracket_slot === 2);
  const q2 = matches.find((match) => match.bracket_round === 2 && match.bracket_slot === 1);
  if (q1?.winner_id && eliminator?.winner_id && !q2) {
    const { error: insertError } = await supabase.from("matches").insert({
      tournament_id: tournamentId, team_a_id: loserOf(q1), team_b_id: eliminator.winner_id,
      match_date: nextDate(eliminator.match_date), overs_per_match: settings?.overs || 20,
      ground: settings?.venue || null, status: "scheduled", competition_stage: "knockout",
      bracket_round: 2, bracket_slot: 1, assigned_scorer_id: settings?.organizer_id || null, scoring_locked: false,
    });
    if (insertError) throw insertError;
  }
  const refreshedQ2 = q2 || (q1?.winner_id && eliminator?.winner_id ? (await supabase.from("matches").select("id,team_a_id,team_b_id,winner_id,status,bracket_round,bracket_slot,match_date").eq("tournament_id", tournamentId).eq("competition_stage", "knockout").eq("bracket_round", 2).eq("bracket_slot", 1).maybeSingle()).data as IplPlayoffMatch | null : null);
  const final = matches.find((match) => match.bracket_round === 3 && match.bracket_slot === 1);
  if (q1?.winner_id && refreshedQ2?.winner_id && !final) {
    const { error: insertError } = await supabase.from("matches").insert({
      tournament_id: tournamentId, team_a_id: q1.winner_id, team_b_id: refreshedQ2.winner_id,
      match_date: nextDate(refreshedQ2.match_date), overs_per_match: settings?.overs || 20,
      ground: settings?.venue || null, status: "scheduled", competition_stage: "knockout",
      bracket_round: 3, bracket_slot: 1, assigned_scorer_id: settings?.organizer_id || null, scoring_locked: false,
    });
    if (insertError) throw insertError;
  }
}
