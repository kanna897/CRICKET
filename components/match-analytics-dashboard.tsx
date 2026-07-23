"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- live scoring columns are newer than generated local Supabase types */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, Download, Loader2, Radar, ShieldCheck, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";

type Match = { id: string; team_a_id: string; team_b_id: string };
type Team = { id: string; name: string; logo_url: string | null };
type Player = { id: string; name: string };
type Innings = { id: string; innings_number: number; batting_team_id: string };
type Ball = { id: string; innings_id: string; over_number: number; ball_number: number; batsman_id: string | null; bowler_id: string | null; runs: number; extras: number; extras_type: string | null; commentary: string | null; is_legal: boolean; is_wicket: boolean; dismissal_type: string | null };

const zonePoints: Record<string, [number, number]> = { straight: [150, 22], cover: [250, 80], point: [278, 145], square_leg: [36, 150], midwicket: [58, 78], fine_leg: [112, 38] };

export function MatchAnalyticsDashboard({ matchId, admin = false, embedded = false }: { matchId: string; admin?: boolean; embedded?: boolean }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [innings, setInnings] = useState<Innings[]>([]);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [batter, setBatter] = useState("all");
  const [bowler, setBowler] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const card = "border-border bg-card text-foreground";

  useEffect(() => { void (async () => {
    setLoading(true);
    const matchResult = await (supabase.from("matches") as any).select("id,team_a_id,team_b_id").eq("id", matchId).maybeSingle();
    if (!matchResult.data) { setMessage(matchResult.error?.message || "Match not found."); setLoading(false); return; }
    const [teamResult, inningsResult] = await Promise.all([
      (supabase.from("teams") as any).select("id,name,logo_url").in("id", [matchResult.data.team_a_id, matchResult.data.team_b_id]),
      (supabase.from("innings") as any).select("id,innings_number,batting_team_id").eq("match_id", matchId).order("innings_number"),
    ]);
    const inningsRows = (inningsResult.data || []) as Innings[];
    const ballResult = inningsRows.length ? await (supabase.from("ball_by_ball") as any).select("id,innings_id,over_number,ball_number,batsman_id,bowler_id,runs,extras,extras_type,commentary,is_legal,is_wicket,dismissal_type").in("innings_id", inningsRows.map((row) => row.id)).order("created_at") : { data: [], error: null };
    const playerIds = [...new Set(((ballResult.data || []) as Ball[]).flatMap((ball) => [ball.batsman_id, ball.bowler_id]).filter(Boolean) as string[])];
    const playerResult = playerIds.length ? await (supabase.from("players") as any).select("id,name").in("id", playerIds) : { data: [], error: null };
    setMatch(matchResult.data); setTeams(teamResult.data || []); setInnings(inningsRows); setBalls((ballResult.data || []) as Ball[]); setPlayers(playerResult.data || []);
    setMessage(teamResult.error?.message || inningsResult.error?.message || ballResult.error?.message || playerResult.error?.message || "");
    setLoading(false);
  })(); }, [matchId]);

  const filteredBalls = useMemo(() => balls.filter((ball) => (batter === "all" || ball.batsman_id === batter) && (bowler === "all" || ball.bowler_id === bowler)), [balls, batter, bowler]);
  const distribution = [0, 1, 2, 3, 4, 6].map((runs) => ({ runs: String(runs), balls: filteredBalls.filter((ball) => ball.runs === runs).length }));
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || "Team";
  const overData = useMemo(() => {
    const rows = new Map<number, Record<string, number>>();
    innings.forEach((item) => balls.filter((ball) => ball.innings_id === item.id).forEach((ball) => { const row = rows.get(ball.over_number) || { over: ball.over_number }; const key = `innings${item.innings_number}`; row[key] = (row[key] || 0) + ball.runs + ball.extras; rows.set(ball.over_number, row); }));
    return [...rows.values()].sort((a, b) => Number(a.over) - Number(b.over));
  }, [balls, innings]);
  const progression = useMemo(() => {
    const totals = new Map<number, Record<string, number>>();
    innings.forEach((item) => {
      let total = 0;
      const inningBalls = balls.filter((ball) => ball.innings_id === item.id);
      const overNumbers = [...new Set(inningBalls.map((ball) => ball.over_number))].sort((a, b) => a - b);
      overNumbers.forEach((over) => {
        inningBalls.filter((ball) => ball.over_number === over).forEach((ball) => { total += ball.runs + ball.extras; });
        const row = totals.get(over) || { over };
        row[`innings${item.innings_number}`] = total;
        totals.set(over, row);
      });
    });
    return [{ over: 0, innings1: 0, innings2: 0 }, ...[...totals.values()].sort((a, b) => Number(a.over) - Number(b.over))];
  }, [balls, innings]);
  const wagonShots = filteredBalls.map((ball) => ({ ...ball, zone: ball.commentary?.match(/\[zone:([a-z_]+)\]/)?.[1] })).filter((ball) => ball.zone && ball.runs > 0);
  const playerName = (id: string | null) => players.find((player) => player.id === id)?.name || "Unknown";
  const inningsSummary = useMemo(() => innings.map((item) => {
    const rows = balls.filter((ball) => ball.innings_id === item.id);
    const total = rows.reduce((sum, ball) => sum + ball.runs + ball.extras, 0);
    const legal = rows.filter((ball) => ball.is_legal).length;
    const boundaryRuns = rows.reduce((sum, ball) => sum + (ball.runs === 4 || ball.runs === 6 ? ball.runs : 0), 0);
    return {
      innings: item.innings_number,
      team: teamName(item.batting_team_id),
      total,
      wickets: rows.filter((ball) => ball.is_wicket).length,
      overs: `${Math.floor(legal / 6)}.${legal % 6}`,
      runRate: legal ? (total * 6 / legal).toFixed(2) : "0.00",
      dotPercent: legal ? Math.round(rows.filter((ball) => ball.is_legal && ball.runs + ball.extras === 0).length * 100 / legal) : 0,
      boundaryPercent: total ? Math.round(boundaryRuns * 100 / total) : 0,
    };
  }), [balls, innings, teams]);
  const phaseData = useMemo(() => {
    const maxOver = Math.max(1, ...balls.map((ball) => ball.over_number));
    const phaseSize = Math.max(1, Math.ceil(maxOver / 3));
    return ["Powerplay", "Middle", "Death"].map((phase, index) => {
      const start = index * phaseSize + 1;
      const end = index === 2 ? maxOver : (index + 1) * phaseSize;
      const row: Record<string, string | number> = { phase };
      innings.forEach((item) => {
        const phaseBalls = balls.filter((ball) => ball.innings_id === item.id && ball.over_number >= start && ball.over_number <= end);
        row[`innings${item.innings_number}`] = phaseBalls.reduce((sum, ball) => sum + ball.runs + ball.extras, 0);
      });
      return row;
    });
  }, [balls, innings]);
  const batterRows = useMemo(() => players.map((player) => {
    const rows = balls.filter((ball) => ball.batsman_id === player.id);
    const runs = rows.reduce((sum, ball) => sum + ball.runs, 0);
    const legal = rows.filter((ball) => ball.is_legal).length;
    return { name: player.name, runs, balls: legal, fours: rows.filter((ball) => ball.runs === 4).length, sixes: rows.filter((ball) => ball.runs === 6).length, strikeRate: legal ? (runs * 100 / legal).toFixed(2) : "0.00" };
  }).filter((row) => row.balls || row.runs).sort((a, b) => b.runs - a.runs), [balls, players]);
  const bowlerRows = useMemo(() => players.map((player) => {
    const rows = balls.filter((ball) => ball.bowler_id === player.id);
    const legal = rows.filter((ball) => ball.is_legal).length;
    const conceded = rows.reduce((sum, ball) => sum + ball.runs + (["wide", "no_ball"].includes(ball.extras_type || "") ? ball.extras : 0), 0);
    const wickets = rows.filter((ball) => ball.is_wicket && ball.dismissal_type !== "run_out").length;
    return { name: player.name, overs: `${Math.floor(legal / 6)}.${legal % 6}`, runs: conceded, wickets, economy: legal ? (conceded * 6 / legal).toFixed(2) : "0.00", dots: rows.filter((ball) => ball.is_legal && ball.runs + ball.extras === 0).length };
  }).filter((row) => row.overs !== "0.0").sort((a, b) => b.wickets - a.wickets || Number(a.economy) - Number(b.economy)), [balls, players]);
  const downloadReport = () => {
    const lines = [
      ["CRICKPULSE MATCH ANALYTICS"],
      [`${teamName(match!.team_a_id)} vs ${teamName(match!.team_b_id)}`],
      [],
      ["INNINGS SUMMARY"],
      ["Team", "Score", "Overs", "Run Rate", "Dot Ball %", "Boundary Run %"],
      ...inningsSummary.map((row) => [row.team, `${row.total}/${row.wickets}`, row.overs, row.runRate, `${row.dotPercent}%`, `${row.boundaryPercent}%`]),
      [],
      ["BATTING"],
      ["Player", "Runs", "Balls", "4s", "6s", "Strike Rate"],
      ...batterRows.map((row) => [row.name, row.runs, row.balls, row.fours, row.sixes, row.strikeRate]),
      [],
      ["BOWLING"],
      ["Player", "Overs", "Runs", "Wickets", "Economy", "Dots"],
      ...bowlerRows.map((row) => [row.name, row.overs, row.runs, row.wickets, row.economy, row.dots]),
    ];
    const csv = lines.map((line) => line.map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `crickpulse-match-${matchId}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) return <div className={`grid min-h-72 place-items-center rounded-2xl border ${card}`}><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>;
  if (!match) return <p role="alert" className="rounded-xl bg-red-50 p-4 font-bold text-red-700">{message}</p>;

  return <div className="mx-auto max-w-6xl space-y-5">{!embedded && <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href={admin ? `/admin/matches/score/${matchId}` : `/match/${matchId}`} className="inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />Back to match</Link><p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-primary">Match Centre</p><h1 className="mt-1 text-3xl font-black text-foreground">Advanced Match Analytics</h1><p className="mt-2 text-muted-foreground">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)}</p></div><button type="button" onClick={downloadReport} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-black text-primary-foreground shadow-lg"><Download className="h-4 w-4"/>Download Analytics CSV</button></div>}
    {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{inningsSummary.flatMap((row) => [
      <InsightCard key={`${row.innings}-score`} label={`${row.team} · Innings ${row.innings}`} value={`${row.total}/${row.wickets}`} detail={`${row.overs} overs · RR ${row.runRate}`} />,
      <InsightCard key={`${row.innings}-control`} label="Scoring control" value={`${row.boundaryPercent}%`} detail={`Boundary runs · ${row.dotPercent}% dot balls`} />,
    ])}</section>
    <section className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-2 ${card}`}><label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Batter<select value={batter} onChange={(event) => setBatter(event.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold"><option value="all">All batters</option>{players.filter((player) => balls.some((ball) => ball.batsman_id === player.id)).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Bowler<select value={bowler} onChange={(event) => setBowler(event.target.value)} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold"><option value="all">All bowlers</option>{players.filter((player) => balls.some((ball) => ball.bowler_id === player.id)).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label></section>
    <div className="grid gap-5 lg:grid-cols-2"><AnalyticsCard title="Wagon Wheel" icon={<Radar className="h-5 w-5 text-emerald-500" />} cardClass={card}><div className="mx-auto max-w-lg"><svg viewBox="0 0 360 300" role="img" aria-label={`${wagonShots.length} tracked scoring shots`} className="w-full overflow-visible drop-shadow-2xl"><defs><clipPath id={`stadium-${matchId}`}><path d="M28 70 Q180 -5 332 70 L350 225 Q180 315 10 225 Z" /></clipPath><radialGradient id={`field-${matchId}`}><stop offset="0" stopColor="#44c96b" /><stop offset=".7" stopColor="#168b49" /><stop offset="1" stopColor="#075c35" /></radialGradient><linearGradient id={`lights-${matchId}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".9" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></linearGradient></defs><g clipPath={`url(#stadium-${matchId})`}><image href="/stadium/crickpulse-stadium-day.png" x="0" y="0" width="360" height="300" preserveAspectRatio="xMidYMid slice" className="dark:hidden" /><image href="/stadium/crickpulse-stadium-night.png" x="0" y="0" width="360" height="300" preserveAspectRatio="xMidYMid slice" className="hidden dark:block" /><ellipse cx="180" cy="170" rx="135" ry="88" fill={`url(#field-${matchId})`} stroke="#bbf7d0" strokeWidth="2" /><ellipse cx="180" cy="170" rx="104" ry="65" fill="none" stroke="#dcfce7" strokeOpacity=".4" /><path d="M171 202 L189 202 L186 128 L174 128 Z" fill="#d8b47a" stroke="#fff7d6" strokeWidth="1" /><path d="M30 35 L70 128 M330 35 L290 128" stroke={`url(#lights-${matchId})`} strokeWidth="15" opacity=".45" />{wagonShots.map((shot) => { const base = zonePoints[shot.zone!] || zonePoints.straight; const point:[number,number] = [base[0] + 30, base[1] + 20]; return <line key={shot.id} x1="180" y1="165" x2={point[0]} y2={point[1]} stroke={shot.runs >= 6 ? "#fde047" : shot.runs >= 4 ? "#22d3ee" : "#ffffff"} strokeWidth={shot.runs >= 4 ? 3.5 : 1.8} opacity=".95" />; })}<circle cx="180" cy="165" r="5" fill="#fff" /></g><path d="M28 70 Q180 -5 332 70 L350 225 Q180 315 10 225 Z" fill="none" stroke="#38bdf8" strokeWidth="3" /></svg><div className="mt-2 flex justify-center gap-4 text-[0.65rem] font-black uppercase tracking-wider text-muted-foreground"><span className="text-cyan-400">4 · Boundary</span><span className="text-yellow-400">6 · Maximum</span><span>1–3 · Runs</span></div>{!wagonShots.length && <p className="mt-2 text-center text-sm text-muted-foreground">Directional tracking starts with newly scored balls.</p>}</div></AnalyticsCard>
      <AnalyticsCard title="Run Distribution" icon={<BarChart3 className="h-5 w-5 text-cyan-500" />} cardClass={card}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" opacity={0.18} /><XAxis dataKey="runs" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="balls" fill="#06b6d4" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></AnalyticsCard>
    </div>
    <AnalyticsCard title="Over Comparison" icon={<BarChart3 className="h-5 w-5 text-violet-500" />} cardClass={card}><div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={overData}><CartesianGrid strokeDasharray="3 3" opacity={0.18} /><XAxis dataKey="over" /><YAxis /><Tooltip /><Legend /><Bar name={teamName(innings[0]?.batting_team_id)} dataKey="innings1" fill="#06b6d4" radius={[5,5,0,0]} /><Bar name={teamName(innings[1]?.batting_team_id)} dataKey="innings2" fill="#f43f5e" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></AnalyticsCard>
    <AnalyticsCard title="Run Comparison" icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} cardClass={card}><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={progression}><CartesianGrid strokeDasharray="3 3" opacity={0.18} /><XAxis dataKey="over" /><YAxis /><Tooltip /><Legend /><Line name={teamName(innings[0]?.batting_team_id)} type="monotone" dataKey="innings1" stroke="#06b6d4" strokeWidth={3} connectNulls /><Line name={teamName(innings[1]?.batting_team_id)} type="monotone" dataKey="innings2" stroke="#f43f5e" strokeWidth={3} connectNulls /></LineChart></ResponsiveContainer></div></AnalyticsCard>
    <AnalyticsCard title="Phase Performance" icon={<Activity className="h-5 w-5 text-amber-400" />} cardClass={card}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={phaseData}><CartesianGrid strokeDasharray="3 3" opacity={0.18}/><XAxis dataKey="phase"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Bar name={teamName(innings[0]?.batting_team_id)} dataKey="innings1" fill="#10b981" radius={[6,6,0,0]}/><Bar name={teamName(innings[1]?.batting_team_id)} dataKey="innings2" fill="#8b5cf6" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></AnalyticsCard>
    <div className="grid gap-5 lg:grid-cols-2"><AnalyticsCard title="Batting Report" icon={<TrendingUp className="h-5 w-5 text-cyan-400"/>} cardClass={card}><ReportTable headers={["Player", "R", "B", "4s", "6s", "SR"]} rows={batterRows.map((row) => [row.name, row.runs, row.balls, row.fours, row.sixes, row.strikeRate])}/></AnalyticsCard><AnalyticsCard title="Bowling Report" icon={<ShieldCheck className="h-5 w-5 text-emerald-400"/>} cardClass={card}><ReportTable headers={["Player", "O", "R", "W", "Econ", "Dots"]} rows={bowlerRows.map((row) => [row.name, row.overs, row.runs, row.wickets, row.economy, row.dots])}/></AnalyticsCard></div>
  </div>;
}

function AnalyticsCard({ title, icon, cardClass, children }: { title: string; icon: React.ReactNode; cardClass: string; children: React.ReactNode }) { return <section className={`analytics-card overflow-hidden rounded-2xl border shadow-sm ${cardClass}`}><header className="flex items-center gap-2 border-b border-inherit bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-4 text-white">{icon}<h2 className="font-black">{title}</h2></header><div className="p-4 sm:p-5">{children}</div></section>; }
function InsightCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm"><p className="truncate text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black text-primary">{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p></article>; }
function ReportTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) { return <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><thead><tr className="border-b border-border bg-muted/60">{headers.map((header) => <th key={header} className="px-3 py-2.5 text-xs font-black uppercase tracking-wider text-foreground">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-border/70 last:border-0">{row.map((value, cell) => <td key={cell} className={`px-3 py-2.5 ${cell === 0 ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>{value}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-muted-foreground">No verified data yet.</td></tr>}</tbody></table></div>; }
