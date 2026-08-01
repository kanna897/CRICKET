"use client";


import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, Bell, BellOff, FileText, Radio, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { subscribeWithMonitoring } from "@/lib/monitoring/realtime";
import { LiveCommentary } from "@/components/live-commentary";
import { cloudinaryLogoUrl } from "@/lib/media";

type Match = { id: string; team_a_id: string; team_b_id: string; overs_per_match: number; status: string; winner_id: string | null };
type Team = { id: string; name: string; logo_url: string | null };
type Innings = { id: string; innings_number: number; batting_team_id: string; total_runs: number; total_wickets: number; balls_bowled: number; target: number | null };
type Ball = { id: string; over_number: number; ball_number: number; runs: number; extras: number; extras_type: string | null; is_wicket: boolean };

export function PublicLiveMatchClient() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [innings, setInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => typeof window !== "undefined"
      && localStorage.getItem(`crickpulse-live-alert:${id}`) === "on"
      && Notification.permission === "granted",
  );
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async (notify = false) => {
      const { data: matchRow } = await supabase.from("matches").select("id,team_a_id,team_b_id,overs_per_match,status,winner_id").eq("id", id).maybeSingle();
      if (!matchRow) return;
      const [{ data: teamRows }, { data: inningsRow }] = await Promise.all([
        supabase.from("teams").select("id,name,logo_url").in("id", [matchRow.team_a_id, matchRow.team_b_id]),
        supabase.from("innings").select("id,innings_number,batting_team_id,total_runs,total_wickets,balls_bowled,target").eq("match_id", id).order("innings_number", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMatch(matchRow); setTeams(teamRows || []); setInnings(inningsRow || null);
      if (notify && inningsRow && localStorage.getItem(`crickpulse-live-alert:${id}`) === "on" && Notification.permission === "granted") {
        const battingTeam = (teamRows || []).find((team: Team) => team.id === inningsRow.batting_team_id)?.name || "Batting team";
        const registration = await navigator.serviceWorker?.ready;
        registration?.active?.postMessage({
          type: "SHOW_MATCH_NOTIFICATION",
          payload: {
            title: `${battingTeam} ${inningsRow.total_runs}/${inningsRow.total_wickets}`,
            body: `${Math.floor(inningsRow.balls_bowled / 6)}.${inningsRow.balls_bowled % 6} overs · CrickPulse live update`,
            url: window.location.pathname,
            tag: `crickpulse-match-${id}`,
          },
        });
      }
      if (inningsRow) {
        const { data: ballRows } = await supabase.from("ball_by_ball").select("id,over_number,ball_number,runs,extras,extras_type,is_wicket").eq("innings_id", inningsRow.id).order("created_at", { ascending: false }).limit(12);
        setBalls((ballRows || []).reverse());
      } else setBalls([]);
    };
    void load();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`public-score:${id}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "innings", filter: `match_id=eq.${id}` },
      () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void load(true), 200);
      },
    );
    subscribeWithMonitoring(channel, `public-score:${id}`);
    return () => {
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const teamName = (teamId: string | null | undefined) => teams.find((team) => team.id === teamId)?.name || "Team";
  const team = (teamId: string | null | undefined) => teams.find((item) => item.id === teamId);
  const overs = innings ? `${Math.floor(innings.balls_bowled / 6)}.${innings.balls_bowled % 6}` : "0.0";
  const currentRunRate = innings?.balls_bowled ? (innings.total_runs / innings.balls_bowled) * 6 : 0;
  const ballsRemaining = innings && match ? Math.max(match.overs_per_match * 6 - innings.balls_bowled, 0) : (match?.overs_per_match || 0) * 6;
  const runsNeeded = innings?.target ? Math.max(innings.target - innings.total_runs, 0) : 0;
  const requiredRunRate = innings?.target && ballsRemaining ? (runsNeeded / ballsRemaining) * 6 : 0;
  const projectedScore = innings?.balls_bowled && match ? Math.round((innings.total_runs / innings.balls_bowled) * match.overs_per_match * 6) : 0;
  const battingWinChance = (() => {
    if (!innings || innings.innings_number < 2 || !innings.target) return 50;
    if (runsNeeded === 0) return 100;
    if (ballsRemaining === 0 || innings.total_wickets >= 10) return 0;
    const wicketsRemaining = 10 - innings.total_wickets;
    return Math.round(Math.min(95, Math.max(5, 50 + (currentRunRate - requiredRunRate) * 5 + (wicketsRemaining - 5) * 2)));
  })();
  const teamAWinChance = !match ? 50 : match.status === "completed"
    ? match.winner_id === match.team_a_id ? 100 : match.winner_id === match.team_b_id ? 0 : 50
    : innings?.batting_team_id === match.team_a_id ? battingWinChance : 100 - battingWinChance;
  const teamBWinChance = 100 - teamAWinChance;
  const currentOver = balls.length ? balls[balls.length - 1].over_number : 0;
  const currentOverBalls = currentOver ? balls.filter((ball) => ball.over_number === currentOver) : [];
  const ballLabel = (ball: Ball) => ball.is_wicket ? "W" : ball.extras_type === "wide" ? "Wd" : ball.extras_type === "no_ball" ? "NB" : String(ball.runs + ball.extras);

  async function toggleAlerts() {
    setAlertMessage("");
    if (alertsEnabled) {
      localStorage.removeItem(`crickpulse-live-alert:${id}`);
      setAlertsEnabled(false);
      setAlertMessage("Live alerts turned off.");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setAlertMessage("இந்த browser live notifications support செய்யவில்லை.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setAlertMessage("Notification permission allow பண்ணினால் மட்டும் live alerts வரும்.");
      return;
    }
    localStorage.setItem(`crickpulse-live-alert:${id}`, "on");
    setAlertsEnabled(true);
    setAlertMessage("Live score alerts enabled.");
  }

  if (!match) return <main className="mx-auto max-w-3xl p-6 text-center text-muted-foreground">Loading match...</main>;

  return <main className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/fixtures" className="inline-flex items-center gap-2 px-1 text-sm font-bold text-sky-700 hover:text-sky-900"><ArrowLeft className="h-4 w-4" />Back to matches</Link><button type="button" onClick={toggleAlerts} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black shadow-sm ${alertsEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-white text-slate-800"}`}>{alertsEnabled?<Bell className="h-4 w-4"/>:<BellOff className="h-4 w-4"/>}{alertsEnabled?"Live alerts on":"Enable live alerts"}</button></div>
    {alertMessage&&<p role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900">{alertMessage}</p>}
    <section className="overflow-hidden rounded-3xl border border-sky-400/30 bg-gradient-to-br from-[#071427] via-[#0a2140] to-[#092f4e] p-5 text-white shadow-xl sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><TeamLogo team={team(match.team_a_id)} size="sm"/><p className="truncate text-sm font-bold text-sky-200">{teamName(match.team_a_id)} <span className="text-slate-400">vs</span> {teamName(match.team_b_id)}</p><TeamLogo team={team(match.team_b_id)} size="sm"/></div><p className="mt-1 pl-10 text-xs text-slate-400">Innings {innings?.innings_number || 1}</p></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${match.status === "live" ? "bg-red-500 text-white" : "bg-white/10 text-slate-200"}`}><Radio className="h-3.5 w-3.5" />{match.status === "live" ? "LIVE" : match.status.toUpperCase()}</span></div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Batting</p><div className="mt-2 flex items-center gap-3"><TeamLogo team={team(innings?.batting_team_id)} size="lg"/><h1 className="min-w-0 truncate text-xl font-black text-cyan-300 sm:text-2xl">{teamName(innings?.batting_team_id)}</h1></div></div><div className="text-right"><p className="text-5xl font-black tracking-tight sm:text-6xl">{innings ? `${innings.total_runs}/${innings.total_wickets}` : "0/0"}</p><p className="mt-1 font-bold text-emerald-300">{overs} overs</p></div></div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4"><Metric label="CRR" value={currentRunRate.toFixed(2)} /><Metric label="RRR" value={innings?.target ? requiredRunRate.toFixed(2) : "—"} /><Metric label="Target" value={innings?.target ? String(innings.target) : "—"} /><Metric label="Need" value={innings?.target ? `${runsNeeded} / ${ballsRemaining}b` : "—"} /></div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Current over</p><p className="mt-1 font-black text-slate-900">Over {currentOver || Math.floor((innings?.balls_bowled || 0) / 6) + 1}</p></div><p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Recent delivery</p></div><div className="mt-4 flex min-h-12 flex-wrap items-center gap-2">{currentOverBalls.length ? currentOverBalls.map((ball) => <span key={ball.id} title={`${ball.over_number}.${ball.ball_number}`} className={`grid h-11 min-w-11 place-items-center rounded-full border px-2 text-sm font-black ${ball.is_wicket ? "border-red-500 bg-red-500 text-white" : ball.extras_type ? "border-amber-400 bg-amber-50 text-amber-800" : ball.runs === 4 || ball.runs === 6 ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-800"}`}>{ballLabel(ball)}</span>) : <p className="text-sm text-slate-500">Waiting for the first delivery.</p>}</div></section>
    <div className="grid grid-cols-2 gap-3"><section className="rounded-2xl border border-sky-100 bg-white p-4 text-center shadow-sm"><TrendingUp className="mx-auto h-5 w-5 text-sky-600" /><p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Projected</p><p className="mt-1 text-3xl font-black text-slate-900">{projectedScore || "—"}</p></section><section className="rounded-2xl border border-emerald-100 bg-white p-4 text-center shadow-sm"><Target className="mx-auto h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-500">Balls left</p><p className="mt-1 text-3xl font-black text-slate-900">{ballsRemaining}</p></section></div>
    <section className="rounded-2xl border border-cyan-200/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Winning probability</p><p className="mt-1 text-sm text-slate-500">Live match estimate</p></div><TrendingUp className="h-5 w-5 text-cyan-600" /></div>
      <div className="mt-4 grid grid-cols-2 gap-4"><div><div className="flex min-w-0 items-center gap-2"><TeamLogo team={team(match.team_a_id)} size="md" light/><p className="truncate text-sm font-bold text-slate-800">{teamName(match.team_a_id)}</p></div><p className="mt-1 text-2xl font-black text-cyan-700">{teamAWinChance}%</p></div><div className="text-right"><div className="flex min-w-0 flex-row-reverse items-center gap-2"><TeamLogo team={team(match.team_b_id)} size="md" light/><p className="truncate text-sm font-bold text-slate-800">{teamName(match.team_b_id)}</p></div><p className="mt-1 text-2xl font-black text-emerald-700">{teamBWinChance}%</p></div></div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label={`${teamName(match.team_a_id)} ${teamAWinChance} percent, ${teamName(match.team_b_id)} ${teamBWinChance} percent`}><div className="bg-cyan-500 transition-[width] duration-500" style={{ width: `${teamAWinChance}%` }} /><div className="bg-emerald-500 transition-[width] duration-500" style={{ width: `${teamBWinChance}%` }} /></div>
    </section>
    <div className="flex flex-wrap justify-center gap-3"><Link href={`/match/${id}/scorecard`} className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-sky-800 shadow-sm"><FileText className="h-4 w-4" />Scorecard & Match Summary</Link><Link href={`/match/${id}/analytics`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800 shadow-sm"><BarChart3 className="h-4 w-4" />Advanced Analytics</Link></div>
    <LiveCommentary inningsId={innings?.id || null} />
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/[0.07] p-3"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-base font-black text-white sm:text-lg">{value}</p></div>; }

function TeamLogo({ team, size, light = false }: { team?: Team; size: "sm" | "md" | "lg"; light?: boolean }) {
  const dimensions = size === "lg" ? "h-14 w-14" : size === "md" ? "h-10 w-10" : "h-8 w-8";
  const shell = `${dimensions} grid shrink-0 place-items-center overflow-hidden rounded-full border ${light ? "border-slate-200 bg-white" : "border-white/30 bg-white"}`;
  return team?.logo_url
    ? <span className={shell}><Image unoptimized width={128} height={128} src={cloudinaryLogoUrl(team.logo_url)} alt={`${team.name} logo`} className="h-full w-full object-contain p-1"/></span>
    : <span className={`${shell} text-xs font-black text-slate-700`}>{team?.name.slice(0, 2).toUpperCase() || "T"}</span>;
}
