import { notFound, redirect } from "next/navigation";
import { EditableTournament, TournamentEditor } from "@/components/tournament-editor";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function EditTournamentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const [{ data: profileData }, { data: tournamentData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
  ]);
  const profile = profileData as { role: string } | null;
  const tournament = tournamentData as unknown as (EditableTournament & { organizer_id: string }) | null;
  if (!tournament) notFound();
  if (resolveApplicationRole(profile?.role) !== "master_admin" && tournament.organizer_id !== user.id) redirect(`/${locale}/admin/tournaments`);
  return <TournamentEditor tournament={tournament} />;
}
