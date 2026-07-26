"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileJson2, History, Loader2, UploadCloud } from "lucide-react";
import { useAdminAccess } from "@/components/admin-shell";
import { supabase } from "@/lib/supabase";
import { groupHistoricalScores, historicalSampleCsv, normalizeName, parseHistoricalScores, type HistoricalMatchGroup, type HistoricalScoreRow } from "@/lib/historical-score-import";

type Tournament = { id: string; name: string; overs_per_match: number };
type Team = { id: string; name: string };
type ExistingMatch = { id: string; match_date: string | null; team_a_id: string; team_b_id: string };

export default function HistoricalScoreImportPage() {
  const { userId, isMasterAdmin } = useAdminAccess();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [existing, setExisting] = useState<ExistingMatch[]>([]);
  const [groups, setGroups] = useState<HistoricalMatchGroup[]>([]);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(0);

  useEffect(() => { void (async () => {
    let query = (supabase.from("tournaments") as any).select("id,name,overs_per_match").is("deleted_at", null).order("created_at", { ascending: false });
    if (!isMasterAdmin) query = query.eq("organizer_id", userId);
    const { data, error } = await query;
    const rows = (data || []) as Tournament[]; setTournaments(rows); setSelectedTournament(rows[0]?.id || ""); setMessage(error?.message || "");
  })(); }, [isMasterAdmin, userId]);

  useEffect(() => { if (!selectedTournament) return; void (async () => {
    const [teamResult, matchResult] = await Promise.all([
      (supabase.from("teams") as any).select("id,name").eq("tournament_id", selectedTournament).is("deleted_at", null).order("name"),
      (supabase.from("matches") as any).select("id,match_date,team_a_id,team_b_id").eq("tournament_id", selectedTournament),
    ]);
    setTeams((teamResult.data || []) as Team[]); setExisting((matchResult.data || []) as ExistingMatch[]);
    setMessage(teamResult.error?.message || matchResult.error?.message || ""); setGroups([]); setFilename(""); setImported(0);
  })(); }, [selectedTournament]);

  const reviewed = useMemo(() => groups.map((group) => {
    const errors = [...group.errors];
    const teamA = findTeam(group.teamA), teamB = findTeam(group.teamB);
    if (!teamA) errors.push(`Team not found: ${group.teamA}.`);
    if (!teamB) errors.push(`Team not found: ${group.teamB}.`);
    if (teamA && teamB && existing.some((match) => match.match_date === group.matchDate && new Set([match.team_a_id, match.team_b_id]).has(teamA.id) && new Set([match.team_a_id, match.team_b_id]).has(teamB.id))) errors.push("Possible duplicate: same teams and date already exist.");
    return { ...group, errors: [...new Set(errors)] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [groups, teams, existing]);
  const validCount = reviewed.filter((group) => !group.errors.length).length;

  function findTeam(name: string) { return teams.find((team) => normalizeName(team.name) === normalizeName(name)); }
  async function readFile(file: File) {
    setMessage(""); setImported(0);
    try {
      const parsedRows = parseHistoricalScores(await file.text(), file.name);
      setGroups(groupHistoricalScores(await hydrateHandoverRows(parsedRows)));
      setFilename(file.name);
    }
    catch (error) { setGroups([]); setFilename(""); setMessage(error instanceof Error ? error.message : "Unable to read this import file."); }
  }
  async function hydrateHandoverRows(rows: HistoricalScoreRow[]) {
    const cache = new Map<string, { team_a_id:string; team_b_id:string; winner_id:string|null; match_date:string|null; created_at:string; status:string } | null>();
    const hydrated: HistoricalScoreRow[] = [];
    for (const row of rows) {
      if (row.match_date && row.team_a && row.team_b && row.batting_team && Number.isFinite(row.innings_number)) {
        hydrated.push(row);
        continue;
      }
      if (!cache.has(row.match_ref)) {
        const { data } = await (supabase.from("matches") as any)
          .select("team_a_id,team_b_id,winner_id,match_date,created_at,status")
          .eq("id", row.match_ref)
          .maybeSingle();
        cache.set(row.match_ref, data || null);
      }
      const matchRow = cache.get(row.match_ref);
      if (!matchRow) {
        hydrated.push(row);
        continue;
      }
      const teamA = teams.find((team) => team.id === matchRow.team_a_id);
      const teamB = teams.find((team) => team.id === matchRow.team_b_id);
      const batting = teams.find((team) => team.id === row.batting_team_id);
      const winner = teams.find((team) => team.id === matchRow.winner_id);
      hydrated.push({
        ...row,
        match_date: row.match_date || matchRow.match_date || matchRow.created_at.slice(0, 10),
        team_a: row.team_a || teamA?.name || "",
        team_b: row.team_b || teamB?.name || "",
        batting_team: row.batting_team || batting?.name || "",
        winner: row.winner || winner?.name || "No Result",
      });
    }
    return hydrated;
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([historicalSampleCsv()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "crickpulse-past-score-template.csv"; link.click(); URL.revokeObjectURL(url);
  }
  async function importScores() {
    if (!selectedTournament || !validCount || busy) return;
    setBusy(true); setMessage(""); setImported(0);
    let completed = 0;
    try {
      const overs = tournaments.find((tournament) => tournament.id === selectedTournament)?.overs_per_match || 20;
      for (const group of reviewed.filter((item) => !item.errors.length)) {
        const teamA = findTeam(group.teamA)!, teamB = findTeam(group.teamB)!;
        const winner = [teamA, teamB].find((team) => normalizeName(team.name) === normalizeName(group.winner));
        const matchResult = await (supabase.from("matches") as any).insert({
          tournament_id: selectedTournament, team_a_id: teamA.id, team_b_id: teamB.id, match_date: group.matchDate,
          status: "completed", winner_id: winner?.id || null, result_type: winner ? "win" : normalizeName(group.winner) === "tie" ? "tie" : "no_result", overs_per_match: overs,
        }).select("id").single();
        if (matchResult.error) throw new Error(`${group.matchRef}: ${matchResult.error.message}`);
        const matchId = matchResult.data.id as string;
        const inningsRows = group.innings.map((item) => {
          const batting = findTeam(item.batting_team)!;
          const bowling = batting.id === teamA.id ? teamB : teamA;
          return { match_id: matchId, innings_number: item.innings_number, batting_team_id: batting.id, bowling_team_id: bowling.id, total_runs: item.total_runs, total_wickets: item.total_wickets, balls_bowled: item.balls_bowled, overs_completed: Number(`${Math.floor(item.balls_bowled / 6)}.${item.balls_bowled % 6}`), extras: 0, is_completed: true };
        });
        const inningsResult = await (supabase.from("innings") as any).insert(inningsRows);
        if (inningsResult.error) { await (supabase.from("matches") as any).delete().eq("id", matchId); throw new Error(`${group.matchRef}: ${inningsResult.error.message}`); }
        completed++;
      }
      setImported(completed); setMessage(`${completed} historical match${completed === 1 ? "" : "es"} imported successfully.`);
      const { data } = await (supabase.from("matches") as any).select("id,match_date,team_a_id,team_b_id").eq("tournament_id", selectedTournament);
      setExisting((data || []) as ExistingMatch[]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Historical score import failed."); }
    finally { setBusy(false); }
  }

  return <div className="admin-themed-page mx-auto max-w-6xl space-y-6">
    <header><p className="text-sm font-black uppercase tracking-widest text-primary">Data migration</p><h1 className="mt-1 flex items-center gap-3 text-3xl font-black"><History className="h-8 w-8 text-primary" />Past Match / Score Import</h1><p className="mt-2 text-muted-foreground">Bring previous tournament results into standings without entering every delivery.</p></header>
    {message && <p role="alert" className={`rounded-xl border p-4 text-sm font-bold ${imported ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{message}</p>}
    <section className="grid gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm lg:grid-cols-[1fr_1.4fr]">
      <div><label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Destination tournament<select value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground">{tournaments.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><p className="mt-3 text-xs text-muted-foreground">{teams.length} registered teams available for exact name matching.</p></div>
      <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[.04] p-5"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><UploadCloud /></span><div><h2 className="font-black">Upload CSV or JSON</h2><p className="text-xs text-muted-foreground">Maximum 2 innings per match. File is validated before import.</p></div></div><div className="mt-4 flex flex-wrap gap-2"><label className="inline-flex h-11 cursor-pointer items-center rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground"><FileJson2 className="mr-2 h-4 w-4" />Choose file<input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} /></label><button type="button" onClick={downloadTemplate} className="inline-flex h-11 items-center rounded-xl border border-border bg-background px-4 text-sm font-black"><Download className="mr-2 h-4 w-4" />Download template</button></div>{filename && <p className="mt-3 truncate text-xs font-bold text-primary">Loaded: {filename}</p>}</div>
    </section>
    {reviewed.length > 0 && <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-black">Validation preview</h2><p className="text-sm text-muted-foreground">{validCount} ready · {reviewed.length - validCount} need attention</p></div><button type="button" onClick={() => void importScores()} disabled={!validCount || busy} className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-50">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}Import {validCount} valid match{validCount === 1 ? "" : "es"}</button></div>
      <div className="divide-y divide-border">{reviewed.map((group) => <article key={group.matchRef} className="grid gap-3 p-5 md:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-2">{group.errors.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}<h3 className="font-black">{group.matchRef} · {group.teamA} vs {group.teamB}</h3></div><p className="mt-1 text-sm text-muted-foreground">{group.matchDate} · Winner: {group.winner} · {group.innings.length} innings</p>{group.errors.length > 0 && <ul className="mt-2 space-y-1 text-xs font-bold text-amber-700">{group.errors.map((error) => <li key={error}>• {error}</li>)}</ul>}</div><div className="flex gap-2">{group.innings.map((item) => <span key={item.innings_number} className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-center text-xs"><strong className="block text-base">{item.total_runs}/{item.total_wickets}</strong>Inn {item.innings_number}</span>)}</div></article>)}</div>
    </section>}
  </div>;
}
