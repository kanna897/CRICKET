"use client";
 

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Radio, Trophy, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAccess } from "@/components/admin-shell";

type Tournament = { id: string; name: string; status: string; organizer_id: string; created_at: string };
type Team = { id: string; name: string };
type Match = { id: string; tournament_id: string; team_a_id: string; team_b_id: string; match_number: number | null; match_date: string | null; match_time: string | null; ground: string | null; status: string; created_at: string };

export function DashboardLivePanels() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      let tournamentQuery = supabase.from("tournaments").select("id,name,status,organizer_id,created_at").order("created_at", { ascending: false });
      if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
      const { data: tournamentRows } = await tournamentQuery;
      const scoped = (tournamentRows || []) as Tournament[];
      const ids = scoped.map((item) => item.id);
      const [matchResult, teamResult] = ids.length ? await Promise.all([
        supabase.from("matches").select("id,tournament_id,team_a_id,team_b_id,match_number,match_date,match_time,ground,status,created_at").in("tournament_id", ids).order("created_at", { ascending: false }).limit(30),
        supabase.from("teams").select("id,name").in("tournament_id", ids),
      ]) : [{ data: [] }, { data: [] }];
      if (!active) return;
      setTournaments(scoped); setMatches((matchResult.data || []) as Match[]); setTeams((teamResult.data || []) as Team[]);
    };
    void load();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 250);
    };
    const channel = supabase.channel(`admin-dashboard:${userId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      scheduleRefresh,
    ).subscribe();
    return () => {
      active = false;
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [isMasterAdmin, userId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayMatches = matches.filter((match) => match.match_date === today);
  const running = matches.filter((match) => ["live", "ongoing", "toss_done"].includes(match.status));
  const upcoming = matches.filter((match) => match.match_date && match.match_date >= today && !["completed", "abandoned"].includes(match.status)).sort((a, b) => `${a.match_date}${a.match_time}`.localeCompare(`${b.match_date}${b.match_time}`)).slice(0, 4);
  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const tournamentNames = useMemo(
    () => new Map(tournaments.map((tournament) => [tournament.id, tournament.name])),
    [tournaments],
  );
  const teamName = (id: string) => teamNames.get(id) || "Team";
  const tournamentName = (id: string) => tournamentNames.get(id) || "Tournament";
  const activities = [
    ...matches.slice(0, 4).map((match) => ({ id: `match:${match.id}`, title: `${teamName(match.team_a_id)} vs ${teamName(match.team_b_id)}`, detail: `${tournamentName(match.tournament_id)} · ${match.status}`, href: `/admin/matches/score/${match.id}`, date: match.created_at, kind: "match" })),
    ...tournaments.slice(0, 3).map((item) => ({ id: `tournament:${item.id}`, title: item.name, detail: `Tournament · ${item.status}`, href: `/admin/tournaments/${item.id}`, date: item.created_at, kind: "tournament" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={CalendarDays} label="Today’s Matches" value={todayMatches.length} />
      <Metric icon={Trophy} label="Active Tournaments" value={tournaments.filter((item) => ["active", "ongoing"].includes(item.status)).length} />
      <Metric icon={Radio} label="Running Matches" value={running.length} live />
      <Link href="/admin/matches/new" className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/5 p-5 font-semibold text-primary transition hover:bg-primary/10"><Radio className="h-5 w-5" />Start Live Match</Link>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="overflow-hidden rounded-xl border border-border bg-card"><header className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="font-semibold">Recent Activity</h2><Link href="/admin/matches" className="text-sm text-primary">View all</Link></header><div className="divide-y divide-border">{activities.length ? activities.map((item) => <Link key={item.id} href={item.href} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/60"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">{item.kind === "match" ? <Activity className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.title}</span><span className="block truncate text-sm capitalize text-muted-foreground">{item.detail}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>) : <p className="p-6 text-sm text-muted-foreground">Activity will appear after you create tournaments and matches.</p>}</div></section>
      <section className="overflow-hidden rounded-xl border border-border bg-card"><header className="border-b border-border px-5 py-4"><h2 className="font-semibold">Upcoming Matches</h2></header><div className="space-y-3 p-4">{upcoming.length ? upcoming.map((match) => <Link key={match.id} href={`/admin/matches/score/${match.id}`} className="block rounded-xl border border-border p-4 hover:border-primary/50"><p className="text-xs font-semibold uppercase tracking-wide text-primary">{match.match_date} {match.match_time || ""}</p><p className="mt-2 font-semibold">{teamName(match.team_a_id)} <span className="text-muted-foreground">vs</span> {teamName(match.team_b_id)}</p><p className="mt-1 text-xs text-muted-foreground">{match.ground || tournamentName(match.tournament_id)}</p></Link>) : <p className="p-2 text-sm text-muted-foreground">No upcoming matches scheduled.</p>}</div></section>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, live = false }: { icon: typeof CalendarDays; label: string; value: number; live?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>{live && <span className="text-xs font-bold text-emerald-500">LIVE NOW</span>}</div><p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>;
}
