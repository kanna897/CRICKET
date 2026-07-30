"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element -- live scoring tables and Cloudinary URLs are dynamic */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, Medal, RefreshCw, ShieldCheck, Sparkles, Target, Trophy, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateMvpTournamentStats, calculateTournamentPlayerStats, type MvpTournamentStat, type PlayerTournamentStat, type StatisticsBall, type StatisticsInnings, type StatisticsMatch, type StatisticsPlayer, type StatisticsTeam } from "@/lib/tournament-statistics";

type Tournament = { id: string; name: string; status: string | null };

export function HallOfFameDashboard({ admin = false, organizerId, isMasterAdmin = false }: { admin?: boolean; organizerId?: string; isMasterAdmin?: boolean }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [stats, setStats] = useState<PlayerTournamentStat[]>([]);
  const [mvpStats, setMvpStats] = useState<MvpTournamentStat[]>([]);
  const [allMatchesCompleted, setAllMatchesCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const card = "border-border bg-card text-foreground";

  useEffect(() => { void (async () => {
    let query = supabase.from("tournaments").select("id,name,status").order("created_at", { ascending: false });
    if (admin && !isMasterAdmin && organizerId) query = query.eq("organizer_id", organizerId);
    const { data, error } = await query;
    const rows = (data || []) as Tournament[];
    setTournaments(rows); setSelectedTournament((current) => current || rows[0]?.id || ""); setMessage(error?.message || "");
    if (!rows.length) setLoading(false);
  })(); }, [admin, isMasterAdmin, organizerId]);

  const load = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading(true); setMessage("");
    const [teamResult, matchResult] = await Promise.all([
      supabase.from("teams").select("id,name,logo_url").eq("tournament_id", selectedTournament),
      supabase.from("matches").select("id,status,player_of_match_id").eq("tournament_id", selectedTournament),
    ]);
    const teams = (teamResult.data || []) as StatisticsTeam[];
    const tournamentMatches = (matchResult.data || []) as StatisticsMatch[];
    const matchIds = tournamentMatches.map((row) => row.id);
    setAllMatchesCompleted(tournamentMatches.length > 0 && tournamentMatches.every((match) => match.status === "completed"));
    const inningsResult = matchIds.length ? await supabase.from("innings").select("id,match_id,batting_team_id,bowling_team_id").in("match_id", matchIds) : { data: [], error: null };
    const innings = (inningsResult.data || []) as StatisticsInnings[];
    const [playerResult, ballResult] = await Promise.all([
      teams.length ? supabase.from("players").select("id,name,team_id,photo_url").in("team_id", teams.map((team) => team.id)) : Promise.resolve({ data: [], error: null }),
      innings.length ? supabase.from("ball_by_ball").select("innings_id,over_number,batsman_id,bowler_id,player_out_id,fielder_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type").in("innings_id", innings.map((item) => item.id)) : Promise.resolve({ data: [], error: null }),
    ]);
    const players = (playerResult.data || []) as StatisticsPlayer[];
    const balls = (ballResult.data || []) as StatisticsBall[];
    setStats(calculateTournamentPlayerStats(players, teams, innings, balls));
    setMvpStats(calculateMvpTournamentStats(players, teams, innings, balls, tournamentMatches));
    setMessage(teamResult.error?.message || matchResult.error?.message || inningsResult.error?.message || playerResult.error?.message || ballResult.error?.message || "");
    setLoading(false);
  }, [selectedTournament]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const awards = useMemo(() => {
    const mostRuns = [...stats].sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)[0];
    const mostWickets = [...stats].sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)[0];
    const mvp = [...stats].sort((a, b) => (b.runs + b.wickets * 20 + b.fieldingDismissals * 10) - (a.runs + a.wickets * 20 + a.fieldingDismissals * 10))[0];
    const powerHitter = [...stats].filter((row) => row.ballsFaced >= 6).sort((a, b) => b.strikeRate - a.strikeRate)[0];
    const bestFielder = [...stats].filter((row) => row.fieldingDismissals > 0).sort((a, b) => b.fieldingDismissals - a.fieldingDismissals || b.catches - a.catches || b.runOuts - a.runOuts)[0];
    const automaticMvp = mvpStats[0];
    return [
      { title: "Player of the Tournament", subtitle: mvp ? `${mvp.runs} runs · ${mvp.wickets} wickets` : "", player: mvp, icon: Crown, accent: "from-amber-400 to-orange-500" },
      { title: "Orange Cap", subtitle: mostRuns ? `${mostRuns.runs} runs · Avg ${mostRuns.average.toFixed(1)}` : "", player: mostRuns, icon: Trophy, accent: "from-orange-400 to-amber-500" },
      { title: "Purple Cap", subtitle: mostWickets ? `${mostWickets.wickets} wickets · Econ ${mostWickets.economy.toFixed(2)}` : "", player: mostWickets, icon: Target, accent: "from-violet-500 to-fuchsia-600" },
      { title: "Power Hitter", subtitle: powerHitter ? `Strike rate ${powerHitter.strikeRate.toFixed(1)} · ${powerHitter.sixes} sixes` : "", player: powerHitter, icon: Sparkles, accent: "from-cyan-400 to-sky-600" },
      { title: "Best Fielder", subtitle: bestFielder ? `${bestFielder.catches} ${bestFielder.catches === 1 ? "catch" : "catches"} · ${bestFielder.runOuts} run outs${bestFielder.stumpings ? ` · ${bestFielder.stumpings} stumpings` : ""}` : "", player: bestFielder, icon: ShieldCheck, accent: "from-emerald-400 to-teal-600" },
      { title: "Most Valuable Player (MVP)", subtitle: automaticMvp ? `${automaticMvp.mvpPoints} MVP points · Automatic winner` : "", player: automaticMvp, icon: Medal, accent: "from-rose-500 to-amber-500" },
    ];
  }, [mvpStats, stats]);

  const tournamentCompleted = tournaments.find((item) => item.id === selectedTournament)?.status === "completed" || allMatchesCompleted;

  return <div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.2em] text-primary">CrickPulse Awards</p><h1 className={`mt-1 flex items-center gap-3 text-3xl font-black ${admin ? "text-foreground" : "text-slate-900"}`}><Medal className="h-8 w-8 text-amber-500" />Hall of Fame</h1><p className={`mt-2 ${admin ? "text-muted-foreground" : "text-slate-500"}`}>All award categories stay visible. Leaders update from verified match performances.</p></div><div className="flex gap-2"><select aria-label="Tournament" value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 font-bold sm:min-w-64 ${card}`}>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" onClick={() => void load()} disabled={!selectedTournament || loading} aria-label="Refresh Awards" className={`rounded-xl border px-3 text-primary disabled:opacity-50 ${card}`}><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button></div></header>
    {message && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    {!loading && <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${card}`}><span className="font-bold">{tournamentCompleted ? "Tournament completed · Final award winners" : "Tournament in progress · Current award leaders"}</span><span className={`rounded-full px-3 py-1 text-[0.65rem] font-black uppercase tracking-wider ${tournamentCompleted ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{tournamentCompleted ? "Final" : "Live"}</span></div>}
    {loading ? <div className={`grid min-h-64 place-items-center rounded-2xl border ${card}`}><Loader2 className="h-9 w-9 animate-spin text-primary" /></div> : <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">{awards.map((award) => <AwardCard key={award.title} {...award} cardClass={card} finalized={tournamentCompleted} />)}</div>}
  </div>;
}

function AwardCard({ title, subtitle, player, icon: Icon, accent, cardClass, finalized }: { title: string; subtitle: string; player?: PlayerTournamentStat; icon: typeof Trophy; accent: string; cardClass: string; finalized: boolean }) {
  return <article className={`relative flex min-h-64 h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-sm ${cardClass}`}><div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} /><div className="flex items-start justify-between gap-3"><span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${accent}`}><Icon className="h-6 w-6" /></span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-widest text-primary">{finalized ? "Winner" : "Current leader"}</span></div><div className="mt-6 flex items-center gap-4">{player?.photoUrl ? <img src={player.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover object-top ring-4 ring-primary/25" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-black text-primary">{player ? player.playerName.slice(0, 2).toUpperCase() : <UserRound className="h-7 w-7" />}</span>}<div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">{title}</p><h2 className="mt-1 truncate text-xl font-black">{player?.playerName || "Awaiting performances"}</h2><p className="truncate text-sm text-muted-foreground">{player?.teamName || "No verified leader yet"}</p></div></div><p className="mt-auto pt-5 text-sm font-bold">{subtitle || "Updates automatically after verified match records."}</p></article>;
}
