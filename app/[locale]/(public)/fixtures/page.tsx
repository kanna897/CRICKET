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
};

export default async function FixturesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("matches")
    .select("id,tournament_id,team_a_id,team_b_id,status,match_date,match_time,ground,overs_per_match,match_scope,match_type,title,tournaments(deleted_at)")
    .eq("is_public", true)
    .order("match_date");
  const matches = ((data ?? []) as FixtureMatch[]).filter(isActivePublicMatch);
  const teamIds = [...new Set(matches.flatMap((match) => [match.team_a_id, match.team_b_id]))];
  const { data: teamRows } = teamIds.length
    ? await supabase.from("teams").select("id,name,logo_url").in("id", teamIds)
    : { data: [] };

  return <FixturesClient initialMatches={matches} initialTeams={(teamRows ?? []) as FixtureTeam[]} />;
}
