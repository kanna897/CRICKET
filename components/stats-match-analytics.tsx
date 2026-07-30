"use client";
 

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MatchAnalyticsDashboard } from "@/components/match-analytics-dashboard";

type MatchOption = { id: string; team_a_id: string; team_b_id: string; status: string };
type Team = { id: string; name: string };

export function StatsMatchAnalytics() {
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMatch, setSelectedMatch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    const matchResult = await supabase.from("matches")
      .select("id,team_a_id,team_b_id,status")
      .in("status", ["live", "completed"])
      .order("created_at", { ascending: false });
    const rows = (matchResult.data || []) as MatchOption[];
    const teamIds = [...new Set(rows.flatMap((match) => [match.team_a_id, match.team_b_id]))];
    const teamResult = teamIds.length
      ? await supabase.from("teams").select("id,name").in("id", teamIds)
      : { data: [], error: null };
    setMatches(rows);
    setTeams((teamResult.data || []) as Team[]);
    setSelectedMatch(rows[0]?.id || "");
    setMessage(matchResult.error?.message || teamResult.error?.message || "");
    setLoading(false);
  })(); }, []);

  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || "Team";

  return <section className="mx-auto mt-10 max-w-6xl space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-black uppercase tracking-[0.2em] text-primary">Ball-by-ball intelligence</p><h2 className="mt-1 text-3xl font-black text-foreground">Match Visual Analytics</h2><p className="mt-2 text-sm text-muted-foreground">Wagon Wheel, over comparison and run progression from a selected match.</p></div>
      {!!matches.length && <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Match<select aria-label="Analytics match" value={selectedMatch} onChange={(event) => setSelectedMatch(event.target.value)} className="mt-1 block w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-bold text-foreground sm:min-w-80">{matches.map((match) => <option key={match.id} value={match.id}>{teamName(match.team_a_id)} vs {teamName(match.team_b_id)} · {match.status}</option>)}</select></label>}
    </header>
    {message && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    {loading ? <div className="grid min-h-48 place-items-center rounded-2xl border border-border bg-card"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : selectedMatch ? <MatchAnalyticsDashboard matchId={selectedMatch} embedded /> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-foreground"><Activity className="mx-auto h-9 w-9 text-primary" /><p className="mt-3 font-black">Visual analytics appear after a match starts scoring.</p></div>}
  </section>;
}
