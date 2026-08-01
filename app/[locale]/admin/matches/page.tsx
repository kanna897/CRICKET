"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarPlus, ClipboardList, Loader2, LockKeyhole, PlayCircle, ShieldCheck, Sparkles, UnlockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";
import { useAdminAccess } from "@/components/admin-shell";
import { localePath } from "@/lib/locale-path";

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
};

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
  const [generator, setGenerator] = useState({ tournamentId: "", startDate: "", matchTime: "09:00", ground: "", restDays: "1" });

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
  const generateFixtures = async () => {
    setMessage("");
    const tournamentTeams = teams.filter((team) => team.tournament_id === generator.tournamentId);
    if (!generator.tournamentId || !generator.startDate) return setMessage("Tournament and start date are required.");
    if (tournamentTeams.length < 2) return setMessage("Fixture generation needs at least two teams.");
    setGenerating(true);
    try {
      const existing = matches.filter((match) => match.tournament_id === generator.tournamentId);
      const existingPairs = new Set(existing.map((match) => [match.team_a_id, match.team_b_id].sort().join(":")));
      const rows: Database["public"]["Tables"]["matches"]["Insert"][] = [];
      let dayOffset = 0;
      const interval = Math.max(1, Number(generator.restDays) || 1);
      const tournament = tournaments.find((item) => item.id === generator.tournamentId);
      for (let left = 0; left < tournamentTeams.length; left += 1) {
        for (let right = left + 1; right < tournamentTeams.length; right += 1) {
          const teamA = tournamentTeams[left];
          const teamB = tournamentTeams[right];
          if (existingPairs.has([teamA.id, teamB.id].sort().join(":"))) continue;
          const date = new Date(`${generator.startDate}T00:00:00`);
          date.setDate(date.getDate() + dayOffset);
          rows.push({
            tournament_id: generator.tournamentId,
            organizer_id: tournament?.organizer_id || userId,
            match_scope: "tournament",
            match_type: "tournament",
            team_a_id: teamA.id,
            team_b_id: teamB.id,
            match_date: date.toISOString().slice(0, 10),
            match_time: generator.matchTime || null,
            ground: generator.ground || tournament?.venue || null,
            overs_per_match: tournament?.overs || 20,
            status: "scheduled",
            assigned_scorer_id: tournament?.organizer_id || userId,
            scoring_locked: false,
          });
          dayOffset += interval;
        }
      }
      if (!rows.length) throw new Error("All round-robin team pairings are already scheduled.");
      const { data, error } = await supabase.from("matches").insert(rows).select("*");
      if (error) throw error;
      setMatches((current) => [...((data || []) as Match[]), ...current]);
      setGeneratorOpen(false);
      setMessage(`${rows.length} round-robin fixtures generated successfully.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Fixture generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="admin-themed-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight">Matches & Scoring</h1><p className="text-muted-foreground mt-1">Schedule fixtures and start live scoring.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setGeneratorOpen((value)=>!value)} className="inline-flex h-10 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-4 text-sm font-black text-primary"><Sparkles className="mr-2 h-4 w-4"/>Auto Generate</button><Link href={localePath(locale, "/admin/matches/new")} className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 text-sm font-medium"><CalendarPlus className="w-4 h-4 mr-2" />Schedule Match</Link></div>
      </div>
      {message && <p role="status" className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm font-bold text-foreground">{message}</p>}
      {generatorOpen&&<section className="rounded-2xl border border-primary/30 bg-card p-5 shadow-lg"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Automatic fixture generator</p><h2 className="mt-1 text-xl font-black">Round-robin schedule</h2><p className="mt-1 text-sm text-muted-foreground">Every team plays every other team once. Existing pairings are skipped.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="space-y-2 text-sm font-bold lg:col-span-2">Tournament<select className="input" value={generator.tournamentId} onChange={(event)=>setGenerator({...generator,tournamentId:event.target.value})}><option value="">Select tournament</option>{tournaments.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="space-y-2 text-sm font-bold">Start date<input type="date" className="input" value={generator.startDate} onChange={(event)=>setGenerator({...generator,startDate:event.target.value})}/></label><label className="space-y-2 text-sm font-bold">Match time<input type="time" className="input" value={generator.matchTime} onChange={(event)=>setGenerator({...generator,matchTime:event.target.value})}/></label><label className="space-y-2 text-sm font-bold">Days between matches<input type="number" min="1" max="30" className="input" value={generator.restDays} onChange={(event)=>setGenerator({...generator,restDays:event.target.value})}/></label><label className="space-y-2 text-sm font-bold sm:col-span-2 lg:col-span-4">Ground / Venue<input className="input" placeholder="Tournament venue used if empty" value={generator.ground} onChange={(event)=>setGenerator({...generator,ground:event.target.value})}/></label><button type="button" disabled={generating} onClick={()=>void generateFixtures()} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-black text-primary-foreground disabled:opacity-50">{generating?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Generate fixtures</button></div></section>}

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? <div className="py-14 text-center text-muted-foreground">Loading matches…</div> : matches.length === 0 ? (
          <div className="py-16 text-center"><ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><h2 className="font-semibold">No matches scheduled</h2><p className="text-sm text-muted-foreground mt-1">Create a fixture to begin scoring.</p></div>
        ) : <div className="divide-y divide-border">
          {matches.map((match) => <div key={match.id} className="flex flex-col gap-4 bg-[linear-gradient(135deg,rgba(11,41,93,.28),transparent_58%)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-wider text-primary">{match.match_scope === "standalone" ? (match.title || "Standalone match") : tournamentName(match.tournament_id)}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${match.match_scope === "standalone" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>{match.match_type}</span></div><div className="grid max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2"><ScheduleTeam item={team(match.team_a_id)} /><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 text-xs font-black text-slate-950 shadow-lg">VS</span><ScheduleTeam item={team(match.team_b_id)} reverse /></div><div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-primary/20 bg-background/55 px-3 py-2 text-xs font-bold text-muted-foreground"><span>{match.match_date || "Date TBC"}</span><span className="text-primary">{match.match_time || "Time TBC"}</span>{match.ground && <span>{match.ground}</span>}<span>{match.overs_per_match} overs</span></div></div>
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
