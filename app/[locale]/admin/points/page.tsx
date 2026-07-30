"use client";
 

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ListOrdered, Loader2, RefreshCw, Trophy } from "lucide-react";
import { useAdminAccess } from "@/components/admin-shell";
import { PointsTablePoster } from "@/components/points-table-poster";
import { supabase } from "@/lib/supabase";
import { calculateTournamentStandings, defaultPointsRules, type PointsRules, type StandingRow, type StandingsInnings, type StandingsMatch } from "@/lib/tournament-standings";
import { QualificationSimulator } from "@/components/qualification-simulator";

type Tournament = { id: string; name: string; logo_url: string | null };
type Team = { id: string; name: string; logo_url: string | null };

export default function AdminPointsPage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [matches, setMatches] = useState<StandingsMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rules, setRules] = useState<PointsRules>(defaultPointsRules);

  useEffect(() => {
    if (!selectedTournament) return;
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(`crickpulse-points-rules:${selectedTournament}`);
      if (!saved) { setRules(defaultPointsRules); return; }
      try { setRules({ ...defaultPointsRules, ...JSON.parse(saved) }); } catch { setRules(defaultPointsRules); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedTournament]);

  const updateRule = (key: keyof PointsRules, value: number) => {
    const next = { ...rules, [key]: Math.max(0, Number.isFinite(value) ? value : 0) };
    setRules(next);
    if (selectedTournament) window.localStorage.setItem(`crickpulse-points-rules:${selectedTournament}`, JSON.stringify(next));
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      let query = supabase.from("tournaments").select("id,name,logo_url").order("created_at", { ascending: false });
      if (!isMasterAdmin) query = query.eq("organizer_id", userId);
      const { data, error } = await query;
      const rows = (data || []) as Tournament[];
      setTournaments(rows);
      setSelectedTournament((current) => current || rows[0]?.id || "");
      setMessage(error?.message || "");
      if (!rows.length) setLoading(false);
    })();
  }, [isMasterAdmin, userId]);

  const loadStandings = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading(true);
    setMessage("");
    const [{ data: matchRows, error: matchesError }, { data: teamRows, error: teamsError }] = await Promise.all([
      supabase.from("matches").select("id,team_a_id,team_b_id,status,winner_id").eq("tournament_id", selectedTournament),
      supabase.from("teams").select("id,name,logo_url").eq("tournament_id", selectedTournament).order("name"),
    ]);
    const matches = (matchRows || []) as StandingsMatch[];
    setMatches(matches);
    const matchIds = matches.map((match) => match.id);
    const inningsResult = matchIds.length ? await supabase.from("innings").select("match_id,batting_team_id,bowling_team_id,total_runs,total_wickets,balls_bowled").in("match_id", matchIds) : { data: [], error: null };
    const tournamentTeams = (teamRows || []) as Team[];
    setStandings(calculateTournamentStandings(tournamentTeams, matches, (inningsResult.data || []) as StandingsInnings[], rules));
    setTeams(tournamentTeams);
    setMessage(matchesError?.message || teamsError?.message || inningsResult.error?.message || "");
    setLoading(false);
  }, [selectedTournament, rules]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStandings(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStandings]);

  const team = (teamId: string) => teams.find((item) => item.id === teamId);
  const tournamentName = tournaments.find((item) => item.id === selectedTournament)?.name || "Tournament";
  const tournamentLogo = tournaments.find((item) => item.id === selectedTournament)?.logo_url || null;

  return <div className="admin-themed-page mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-bold uppercase tracking-widest text-primary">Tournament standings</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black"><Trophy className="h-8 w-8 text-amber-500" />Points Table</h1><p className="mt-2 text-muted-foreground">{isMasterAdmin ? "View standings from every tournament." : "View standings from your tournaments."}</p></div>
      <div className="flex w-full gap-2 sm:w-auto"><label className="sr-only" htmlFor="points-tournament">Tournament</label><select id="points-tournament" value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2.5 font-semibold sm:min-w-64">{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select><button type="button" onClick={() => void loadStandings()} disabled={!selectedTournament || loading} className="inline-flex items-center justify-center rounded-lg border border-input bg-card px-3 text-primary hover:bg-muted disabled:opacity-50" aria-label="Refresh standings"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button></div>
    </header>

    {message && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>}
    <PointsTablePoster tournamentName={tournamentName} tournamentLogo={tournamentLogo} rows={standings} teams={teams} />
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">Custom points rules</h2><p className="mt-1 text-xs text-muted-foreground">Preview alternative league rules without changing match results. Saved for this tournament on this device.</p></div><div className="grid grid-cols-3 gap-2"><RuleInput label="Win" value={rules.win} onChange={(value) => updateRule("win", value)} /><RuleInput label="Tie/NR" value={rules.tie} onChange={(value) => updateRule("tie", value)} /><RuleInput label="Loss" value={rules.loss} onChange={(value) => updateRule("loss", value)} /></div></div></section>
    <QualificationSimulator teams={teams} matches={matches} standings={standings} rules={rules} />
    {!tournaments.length && !loading ? <section className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><ListOrdered className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-bold">No tournaments available.</p></section> :
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-hidden="true">
        {loading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : <>
          <div className="grid gap-3 p-3 sm:hidden">{standings.map((row, index) => { const current = team(row.team_id); const qualified = standings.length >= 4 && index < 4; return <article key={row.team_id} className={`rounded-xl border bg-background/40 p-4 ${qualified ? "border-emerald-400/60" : "border-border"}`}><div className="flex items-center gap-3">{current?.logo_url ? <Image unoptimized width={128} height={128} src={current.logo_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 font-black text-primary">{current?.name?.slice(0, 2) || "T"}</span>}<div className="min-w-0 flex-1"><p className="text-xs font-black text-primary">#{index + 1}{qualified && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600">QUALIFIED</span>}</p><p className="truncate font-black">{current?.name || "Team"}</p></div><p className="text-2xl font-black text-emerald-600">{row.points}<span className="ml-1 text-[0.65rem] uppercase text-muted-foreground">pts</span></p></div><div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs"><Stat label="P" value={row.played} /><Stat label="W" value={row.won} /><Stat label="L" value={row.lost} /><Stat label="T" value={row.tied} /><Stat label="NRR" value={`${row.nrr >= 0 ? "+" : ""}${row.nrr.toFixed(3)}`} /></div></article>; })}</div>
          <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs font-black uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-4">#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NRR</th><th className="pr-5 text-right">Pts</th></tr></thead><tbody>{standings.map((row, index) => { const current = team(row.team_id); const qualified = standings.length >= 4 && index < 4; return <tr key={row.team_id} className={`border-b border-border last:border-0 ${qualified ? "bg-emerald-500/[0.04]" : ""}`}><td className="px-5 py-4 font-black text-primary">{index + 1}</td><td><span className="flex items-center gap-3 font-bold">{current?.logo_url ? <Image unoptimized width={128} height={128} src={current.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{current?.name?.slice(0, 2) || "T"}</span>}{current?.name || "Team"}{qualified && <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[0.6rem] font-black text-emerald-600">Q</span>}</span></td><td>{row.played}</td><td className="font-bold text-emerald-600">{row.won}</td><td className="font-bold text-red-500">{row.lost}</td><td>{row.tied}</td><td className={row.nrr >= 0 ? "font-bold text-emerald-600" : "font-bold text-red-500"}>{row.nrr >= 0 ? "+" : ""}{row.nrr.toFixed(3)}</td><td className="pr-5 text-right text-xl font-black text-emerald-600">{row.points}</td></tr>; })}</tbody></table></div>
          {!standings.length && <p className="p-12 text-center text-muted-foreground">Points table will appear after matches are completed.</p>}
        </>}
      </section>}
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-muted/60 px-2 py-2"><p className="font-black text-muted-foreground">{label}</p><p className="mt-1 font-black text-foreground">{value}</p></div>; }

function RuleInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-xs font-black text-muted-foreground">{label}<input type="number" min="0" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 block w-full min-w-16 rounded-lg border border-input bg-background px-3 py-2 text-center text-base font-black text-foreground" /></label>;
}
