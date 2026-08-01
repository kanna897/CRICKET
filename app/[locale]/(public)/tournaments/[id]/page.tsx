import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { IplPlayoffRoadmap } from "@/components/ipl-playoff-roadmap";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { IplPlayoffMatch } from "@/lib/ipl-playoffs";

type Tournament = { id: string; name: string; logo_url: string | null; venue: string | null; start_date: string | null; end_date: string | null; status: string | null; overs: number | null; ball_type: string | null };
type Team = { id: string; name: string; logo_url: string | null };
type Match = IplPlayoffMatch & { match_time: string | null; competition_stage: string };

export default async function PublicTournamentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createSupabaseServerClient();
  const [tournamentResult, teamsResult, matchesResult] = await Promise.all([
    supabase.from("tournaments").select("id,name,logo_url,venue,start_date,end_date,status,overs,ball_type").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("teams").select("id,name,logo_url").eq("tournament_id", id).is("deleted_at", null).order("name"),
    supabase.from("matches").select("id,team_a_id,team_b_id,match_date,match_time,status,winner_id,competition_stage,bracket_round,bracket_slot").eq("tournament_id", id).order("match_date"),
  ]);
  if (!tournamentResult.data) notFound();
  const tournament = tournamentResult.data as Tournament;
  const teams = (teamsResult.data ?? []) as Team[];
  const matches = (matchesResult.data ?? []) as Match[];
  const playoffs = matches.filter((match) => match.competition_stage === "knockout");
  const team = (teamId: string) => teams.find((item) => item.id === teamId);

  return <><PublicNav/><main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-7">
    <Link href={`/${locale}/tournaments`} className="inline-flex items-center gap-2 font-bold text-primary"><ArrowLeft className="h-4 w-4"/>All tournaments</Link>
    <section className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-[#07162f] via-[#0b2d59] to-[#073c3a] p-5 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center">{tournament.logo_url ? <Image unoptimized width={128} height={128} src={tournament.logo_url} alt="" className="h-24 w-24 rounded-3xl bg-white object-contain p-2"/> : <span className="grid h-24 w-24 place-items-center rounded-3xl bg-white/10"><Trophy className="h-12 w-12 text-amber-300"/></span>}<div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-200">{tournament.status}</span><h1 className="mt-3 text-3xl font-black sm:text-4xl">{tournament.name}</h1><div className="mt-3 flex flex-wrap gap-4 text-sm text-cyan-100"><span className="flex items-center gap-1"><MapPin className="h-4 w-4"/>{tournament.venue || "Venue TBC"}</span><span className="flex items-center gap-1"><CalendarDays className="h-4 w-4"/>{tournament.start_date || "Date TBC"}</span><span>{tournament.overs} overs · {tournament.ball_type || "Cricket ball"}</span></div></div></div></section>
    {playoffs.length > 0 && <section><div className="mb-3"><p className="text-xs font-black uppercase tracking-[.2em] text-primary">Live tournament path</p><h2 className="text-2xl font-black">Playoff Match Roadmap</h2></div><IplPlayoffRoadmap tournamentId={id} tournamentName={tournament.name} tournamentLogo={tournament.logo_url} teams={teams} matches={playoffs} publicMode/></section>}
    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary"/><h2 className="text-xl font-black">Participating teams</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{teams.map((item) => <Link key={item.id} href={`/${locale}/teams/${item.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/50">{item.logo_url ? <Image unoptimized width={128} height={128} src={item.logo_url} alt="" className="h-11 w-11 rounded-full bg-white object-contain"/> : <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 font-black text-primary">{item.name[0]}</span>}<span className="font-black">{item.name}</span></Link>)}</div></section>
      <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="text-xl font-black">Fixtures & results</h2><div className="mt-4 space-y-3">{matches.map((match) => <article key={match.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase text-primary">{match.competition_stage === "knockout" ? "IPL Playoff" : match.status}</span><span className="text-xs text-muted-foreground">{match.match_date || "Date TBC"} {match.match_time || ""}</span></div><p className="mt-2 font-black">{team(match.team_a_id)?.name || "Team A"} <span className="text-muted-foreground">vs</span> {team(match.team_b_id)?.name || "Team B"}</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/${locale}/match/${match.id}`} className="rounded-lg bg-primary px-3 py-2 text-xs font-black text-primary-foreground">Match centre</Link><Link href={`/${locale}/match/${match.id}/teamsheet`} className="rounded-lg border border-border px-3 py-2 text-xs font-black">Playing XI</Link></div></article>)}</div></section>
    </div>
  </main></>;
}
