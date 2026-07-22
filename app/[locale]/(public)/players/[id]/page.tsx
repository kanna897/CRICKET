"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, CircleDot, Shield, Target, User } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { supabase } from "@/lib/supabase";

type Player = { id: string; name: string; photo_url: string | null; playing_role: string | null; batting_style: string | null; bowling_style: string | null; team_id: string | null; created_at: string };
type Team = { id: string; name: string; logo_url: string | null };
type Ball = { innings_id: string; batsman_id: string | null; bowler_id: string | null; fielder_id: string | null; player_out_id: string | null; runs: number | null; is_wicket: boolean | null; dismissal_type: string | null };

export default function PublicPlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!id) return; void (async () => {
    const playerResult = await (supabase.from("players") as any).select("id,name,photo_url,playing_role,batting_style,bowling_style,team_id,created_at").eq("id", id).maybeSingle();
    const row = playerResult.data as Player | null; setPlayer(row);
    if (row?.team_id) { const result = await (supabase.from("teams") as any).select("id,name,logo_url").eq("id", row.team_id).maybeSingle(); setTeam(result.data); }
    const ballResult = await (supabase.from("ball_by_ball") as any).select("innings_id,batsman_id,bowler_id,fielder_id,player_out_id,runs,is_wicket,dismissal_type").or(`batsman_id.eq.${id},bowler_id.eq.${id},fielder_id.eq.${id},player_out_id.eq.${id}`);
    const ballRows = (ballResult.data || []) as Ball[]; setBalls(ballRows);
    const inningsIds = [...new Set(ballRows.map((ball) => ball.innings_id))];
    if (inningsIds.length) { const inningsResult = await (supabase.from("innings") as any).select("match_id").in("id", inningsIds); setMatchCount(new Set((inningsResult.data || []).map((item: { match_id: string }) => item.match_id)).size); }
    setLoading(false);
  })(); }, [id]);
  const stats = useMemo(() => {
    let runs = 0, wickets = 0, catches = 0, stumpings = 0, runOuts = 0, outs = 0; const scores = new Map<string, number>();
    balls.forEach((ball) => { const dismissal = (ball.dismissal_type || "").toLowerCase().replaceAll(" ", "_"); if (ball.batsman_id === id) { const value = Number(ball.runs || 0); runs += value; scores.set(ball.innings_id, (scores.get(ball.innings_id) || 0) + value); } if (ball.player_out_id === id && !dismissal.includes("retired_hurt")) outs++; if (ball.bowler_id === id && ball.is_wicket && !["run_out", "retired_hurt", "obstructing_the_field"].includes(dismissal)) wickets++; if (ball.fielder_id === id && dismissal.includes("caught")) catches++; if (ball.fielder_id === id && dismissal.includes("stump")) stumpings++; if (ball.fielder_id === id && dismissal.includes("run_out")) runOuts++; });
    const recent = [...scores.values()].slice(-6).reverse(); return { runs, wickets, catches, stumpings, runOuts, high: Math.max(0, ...scores.values()), average: outs ? runs / outs : runs, recent };
  }, [balls, id]);
  if (loading) return <><PublicNav /><main className="grid min-h-[60vh] place-items-center text-foreground">Loading player profile…</main></>;
  if (!player) return <><PublicNav /><main className="p-10 text-center text-foreground">Player not found.</main></>;
  const symbol = roleSymbol(player.playing_role);
  return <><PublicNav /><main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-7"><Link href={team ? `/teams/${team.id}` : "/teams"} className="inline-flex items-center gap-2 font-bold text-primary"><ArrowLeft className="h-4 w-4" />Back to squad</Link>
    <section className="overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-[#07162f] via-[#0b2d59] to-[#073c3a] p-5 text-white shadow-2xl sm:p-8"><div className="flex flex-col items-center gap-5 sm:flex-row">{player.photo_url ? <img src={player.photo_url} alt={player.name} className="h-36 w-36 rounded-3xl border-4 border-white object-cover object-top shadow-xl" /> : <span className="grid h-36 w-36 place-items-center rounded-3xl border-4 border-white/70 bg-white/10"><User className="h-16 w-16" /></span>}<div className="min-w-0 text-center sm:text-left"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-wider">{symbol} {player.playing_role || "Player"}</span><h1 className="mt-3 text-3xl font-black sm:text-5xl">{player.name}</h1><p className="mt-2 flex items-center justify-center gap-2 text-cyan-100 sm:justify-start"><Shield className="h-4 w-4" />{team?.name || "Unassigned team"}</p><p className="mt-2 text-sm text-white/65">{player.batting_style || "Batting style not specified"} · {player.bowling_style || "Bowling style not specified"}</p></div></div></section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"><Metric icon={<Award />} label="Matches" value={matchCount} /><Metric icon={<Target />} label="Runs" value={stats.runs} /><Metric icon={<CircleDot />} label="Wickets" value={stats.wickets} /><Metric icon={<Target />} label="High score" value={stats.high} /><Metric icon={<Award />} label="Average" value={stats.average.toFixed(1)} /><Metric icon={<Shield />} label="Fielding" value={stats.catches + stats.stumpings + stats.runOuts} /></section>
    <section className="rounded-2xl border border-border bg-card p-5 text-foreground"><h2 className="text-xl font-black">Recent batting form</h2><p className="mt-1 text-sm text-muted-foreground">Latest recorded innings</p><div className="mt-4 flex flex-wrap gap-3">{stats.recent.length ? stats.recent.map((score, index) => <span key={`${score}-${index}`} className="grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-primary/10 text-lg font-black text-primary">{score}</span>) : <p className="text-sm text-muted-foreground">No recorded batting innings yet.</p>}</div></section>
  </main></>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <div className="rounded-2xl border border-border bg-card p-4 text-center text-foreground shadow-sm"><span className="mx-auto block h-5 w-5 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><p className="mt-2 text-[.65rem] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function roleSymbol(role: string | null) { const value = (role || "").toLowerCase(); return value.includes("wicket") ? "🧤" : value.includes("all") ? "🏏🔴" : value.includes("bowl") ? "🔴" : "🏏"; }
