"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarPlus, ClipboardList, Loader2, LockKeyhole, PlayCircle, ShieldCheck, Sparkles, Trash2, UnlockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";
import { useAdminAccess } from "@/components/admin-shell";
import { localePath } from "@/lib/locale-path";
import { generateSingleRoundRobin, scheduleRoundRobinMatches, validateSingleRoundRobin } from "@/lib/round-robin";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
type Match = {
  id: string;
  tournament_id: string | null;
  team_a_id: string;
  team_b_id: string;
  ground: string | null;
  match_date: string | null;
  match_time: string | null;
  status: string;
  overs_per_match: number;
  assigned_scorer_id: string | null;
  scoring_locked: boolean;
  organizer_id: string | null;
  match_scope: "tournament" | "standalone";
  match_type: string;
  title: string | null;
  fixture_round: number | null;
  match_number: number | null;
  fixture_source: string | null;
  generation_batch_id: string | null;
};

type FixturePreviewMatch = Database["public"]["Tables"]["matches"]["Insert"] & {
  team_a_id: string;
  team_b_id: string;
  fixture_round: number;
  match_number: number;
};
type FixturePreviewDay = { day: number; date: string; matches: FixturePreviewMatch[] };

export default function MatchesPage() {
  const { locale } = useParams<{ locale: string }>();
  const { isMasterAdmin, userId } = useAdminAccess();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAssignment, setSavingAssignment] = useState("");
  const [message, setMessage] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generator, setGenerator] = useState({ tournamentId: "", startDate: "", matchTime: "09:00", ground: "", restDays: "1", matchesPerDay: "4", matchDuration: "60", breakMinutes: "15" });
  const [fixturePreview, setFixturePreview] = useState<FixturePreviewDay[]>([]);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupTournamentId, setCleanupTournamentId] = useState("");
  const [cleanupSelected, setCleanupSelected] = useState<string[]>([]);
  const [removingFixtures, setRemovingFixtures] = useState(false);

  useEffect(() => {
    async function loadMatches() {
    let tournamentQuery = supabase.from("tournaments").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (!isMasterAdmin) tournamentQuery = tournamentQuery.eq("organizer_id", userId);
      const tournamentsResult = await tournamentQuery;
      const ids = (tournamentsResult.data || [] as Tournament[]).map((item: Tournament) => item.id);
      const [matchesResult, teamsResult] = await Promise.all([
        supabase.from("matches").select("*").order("created_at", { ascending: false }),
        supabase.from("teams").select("*").order("name"),
      ]);
      const manageableMatches = ((matchesResult.data || []) as Match[]).filter((match) =>
        match.tournament_id
          ? ids.includes(match.tournament_id)
          : isMasterAdmin || match.organizer_id === userId
      );
      const manageableTeamIds = new Set(manageableMatches.flatMap((match) => [match.team_a_id, match.team_b_id]));
      const manageableTeams = (teamsResult.data || []).filter((team: Team & { organizer_id?: string | null }) =>
        team.tournament_id
          ? ids.includes(team.tournament_id)
          : isMasterAdmin || team.organizer_id === userId || manageableTeamIds.has(team.id)
      );
      setMatches(manageableMatches);
      setTeams(manageableTeams);
      if (tournamentsResult.data) setTournaments(tournamentsResult.data);
      setLoading(false);
    }
    loadMatches();
  }, [isMasterAdmin, userId]);

  const team = (id: string) => teams.find((item) => item.id === id);
  const tournamentName = (id: string | null) => tournaments.find((tournament) => tournament.id === id)?.name || "Independent match";
  const matchOwner = (match: Match) => match.organizer_id || tournaments.find((tournament) => tournament.id === match.tournament_id)?.organizer_id || null;
  const updateScorer = async (match: Match, assigned: boolean) => {
    setSavingAssignment(match.id); setMessage("");
    const ownerId = matchOwner(match);
    const { error } = await supabase.from("matches").update({ assigned_scorer_id: assigned ? ownerId : null }).eq("id", match.id);
    if (error) setMessage(error.message);
    else setMatches((rows) => rows.map((row) => row.id === match.id ? { ...row, assigned_scorer_id: assigned ? ownerId : null } : row));
    setSavingAssignment("");
  };
  const toggleLock = async (match: Match) => {
    setSavingAssignment(match.id); setMessage("");
    const ownerId = matchOwner(match);
    const nextLocked = !match.scoring_locked;
    const { error } = await supabase.from("matches").update({ scoring_locked: nextLocked, assigned_scorer_id: nextLocked ? (match.assigned_scorer_id || ownerId) : match.assigned_scorer_id }).eq("id", match.id);
    if (error) setMessage(error.message);
    else setMatches((rows) => rows.map((row) => row.id === match.id ? { ...row, scoring_locked: nextLocked, assigned_scorer_id: nextLocked ? (row.assigned_scorer_id || ownerId) : row.assigned_scorer_id } : row));
    setSavingAssignment("");
  };
  const generatePreview = () => {
    setMessage("");
    setFixturePreview([]);
    const tournamentTeams = teams.filter((team) => team.tournament_id === generator.tournamentId);
    if (!generator.tournamentId || !generator.startDate) return setMessage("Tournament and start date are required.");
    if (tournamentTeams.length < 2) return setMessage("Fixture generation needs at least two teams.");
    try {
      const existing = matches.filter((match) => match.tournament_id === generator.tournamentId);
      const existingPairs = new Set(existing.map((match) => [match.team_a_id, match.team_b_id].sort().join(":")));
      const interval = Math.max(1, Number(generator.restDays) || 1);
      const tournament = tournaments.find((item) => item.id === generator.tournamentId);
      const rounds = generateSingleRoundRobin(tournamentTeams.map((item) => item.id));
      validateSingleRoundRobin(tournamentTeams.map((item) => item.id), rounds);
      const matchesPerDay = Math.max(1, Math.min(50, Number(generator.matchesPerDay) || 1));
      const slotMinutes = Math.max(1, Number(generator.matchDuration) || 60) + Math.max(0, Number(generator.breakMinutes) || 0);
      const unscheduledRounds = rounds.map((round) => ({ ...round, matches: round.matches.filter((pair) => !existingPairs.has([pair.teamAId, pair.teamBId].sort().join(":"))) }));
      const scheduled = scheduleRoundRobinMatches(unscheduledRounds, matchesPerDay);
      if (generator.matchTime && timeToMinutes(generator.matchTime) + (matchesPerDay - 1) * slotMinutes >= 1440) throw new Error("Daily match times cross midnight. Reduce matches per day, duration or break time.");
      let nextMatchNumber = Math.max(0, ...existing.map((match) => match.match_number || 0)) + 1;
      const previewMatches = scheduled.flatMap((pair) => {
          const date = addDays(generator.startDate, pair.dayIndex * interval);
          const match: FixturePreviewMatch = {
            tournament_id: generator.tournamentId,
            organizer_id: tournament?.organizer_id || userId,
            match_scope: "tournament",
            match_type: "tournament",
            team_a_id: pair.teamAId,
            team_b_id: pair.teamBId,
            fixture_round: pair.round,
            match_number: nextMatchNumber++,
            match_date: date,
            match_time: generator.matchTime ? addMinutes(generator.matchTime, pair.slotIndex * slotMinutes) : null,
            ground: generator.ground || tournament?.venue || null,
            overs_per_match: tournament?.overs || 20,
            status: "scheduled",
            assigned_scorer_id: tournament?.organizer_id || userId,
            scoring_locked: false,
          };
          return [match];
        });
      const preview = [...new Set(previewMatches.map((match) => match.match_date!))].map((date, day) => ({ day: day + 1, date, matches: previewMatches.filter((match) => match.match_date === date) }));
      if (!previewMatches.length) throw new Error("All round-robin team pairings are already scheduled.");
      setFixturePreview(preview);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Fixture preview failed.");
    }
  };
  const confirmFixtures = async () => {
    const rows = fixturePreview.flatMap((day) => day.matches);
    if (!rows.length || !generator.tournamentId) return;
    setGenerating(true); setMessage("");
    try {
      const generationBatchId = crypto.randomUUID();
      const { data: currentRows, error: currentError } = await supabase.from("matches").select("team_a_id,team_b_id").eq("tournament_id", generator.tournamentId);
      if (currentError) throw currentError;
      const currentPairs = new Set((currentRows || []).map((match) => [match.team_a_id, match.team_b_id].sort().join(":")));
      if (rows.some((match) => currentPairs.has([match.team_a_id, match.team_b_id].sort().join(":")))) throw new Error("Fixtures changed after preview. Generate a fresh preview before saving.");
      const generatedRows = rows.map((match) => ({ ...match, fixture_source: "auto", generation_batch_id: generationBatchId }));
      const { data, error } = await supabase.from("matches").insert(generatedRows).select("*");
      if (error) throw error;
      setMatches((current) => [...((data || []) as Match[]), ...current]);
      setFixturePreview([]);
      setGeneratorOpen(false);
      setMessage(`${rows.length} round-robin fixtures generated successfully.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Fixture generation failed.");
    } finally {
      setGenerating(false);
    }
  };
  const cleanupCandidates = matches.filter((match) => match.tournament_id === cleanupTournamentId && match.match_scope === "tournament" && match.status === "scheduled");
  const removeGeneratedFixtures = async () => {
    if (!cleanupTournamentId || !cleanupSelected.length) return setMessage("Select generated fixtures to remove.");
    const selectedTournament = tournaments.find((item) => item.id === cleanupTournamentId);
    const confirmation = window.prompt(`Type ${selectedTournament?.name || "the tournament name"} to remove ${cleanupSelected.length} generated fixture(s).`);
    if (confirmation !== selectedTournament?.name) return setMessage("Removal cancelled: tournament name did not match.");
    setRemovingFixtures(true); setMessage("");
    try {
      const selectedIds = [...cleanupSelected];
      const { data, error } = await supabase.rpc("delete_unplayed_generated_fixtures", { p_tournament_id: cleanupTournamentId, p_match_ids: selectedIds });
      if (error) throw error;
      const removedIds = new Set(selectedIds);
      setMatches((current) => current.filter((match) => !removedIds.has(match.id)));
      setCleanupSelected([]);
      setMessage(`${data || selectedIds.length} generated fixture(s) removed safely.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Generated fixtures could not be removed.");
    } finally { setRemovingFixtures(false); }
  };

  return (
    <div className="admin-themed-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Matches & Scoring</h1><p className="text-muted-foreground mt-1">Schedule fixtures and start live scoring.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setGeneratorOpen((value)=>!value)} className="inline-flex h-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary"><Sparkles className="mr-2 h-4 w-4"/>Auto Generate</button><button type="button" onClick={()=>setCleanupOpen((value)=>!value)} className="inline-flex h-10 items-center justify-center rounded-md border border-red-400/40 bg-red-500/10 px-4 text-sm font-black text-red-600"><Trash2 className="mr-2 h-4 w-4"/>Remove Generated</button><Link href={localePath(locale, "/admin/matches/new")} className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 text-sm font-medium"><CalendarPlus className="w-4 h-4 mr-2" />Schedule Match</Link></div>
      </div>
      {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-foreground">{message}</p>}
      {generatorOpen&&<section className="rounded-2xl border border-primary/30 bg-card p-5 shadow-lg"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Automatic fixture generator</p><h2 className="mt-1 text-xl font-black">Fair sequential round-robin schedule</h2><p className="mt-1 text-sm text-muted-foreground">Every pair plays once · one match at a time · a team is never placed in the immediately following match.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="space-y-2 text-sm font-bold lg:col-span-2">Tournament<select className="input" value={generator.tournamentId} onChange={(event)=>{setGenerator({...generator,tournamentId:event.target.value});setFixturePreview([]);}}><option value="">Select tournament</option>{tournaments.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-2 text-sm font-bold">First match date<input type="date" className="input" value={generator.startDate} onChange={(event)=>{setGenerator({...generator,startDate:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold">First match time<input type="time" className="input" value={generator.matchTime} onChange={(event)=>{setGenerator({...generator,matchTime:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold">Matches per day<input type="number" min="1" max="50" className="input" value={generator.matchesPerDay} onChange={(event)=>{setGenerator({...generator,matchesPerDay:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold">Match duration (minutes)<input type="number" min="1" max="720" className="input" value={generator.matchDuration} onChange={(event)=>{setGenerator({...generator,matchDuration:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold">Break after match (minutes)<input type="number" min="0" max="240" className="input" value={generator.breakMinutes} onChange={(event)=>{setGenerator({...generator,breakMinutes:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold">Days between match days<input type="number" min="1" max="30" className="input" value={generator.restDays} onChange={(event)=>{setGenerator({...generator,restDays:event.target.value});setFixturePreview([]);}}/></label><label className="space-y-2 text-sm font-bold sm:col-span-2">Ground / Venue<input className="input" placeholder="Tournament venue used if empty" value={generator.ground} onChange={(event)=>{setGenerator({...generator,ground:event.target.value});setFixturePreview([]);}}/></label><button type="button" disabled={generating} onClick={generatePreview} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-black text-primary-foreground disabled:opacity-50"><Sparkles className="mr-2 h-4 w-4"/>Generate preview</button></div>{fixturePreview.length>0&&<div className="mt-6 space-y-4 border-t border-border pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Fixture preview</h3><p className="text-sm text-muted-foreground">{fixturePreview.reduce((sum,day)=>sum+day.matches.length,0)} matches · No database changes yet</p></div><button type="button" disabled={generating} onClick={()=>void confirmFixtures()} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-5 font-black text-white disabled:opacity-50">{generating?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<ShieldCheck className="mr-2 h-4 w-4"/>}Confirm & Save</button></div><div className="grid gap-3 lg:grid-cols-2">{fixturePreview.map((day)=><article key={day.date} className="rounded-xl border border-border bg-background/50 p-4"><div className="flex items-center justify-between"><h4 className="font-black text-primary">Match Day {day.day}</h4><span className="text-xs font-bold text-muted-foreground">{day.date}</span></div><div className="mt-3 space-y-2">{day.matches.map((match)=><div key={`${match.team_a_id}-${match.team_b_id}`} className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span className="font-mono text-xs text-muted-foreground">#{match.match_number}</span><strong className="truncate text-right">{team(match.team_a_id)?.name}</strong><span className="text-xs font-black text-primary">VS</span><strong className="truncate">{team(match.team_b_id)?.name}</strong><span className="font-mono text-xs font-bold text-primary">{match.match_time}</span></div>)}</div></article>)}</div></div>}</section>}

      {cleanupOpen&&<GeneratedFixtureCleanup tournaments={tournaments} teams={teams} tournamentId={cleanupTournamentId} onTournamentChange={(id)=>{setCleanupTournamentId(id);setCleanupSelected([]);}} candidates={cleanupCandidates} selected={cleanupSelected} onSelectedChange={setCleanupSelected} removing={removingFixtures} onRemove={()=>void removeGeneratedFixtures()}/>}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? <div className="py-14 text-center text-muted-foreground">Loading matches…</div> : matches.length === 0 ? (
          <div className="py-16 text-center"><ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><h2 className="font-semibold">No matches scheduled</h2><p className="text-sm text-muted-foreground mt-1">Create a fixture to begin scoring.</p></div>
        ) : <div className="divide-y divide-border">
          {matches.map((match) => <div key={match.id} className="flex flex-col gap-4 bg-[linear-gradient(135deg,rgba(11,41,93,.28),transparent_58%)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-wider text-primary">{match.match_scope === "standalone" ? (match.title || "Standalone match") : tournamentName(match.tournament_id)}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${match.match_scope === "standalone" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>{match.match_type}</span>{match.fixture_round&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Round {match.fixture_round}</span>}{match.match_number&&<span className="font-mono text-[10px] font-black text-muted-foreground">Match #{match.match_number}</span>}</div><div className="grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2"><ScheduleTeam item={team(match.team_a_id)} /><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-xs font-black text-slate-950 shadow-lg">VS</span><ScheduleTeam item={team(match.team_b_id)} reverse /></div><div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-primary/20 bg-background/55 px-3 py-2 text-xs font-bold text-muted-foreground"><span>{match.match_date || "Date TBC"}</span><span className="text-primary">{match.match_time || "Time TBC"}</span>{match.ground && <span>{match.ground}</span>}<span>{match.overs_per_match} overs</span></div></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium capitalize">{match.status}</span>
              <label className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs font-bold"><ShieldCheck className="h-4 w-4 text-primary" /><select aria-label="Assigned scorer" value={match.assigned_scorer_id ? "owner" : "none"} onChange={(event) => void updateScorer(match, event.target.value === "owner")} disabled={savingAssignment === match.id || match.scoring_locked} className="bg-transparent text-foreground outline-none"><option value="owner">Match Organizer</option><option value="none">Not assigned</option></select></label>
              <button type="button" onClick={() => void toggleLock(match)} disabled={savingAssignment === match.id || (!match.assigned_scorer_id && !matchOwner(match))} className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-black ${match.scoring_locked ? "border-amber-400 bg-amber-500/15 text-amber-600" : "border-input bg-background text-foreground"}`}>{match.scoring_locked ? <LockKeyhole className="mr-1 h-4 w-4" /> : <UnlockKeyhole className="mr-1 h-4 w-4" />}{match.scoring_locked ? "Scorer locked" : "Lock scorer"}</button>
              {(!match.scoring_locked || isMasterAdmin || match.assigned_scorer_id === userId) ? <Link href={localePath(locale, `/admin/matches/score/${match.id}`)} className="inline-flex items-center rounded-md bg-primary text-primary-foreground h-9 px-3 text-sm font-medium"><PlayCircle className="w-4 h-4 mr-1" />Score</Link> : <span className="inline-flex h-9 items-center rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-800">Assigned scorer only</span>}
              <Link href={localePath(locale, `/admin/matches/teamsheet/${match.id}`)} className="inline-flex items-center rounded-md border border-input h-9 px-3 text-sm font-medium">Team Sheet</Link>
            </div>
          </div>)}
        </div>}
      </div>
    </div>
  );
}

function ScheduleTeam({ item, reverse = false }: { item?: Team; reverse?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-gradient-to-b from-white to-slate-200 px-3 py-2 text-slate-950 shadow-lg ${reverse ? "flex-row-reverse text-right" : ""}`}>{item?.logo_url ? <Image unoptimized width={96} height={96} src={item.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-1 ring-1 ring-slate-300" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 font-black">T</span>}<strong className="min-w-0 flex-1 truncate text-sm font-black uppercase">{item?.name || "Unknown team"}</strong></div>;
}

function GeneratedFixtureCleanup({ tournaments, teams, tournamentId, onTournamentChange, candidates, selected, onSelectedChange, removing, onRemove }: { tournaments: Tournament[]; teams: Team[]; tournamentId: string; onTournamentChange: (id: string) => void; candidates: Match[]; selected: string[]; onSelectedChange: (ids: string[]) => void; removing: boolean; onRemove: () => void }) {
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name || "Unknown team";
  const toggle = (id: string) => onSelectedChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return <section className="rounded-2xl border border-red-400/30 bg-card p-5 shadow-lg"><div><p className="text-xs font-black uppercase tracking-widest text-red-600">Safe fixture cleanup</p><h2 className="mt-1 text-xl font-black">Remove generated fixtures</h2><p className="mt-1 text-sm text-muted-foreground">Scheduled tournament fixtures are listed for review. Older auto-generated fixtures have no marker, so select those carefully. Database checks block matches with a team sheet, scoring data or results.</p></div><label className="mt-5 block max-w-xl space-y-2 text-sm font-bold">Tournament<select className="input" value={tournamentId} onChange={(event)=>onTournamentChange(event.target.value)}><option value="">Select tournament</option>{tournaments.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{tournamentId&&<div className="mt-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold">{candidates.length} review candidate(s) · {selected.length} selected</p>{candidates.length>0&&<button type="button" className="rounded-lg border border-border px-3 py-2 text-xs font-black" onClick={()=>onSelectedChange(selected.length===candidates.length?[]:candidates.map((match)=>match.id))}>{selected.length===candidates.length?"Clear selection":"Select all"}</button>}</div><div className="grid gap-2 lg:grid-cols-2">{candidates.map((match)=><label key={match.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background/50 p-3"><input type="checkbox" className="h-4 w-4 accent-red-600" checked={selected.includes(match.id)} onChange={()=>toggle(match.id)}/><span className="min-w-0 flex-1"><strong className="block truncate">{match.fixture_round ? `Round ${match.fixture_round}` : "Legacy fixture"} · Match {match.match_number || "—"}</strong><span className="block truncate text-xs text-muted-foreground">{teamName(match.team_a_id)} vs {teamName(match.team_b_id)} · {match.match_date || "Date TBC"}</span></span>{match.generation_batch_id?<span className="rounded-full bg-emerald-100 px-2 py-1 text-[.6rem] font-black text-emerald-700">AUTO BATCH</span>:<span className="rounded-full bg-amber-100 px-2 py-1 text-[.6rem] font-black text-amber-700">REVIEW</span>}</label>)}{!candidates.length&&<p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground lg:col-span-2">No scheduled tournament fixtures are available for removal.</p>}</div><div className="flex justify-end"><button type="button" disabled={!selected.length||removing} onClick={onRemove} className="inline-flex min-h-11 items-center rounded-xl bg-red-600 px-5 font-black text-white disabled:opacity-50">{removing?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Trash2 className="mr-2 h-4 w-4"/>}Review & Remove</button></div></div>}</section>;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(":").map(Number);
  const total = hours * 60 + minute + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
