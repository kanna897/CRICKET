import FixturesClient from "./fixtures-client";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isActivePublicMatch, type PublicMatchVisibilityRow } from "@/lib/public-match-visibility";

type FixtureTeam = { id: string; name: string; logo_url: string | null };
type FixtureMatch = PublicMatchVisibilityRow & {
  team_a_id: string;
  team_b_id: string;
  status: string;
  match_date: string | null;
  match_time: string | null;
  ground: string | null;
  overs_per_match: number;
  match_scope: string;
  match_type: string;
  title: string | null;
  fixture_round: number | null;
  match_number: number | null;
};

export default async function FixturesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("matches")
    .select("id,tournament_id,team_a_id,team_b_id,status,match_date,match_time,ground,overs_per_match,match_scope,match_type,title,fixture_round,match_number,tournaments(deleted_at)")
    .eq("is_public", true)
    .order("match_date");
  const matches = ((data ?? []) as FixtureMatch[]).filter(isActivePublicMatch);
  const teamIds = [...new Set(matches.flatMap((match) => [match.team_a_id, match.team_b_id]))];
  const tournamentIds = [...new Set(matches.map((match) => match.tournament_id).filter(Boolean) as string[])];
  const [teamResult, tournamentResult] = await Promise.all([
    teamIds.length ? supabase.from("teams").select("id,name,logo_url").in("id", teamIds) : Promise.resolve({ data: [] }),
    tournamentIds.length ? supabase.from("tournaments").select("id,name").in("id", tournamentIds).is("deleted_at", null) : Promise.resolve({ data: [] }),
  ]);
  const tournamentNames = new Map((tournamentResult.data ?? []).map((tournament) => [tournament.id, tournament.name]));
  const displayMatches = matches.map((match) => ({ ...match, tournament_name: match.tournament_id ? tournamentNames.get(match.tournament_id) || "Tournament" : null }));

  return <FixturesClient initialMatches={displayMatches} initialTeams={(teamResult.data ?? []) as FixtureTeam[]} />;
}
