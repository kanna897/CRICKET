"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Radio } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LiveCommentary } from "@/components/live-commentary";

type Match = { id: string; team_a_id: string; team_b_id: string; overs_per_match: number; status: string };
type Team = { id: string; name: string };
type Innings = { id: string; innings_number: number; batting_team_id: string; total_runs: number; total_wickets: number; balls_bowled: number; target: number | null };

export default function PublicLiveMatch() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [innings, setInnings] = useState<Innings | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: matchRow } = await (supabase.from("matches") as any).select("id,team_a_id,team_b_id,overs_per_match,status").eq("id", id).maybeSingle();
      if (!matchRow) return;
      const [{ data: teamRows }, { data: inningsRow }] = await Promise.all([
        (supabase.from("teams") as any).select("id,name").in("id", [matchRow.team_a_id, matchRow.team_b_id]),
        (supabase.from("innings") as any).select("id,innings_number,batting_team_id,total_runs,total_wickets,balls_bowled,target").eq("match_id", id).order("innings_number", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMatch(matchRow); setTeams(teamRows || []); setInnings(inningsRow || null);
    };
    load();
    const channel = supabase.channel(`public-score:${id}`).on("postgres_changes", { event: "*", schema: "public", table: "innings", filter: `match_id=eq.${id}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const teamName = (teamId: string | null | undefined) => teams.find((team) => team.id === teamId)?.name || "Team";
  const overs = innings ? `${Math.floor(innings.balls_bowled / 6)}.${innings.balls_bowled % 6}` : "0.0";

  if (!match) return <main className="max-w-3xl mx-auto p-6 text-center text-muted-foreground">Loading match…</main>;

  return <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back to live matches</Link>
    <section className="bg-card border border-border rounded-2xl p-6 text-center shadow-sm">
      <div className="flex justify-center items-center gap-2 text-red-600 text-sm font-bold mb-5"><Radio className="w-4 h-4" />{match.status === "live" ? "LIVE" : match.status.toUpperCase()}</div>
      <p className="font-semibold text-lg">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)}</p>
      <p className="text-muted-foreground text-sm mt-2">{innings ? `${teamName(innings.batting_team_id)} batting · Innings ${innings.innings_number}` : "Innings not started"}</p>
      <p className="text-5xl font-black tracking-tight mt-3">{innings ? `${innings.total_runs}/${innings.total_wickets}` : "0/0"}</p>
      <p className="mt-2 text-muted-foreground">{overs} / {match.overs_per_match}.0 overs{innings?.target ? ` · Target ${innings.target}` : ""}</p>
    </section>
    <LiveCommentary inningsId={innings?.id || null} />
  </main>;
}
