"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- live match columns are newer than generated local Supabase types */

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trophy } from "lucide-react";
import { PublicNav } from "@/components/public-nav";
import { PointsTablePoster } from "@/components/points-table-poster";
import { supabase } from "@/lib/supabase";
import { calculateTournamentStandings, type StandingRow, type StandingsInnings, type StandingsMatch, type StandingsTeam } from "@/lib/tournament-standings";

type Tournament = { id: string; name: string; logo_url: string | null };

export default function PointsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState<StandingsTeam[]>([]);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { void (async () => {
    const { data, error } = await (supabase.from("tournaments") as any).select("id,name,logo_url").order("created_at", { ascending: false });
    const items = (data || []) as Tournament[];
    setTournaments(items);
    setSelectedTournament(items[0]?.id || "");
    setMessage(error?.message || "");
    if (!items.length) setLoading(false);
  })(); }, []);

  const load = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading(true); setMessage("");
    const [teamResult, matchResult] = await Promise.all([
      (supabase.from("teams") as any).select("id,name,logo_url").eq("tournament_id", selectedTournament).order("name"),
      (supabase.from("matches") as any).select("id,team_a_id,team_b_id,status,winner_id").eq("tournament_id", selectedTournament),
    ]);
    const teamRows = (teamResult.data || []) as StandingsTeam[];
    const matchRows = (matchResult.data || []) as StandingsMatch[];
    const matchIds = matchRows.map((match) => match.id);
    const inningsResult = matchIds.length
      ? await (supabase.from("innings") as any).select("match_id,batting_team_id,bowling_team_id,total_runs,total_wickets,balls_bowled").in("match_id", matchIds)
      : { data: [], error: null };
    setTeams(teamRows);
    setRows(calculateTournamentStandings(teamRows, matchRows, (inningsResult.data || []) as StandingsInnings[]));
    setMessage(teamResult.error?.message || matchResult.error?.message || inningsResult.error?.message || "");
    setLoading(false);
  }, [selectedTournament]);

  useEffect(() => { void load(); }, [load]);
  const tournamentName = tournaments.find((item) => item.id === selectedTournament)?.name || "Tournament";
  const tournamentLogo = tournaments.find((item) => item.id === selectedTournament)?.logo_url || null;

  return <><PublicNav /><main className="mx-auto max-w-5xl p-4 sm:p-7">
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-widest text-sky-600">Tournament standings</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black text-foreground"><Trophy className="h-8 w-8 text-amber-500" />Points Table</h1><p className="mt-2 text-sm text-muted-foreground">Download and share the official standings poster. Q marks the top-four qualification zone.</p></div>
      <div className="flex gap-2"><select aria-label="Tournament" value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 font-bold text-foreground sm:min-w-64">{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" onClick={() => void load()} disabled={loading || !selectedTournament} aria-label="Refresh standings" className="rounded-xl border border-border bg-card px-3 text-primary disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button></div>
    </header>
    {message && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    {loading ? <div className="grid min-h-56 place-items-center rounded-2xl border border-border bg-card"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : rows.length ? <PointsTablePoster tournamentName={tournamentName} tournamentLogo={tournamentLogo} rows={rows} teams={teams} /> : <p className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">Points table will appear after teams and completed matches are available.</p>}
  </main></>;
}
