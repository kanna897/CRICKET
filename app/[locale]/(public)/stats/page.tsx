import { PublicNav } from "@/components/public-nav";
import dynamic from "next/dynamic";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isActivePublicMatch, type PublicMatchVisibilityRow } from "@/lib/public-match-visibility";
import type { StatsMatchOption, StatsTeam } from "@/components/stats-match-analytics";

const TournamentStatisticsDashboard = dynamic(
  () => import("@/components/tournament-statistics-dashboard").then((module) => module.TournamentStatisticsDashboard),
  { loading: LoadingPanel },
);
const StatsMatchAnalytics = dynamic(
  () => import("@/components/stats-match-analytics").then((module) => module.StatsMatchAnalytics),
  { loading: LoadingPanel },
);

type StatsMatchQueryRow = StatsMatchOption & PublicMatchVisibilityRow;

export default async function PublicStatsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("matches")
    .select("id,tournament_id,team_a_id,team_b_id,status,match_scope,is_public,tournaments(deleted_at)")
    .in("status", ["live", "completed"])
    .order("created_at", { ascending: false });
  const matches = ((data ?? []) as StatsMatchQueryRow[]).filter(isActivePublicMatch);
  const teamIds = [...new Set(matches.flatMap((match) => [match.team_a_id, match.team_b_id]))];
  const { data: teamRows } = teamIds.length
    ? await supabase.from("teams").select("id,name").in("id", teamIds)
    : { data: [] };

  return <><PublicNav /><main className="p-4 py-7 sm:p-7"><TournamentStatisticsDashboard /><StatsMatchAnalytics initialMatches={matches} initialTeams={(teamRows ?? []) as StatsTeam[]} /></main></>;
}

function LoadingPanel() {
  return <div role="status" className="grid min-h-64 place-items-center text-muted-foreground">Loading statistics…</div>;
}
