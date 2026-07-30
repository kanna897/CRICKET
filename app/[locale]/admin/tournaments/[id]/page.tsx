import { notFound, redirect } from "next/navigation";
import { EditableTournament, TournamentEditor } from "@/components/tournament-editor";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function EditTournamentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: profileData }, { data: tournamentData }, { data: teamRows }, { data: matchRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
    supabase.from("teams").select("id").eq("tournament_id", id),
    supabase.from("matches").select("id,status").eq("tournament_id", id),
  ]);
  const profile = profileData;
  const tournament: (EditableTournament & { organizer_id: string }) | null = tournamentData;
  if (!tournament) notFound();
  if (resolveApplicationRole(profile?.role) !== "master_admin" && tournament.organizer_id !== user.id) redirect(`/${locale}/admin/tournaments`);
  const teamIds = (teamRows || []).map((team) => team.id);
  const { count: playerCount } = teamIds.length
    ? await supabase.from("players").select("id", { count: "exact", head: true }).in("team_id", teamIds)
    : { count: 0 };
  const matches = (matchRows || []) as Array<{ id: string; status: string }>;
  return <TournamentEditor tournament={tournament} snapshot={{
    teams: teamIds.length,
    players: playerCount || 0,
    matches: matches.length,
    scheduled: matches.filter((match) => match.status === "scheduled").length,
    live: matches.filter((match) => match.status === "live").length,
    completed: matches.filter((match) => match.status === "completed").length,
  }} />;
}
