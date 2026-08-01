"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Loader2, PlayCircle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdminAccess } from "@/components/admin-shell";
import { IplPlayoffRoadmap } from "@/components/ipl-playoff-roadmap";
import { calculateTournamentStandings, type StandingsInnings, type StandingsMatch } from "@/lib/tournament-standings";
import { playoffTitle, type IplPlayoffMatch } from "@/lib/ipl-playoffs";
import { syncIplPlayoffMatches } from "@/lib/ipl-playoffs-client";

type Tournament = { id: string; name: string; logo_url: string | null; organizer_id: string | null; overs: number; venue: string | null };
type Team = { id: string; name: string; logo_url: string | null; tournament_id: string };

export default function KnockoutBracketPage() {
  const { isMasterAdmin, userId } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<IplPlayoffMatch[]>([]);
  const [leagueMatches, setLeagueMatches] = useState<StandingsMatch[]>([]);
  const [innings, setInnings] = useState<StandingsInnings[]>([]);
  const [selected, setSelected] = useState("");
  const [startDate, setStartDate] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (tournamentId?: string, progress = true) => {
    let tournamentQuery = supabase.from("tournaments").select("id,name,logo_url,organizer_id,overs,venue").is("deleted_at", null).order("name");
    if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
    const { data: tournamentRows } = await tournamentQuery;
    const rows = (tournamentRows || []) as Tournament[];
    setTournaments(rows);
    const active = tournamentId || selected || rows[0]?.id || "";
    if (!active) return;
    setSelected(active);
    if (progress) {
      try { await syncIplPlayoffMatches(supabase, active); } catch { /* No bracket yet or progression not ready. */ }
    }
    const [{ data: teamRows }, { data: knockoutRows }, { data: leagueRows }] = await Promise.all([
      supabase.from("teams").select("id,name,logo_url,tournament_id").eq("tournament_id", active).is("deleted_at", null).order("name"),
      supabase.from("matches").select("id,team_a_id,team_b_id,winner_id,status,bracket_round,bracket_slot,match_date").eq("tournament_id", active).eq("competition_stage", "knockout").order("bracket_round").order("bracket_slot"),
      supabase.from("matches").select("id,team_a_id,team_b_id,status,winner_id").eq("tournament_id", active).eq("competition_stage", "league"),
    ]);
    const league = (leagueRows || []) as StandingsMatch[];
    const leagueIds = league.map((match) => match.id);
    const inningsRows = leagueIds.length ? (await supabase.from("innings").select("match_id,batting_team_id,bowling_team_id,total_runs,total_wickets,balls_bowled").in("match_id", leagueIds)).data : [];
    setTeams((teamRows || []) as Team[]);
    setMatches((knockoutRows || []) as IplPlayoffMatch[]);
    setLeagueMatches(league);
    setInnings((inningsRows || []) as StandingsInnings[]);
  }, [isMasterAdmin, selected, userId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!selected) return;
    const channel = supabase.channel(`ipl-admin-${selected}`).on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${selected}` }, () => void load(selected)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, selected]);

  const standings = useMemo(() => calculateTournamentStandings(teams, leagueMatches, innings), [innings, leagueMatches, teams]);
  const tournament = tournaments.find((item) => item.id === selected);
  const completedLeague = leagueMatches.filter((match) => match.status === "completed").length;

  async function generate() {
    setMessage("");
    if (!startDate) return setMessage("Select the IPL playoff start date.");
    if (teams.length < 4) return setMessage("At least 4 teams are required.");
    if (standings.filter((row) => row.played > 0).length < 4) return setMessage("Four teams must have completed league matches before seeding playoffs.");
    if (matches.length) return setMessage("IPL playoffs already exist for this tournament.");
    setWorking(true);
    const top = standings.slice(0, 4);
    const date = new Date(`${startDate}T00:00:00`);
    const next = new Date(date); next.setDate(next.getDate() + 1);
    const common = { tournament_id: selected, overs_per_match: tournament?.overs || 20, ground: tournament?.venue || null, status: "scheduled", competition_stage: "knockout", assigned_scorer_id: tournament?.organizer_id || userId, scoring_locked: false };
    const { error } = await supabase.from("matches").insert([
      { ...common, team_a_id: top[0].team_id, team_b_id: top[1].team_id, match_date: date.toISOString().slice(0, 10), bracket_round: 1, bracket_slot: 1 },
      { ...common, team_a_id: top[2].team_id, team_b_id: top[3].team_id, match_date: next.toISOString().slice(0, 10), bracket_round: 1, bracket_slot: 2 },
    ]);
    setWorking(false);
    if (error) return setMessage(error.message);
    setMessage("IPL playoffs created from the current Top 4 standings: Q1 (1 vs 2) and Eliminator (3 vs 4).");
    await load(selected, false);
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-primary">Tournament progression</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black"><GitBranch className="h-8 w-8 text-primary"/>IPL Playoff Bracket</h1><p className="mt-2 text-muted-foreground">Manual generation from live league standings; playoff winners progress automatically.</p></div><select className="input min-w-64" value={selected} onChange={(event) => void load(event.target.value)}>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></header>
    {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 font-bold">{message}</p>}
    {!matches.length ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-black">Generate IPL Playoffs from Top 4</h2><p className="mt-1 text-sm text-muted-foreground">Current league progress: {completedLeague} completed matches. Seeds use points, then NRR, then wins.</p><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"><div className="rounded-xl bg-muted/50 p-3 text-sm"><strong>Top 4 now</strong><ol className="mt-2 space-y-1">{standings.slice(0, 4).map((row, index) => <li key={row.team_id}>{index + 1}. {teams.find((item) => item.id === row.team_id)?.name} · {row.points} pts · {row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</li>)}</ol></div><label className="space-y-2 text-sm font-bold">Playoff start date<input type="date" className="input" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></label><button onClick={() => void generate()} disabled={working || !selected} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-black text-primary-foreground disabled:opacity-50">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}Generate IPL Playoffs</button></div></section> : <>
      <IplPlayoffRoadmap tournamentName={tournament?.name || "Tournament"} tournamentLogo={tournament?.logo_url} teams={teams} matches={matches}/>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{matches.map((match) => <article key={match.id} className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-black uppercase tracking-wider text-primary">{playoffTitle(match)}</p><p className="mt-2 font-black">{teams.find((item) => item.id === match.team_a_id)?.name} <span className="text-muted-foreground">vs</span> {teams.find((item) => item.id === match.team_b_id)?.name}</p><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold uppercase text-muted-foreground">{match.status}</span><Link href={`/admin/matches/score/${match.id}`} className="inline-flex items-center gap-1 text-xs font-black text-primary"><PlayCircle className="h-3.5 w-3.5"/>Open</Link></div></article>)}</section>
    </>}
  </div>;
}
