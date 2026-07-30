"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, Loader2, Medal, RefreshCw, Shield, Swords, Target, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateTournamentRankings, type PlayerRanking, type RankingInnings, type RankingMatch, type TeamRanking } from "@/lib/tournament-rankings";
import type { StatisticsBall, StatisticsPlayer, StatisticsTeam } from "@/lib/tournament-statistics";

type Tournament = { id: string; name: string };
type RankingMode = "batting" | "bowling" | "allrounder";
type RankingScope = "overall" | string;

export function TournamentRankingsDashboard({ admin = false, organizerId, isMasterAdmin = false }: {
  admin?: boolean;
  organizerId?: string;
  isMasterAdmin?: boolean;
}) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<TeamRanking[]>([]);
  const [batsmen, setBatsmen] = useState<PlayerRanking[]>([]);
  const [bowlers, setBowlers] = useState<PlayerRanking[]>([]);
  const [allRounders, setAllRounders] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<RankingScope>("overall");

  useEffect(() => {
    void (async () => {
      let query = supabase.from("tournaments").select("id,name").is("deleted_at", null).order("created_at", { ascending: false });
      if (admin && !isMasterAdmin && organizerId) query = query.eq("organizer_id", organizerId);
      const { data, error } = await query;
      const rows = (data || []) as Tournament[];
      setTournaments(rows);
      setMessage(error?.message || "");
      if (!rows.length) setLoading(false);
    })();
  }, [admin, isMasterAdmin, organizerId]);

  const tournamentIds = useMemo(() => tournaments.map((row) => row.id), [tournaments]);
  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === scope),
    [scope, tournaments],
  );
  const activeTournamentIds = useMemo(
    () => scope === "overall" ? tournamentIds : tournamentIds.includes(scope) ? [scope] : [],
    [scope, tournamentIds],
  );

  const load = useCallback(async () => {
    if (!activeTournamentIds.length) {
      setTeams([]);
      setBatsmen([]);
      setBowlers([]);
      setAllRounders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    const [teamResult, matchResult] = await Promise.all([
      supabase.from("teams").select("id,name,logo_url").in("tournament_id", activeTournamentIds).is("deleted_at", null),
      supabase.from("matches").select("id,team_a_id,team_b_id,winner_id,status,result_type,overs_per_match").in("tournament_id", activeTournamentIds),
    ]);
    const teamRows = (teamResult.data || []) as StatisticsTeam[];
    const matchRows = (matchResult.data || []) as RankingMatch[];
    const matchIds = matchRows.map((row) => row.id);
    const inningsResult = matchIds.length
      ? await supabase.from("innings").select("id,match_id,batting_team_id,bowling_team_id,total_runs,total_wickets,balls_bowled").in("match_id", matchIds)
      : { data: [], error: null };
    const inningsRows = (inningsResult.data || []) as RankingInnings[];
    const inningsIds = inningsRows.map((row) => row.id);
    const teamIds = teamRows.map((row) => row.id);
    const [playerResult, ballResult] = await Promise.all([
      teamIds.length ? supabase.from("players").select("id,name,team_id,photo_url").in("team_id", teamIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
      inningsIds.length ? supabase.from("ball_by_ball").select("innings_id,over_number,batsman_id,bowler_id,player_out_id,fielder_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type").in("innings_id", inningsIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const result = calculateTournamentRankings(teamRows, (playerResult.data || []) as StatisticsPlayer[], matchRows, inningsRows, (ballResult.data || []) as StatisticsBall[]);
    setTeams(result.teams);
    setBatsmen(result.batsmen);
    setBowlers(result.bowlers);
    setAllRounders(result.allRounders);
    setMessage(teamResult.error?.message || matchResult.error?.message || inningsResult.error?.message || playerResult.error?.message || ballResult.error?.message || "");
    setLoading(false);
  }, [activeTournamentIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const isOverall = scope === "overall";
  const tournamentName = isOverall
    ? `Overall · All ${tournaments.length} Tournaments`
    : selectedTournament?.name || "Selected Tournament";

  return <div className="mx-auto max-w-7xl space-y-6 text-foreground">
    <header className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[.22em] text-primary">Verified tournament records</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black"><Medal className="h-8 w-8 text-amber-500"/>Team & Player Rankings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {isOverall
            ? "Overall ICC-inspired ratings combined from every completed tournament match."
            : "Tournament-specific team, batsman, bowler and all-rounder ratings from completed matches."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72 sm:flex-row">
        <label className="sr-only" htmlFor="ranking-scope">Ranking scope</label>
        <select
          id="ranking-scope"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          disabled={loading || !tournaments.length}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-black text-foreground outline-none ring-primary/30 transition focus:ring-4 disabled:opacity-50"
        >
          <option value="overall">Overall · All Tournaments</option>
          {tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading || !activeTournamentIds.length} aria-label="Refresh rankings" className="rounded-xl border border-border bg-background px-3 py-2.5 text-primary disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}/></button>
      </div>
    </header>
    {message && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm font-bold text-red-700 dark:text-red-200">{message}</p>}
    {loading ? <div className="grid min-h-72 place-items-center rounded-3xl border border-border bg-card"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div> : !teams.length && !batsmen.length ? <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center"><Trophy className="mx-auto h-12 w-12 text-muted-foreground"/><p className="mt-3 font-black">Rankings appear after the first completed match.</p></div> : <>
      <TeamTable rows={teams} tournamentName={tournamentName}/>
      <div className="grid gap-6 xl:grid-cols-3">
        <PlayerTable title="Batsman Ranking" subtitle="Runs · average · strike rate" icon={<Swords className="h-6 w-6 text-cyan-500"/>} rows={batsmen} mode="batting"/>
        <PlayerTable title="Bowler Ranking" subtitle="Wickets · economy · average" icon={<Target className="h-6 w-6 text-emerald-500"/>} rows={bowlers} mode="bowling"/>
        <PlayerTable title="All-rounder Ranking" subtitle="Batting rating × bowling rating" icon={<Award className="h-6 w-6 text-violet-500"/>} rows={allRounders} mode="allrounder"/>
      </div>
      <Rules/>
    </>}
  </div>;
}

function TeamTable({ rows, tournamentName }: { rows: TeamRanking[]; tournamentName: string }) {
  return <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
    <header className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-amber-500/15 via-primary/10 to-cyan-500/10 p-5"><Shield className="h-7 w-7 text-amber-500"/><div><h2 className="text-xl font-black">Team Ranking</h2><p className="text-xs text-muted-foreground">{tournamentName} · completed matches</p></div></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm">
      <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3 text-left">Rank</th><th className="px-4 py-3 text-left">Team</th><th className="px-3 py-3 text-center">Rating</th><th className="px-4 py-3 text-right">Points</th></tr></thead>
      <tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={row.teamId} className="hover:bg-muted/35">
        <td className="px-4 py-4 text-lg font-black text-primary">{index + 1}</td>
        <td className="px-4 py-4"><div className="flex items-center gap-3">{row.logoUrl ? <>
          {/* Cloudinary URLs have dynamic transformations, so retain the native image element here. */}
          <Image src={row.logoUrl} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 rounded-full border border-border bg-white object-contain p-0.5"/>
        </> : <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 font-black text-primary">{row.teamName[0]}</span>}<div><strong className="block">{row.teamName}</strong><small className="text-muted-foreground">Matches: {row.played} · W {row.won} · L {row.lost} · NRR {row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</small></div></div></td>
        <td className="px-3 py-4 text-center text-lg font-black">{row.rating}</td><td className="px-4 py-4 text-right text-lg font-black text-primary">{row.ratingPoints}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function PlayerTable({ title, subtitle, icon, rows, mode }: { title: string; subtitle: string; icon: React.ReactNode; rows: PlayerRanking[]; mode: RankingMode }) {
  return <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
    <header className="flex items-center gap-3 border-b border-border p-5">{icon}<div><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div></header>
    <div className="grid grid-cols-[2rem_2.75rem_minmax(0,1fr)_auto] gap-2 bg-muted/60 px-3.5 py-2 text-[.65rem] font-black uppercase tracking-wider text-muted-foreground"><span>Rank</span><span/><span>Player</span><span>Points</span></div>
    <div className="divide-y divide-border">{rows.slice(0, 15).map((row, index) => <article key={row.playerId} className="grid grid-cols-[2rem_2.75rem_minmax(0,1fr)_auto] items-center gap-2 p-3.5 hover:bg-muted/35">
      <span className="font-black text-primary">{index + 1}</span>
      {row.photoUrl ? <>
        {/* Cloudinary URLs have dynamic transformations, so retain the native image element here. */}
        <Image src={row.photoUrl} alt="" width={44} height={44} sizes="44px" className="h-11 w-11 rounded-full border border-border bg-muted object-cover object-top"/>
      </> : <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{initials(row.playerName)}</span>}
      <div className="min-w-0"><p className="truncate text-sm font-black">{row.playerName}</p><p className="truncate text-[.68rem] text-muted-foreground">{row.teamName}</p></div>
      <PlayerMetrics row={row} mode={mode}/>
    </article>)}{!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No qualifying performances yet.</p>}</div>
  </section>;
}

function PlayerMetrics({ row, mode }: { row: PlayerRanking; mode: RankingMode }) {
  if (mode === "batting") return <div className="text-right"><strong className="block text-lg text-cyan-600 dark:text-cyan-300">{row.battingRating}</strong><small className="text-[.62rem] text-muted-foreground">{row.runs} R · Avg {row.average.toFixed(1)}</small></div>;
  if (mode === "bowling") return <div className="text-right"><strong className="block text-lg text-emerald-600 dark:text-emerald-300">{row.bowlingRating}</strong><small className="text-[.62rem] text-muted-foreground">{row.wickets} W · Econ {row.economy.toFixed(2)}</small></div>;
  return <div className="text-right"><strong className="block text-lg text-violet-600 dark:text-violet-300">{row.allRounderPoints}</strong><small className="text-[.62rem] text-muted-foreground">{row.battingRating} Bat · {row.bowlingRating} Bowl</small></div>;
}

function Rules() {
  return <section className="rounded-3xl border border-border bg-card p-5 text-sm text-muted-foreground">
    <h2 className="font-black text-foreground">CrickPulse tournament rating rules</h2>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <p><strong className="text-foreground">Teams:</strong> Completed matches only. Win 120 rating points, tie/no-result 100 and loss 80. Rating = total rating points ÷ matches. NRR is shown as tournament context.</p>
      <p><strong className="text-foreground">Players:</strong> 0–1000 rating. Batting uses runs per match, average, strike rate and high score. Bowling uses wickets per match, economy and bowling average. All-rounder rating = batting × bowling ÷ 1000.</p>
    </div>
    <p className="mt-3 text-xs">ICC-inspired transparent tournament model. The ICC’s complete player algorithm is proprietary and is not reproduced.</p>
  </section>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
