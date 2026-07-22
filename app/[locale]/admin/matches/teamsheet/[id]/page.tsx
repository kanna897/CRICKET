"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Crown, Edit3, FileText, Loader2, Printer, RefreshCw, Save, ShieldCheck, Swords, Target, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Team = { id: string; name: string; logo_url: string | null };
type Player = { id: string; name: string; team_id: string | null; playing_role: string | null; photo_url: string | null };
type Match = { id: string; tournament_id: string | null; team_a_id: string; team_b_id: string; match_date: string | null; match_time: string | null; ground: string | null };
type Tournament = { name: string; logo_url: string | null };
type SquadRow = { player_id: string; team_id: string; is_captain: boolean };

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 11;

function roleDetails(role: string | null) {
  const normalized = (role || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (["batsman", "batter", "batswoman"].includes(normalized)) return { label: "Batsman", icon: Swords, color: "text-sky-700 bg-sky-50 border-sky-200" };
  if (normalized === "bowler") return { label: "Bowler", icon: Target, color: "text-rose-700 bg-rose-50 border-rose-200" };
  if (["all_rounder", "allrounder"].includes(normalized)) return { label: "All-rounder", icon: RefreshCw, color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (["wicket_keeper", "wicketkeeper", "keeper"].includes(normalized)) return { label: "Wicket keeper", icon: ShieldCheck, color: "text-violet-700 bg-violet-50 border-violet-200" };
  return { label: role || "Player", icon: UserRound, color: "text-slate-700 bg-slate-50 border-slate-200" };
}

function PlayerAvatar({ player, size = "sm" }: { player: Player; size?: "sm" | "md" }) {
  const dimensions = size === "md" ? "h-11 w-11" : "h-8 w-8";
  return player.photo_url ? (
    <img src={player.photo_url} alt="" className={`${dimensions} shrink-0 rounded-full border border-sky-200 object-cover`} />
  ) : (
    <span className={`${dimensions} shrink-0 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 text-center text-xs font-black leading-8 text-sky-800`}>
      {player.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function TeamSheetPage() {
  const params = useParams<{ id: string }>();
  const matchId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamASelection, setTeamASelection] = useState<string[]>([]);
  const [teamBSelection, setTeamBSelection] = useState<string[]>([]);
  const [teamACaptain, setTeamACaptain] = useState<string | null>(null);
  const [teamBCaptain, setTeamBCaptain] = useState<string | null>(null);
  const [showOfficialSheet, setShowOfficialSheet] = useState(false);

  useEffect(() => {
    async function loadTeamSheet() {
      setLoading(true);
      setError(null);
      try {
        const { data: matchRow, error: matchError } = await (supabase.from("matches") as any)
          .select("id,tournament_id,team_a_id,team_b_id,match_date,match_time,ground")
          .eq("id", matchId)
          .maybeSingle();
        if (matchError) throw matchError;
        if (!matchRow) throw new Error("Match not found.");

        const { data: tournamentRow, error: tournamentError } = matchRow.tournament_id
          ? await (supabase.from("tournaments") as any).select("name,logo_url").eq("id", matchRow.tournament_id).maybeSingle()
          : { data: null, error: null };
        if (tournamentError) throw tournamentError;

        const [{ data: teamRows, error: teamsError }, { data: playerRows, error: playersError }, { data: squadRows, error: squadsError }] = await Promise.all([
          (supabase.from("teams") as any).select("id,name,logo_url").in("id", [matchRow.team_a_id, matchRow.team_b_id]),
          (supabase.from("players") as any).select("id,name,team_id,playing_role,photo_url").in("team_id", [matchRow.team_a_id, matchRow.team_b_id]).order("name"),
          (supabase.from("match_squads") as any).select("player_id,team_id,is_captain").eq("match_id", matchId),
        ]);
        if (teamsError) throw teamsError;
        if (playersError) throw playersError;
        if (squadsError) throw squadsError;

        const savedSquads = (squadRows || []) as SquadRow[];
        const savedA = savedSquads.filter((row) => row.team_id === matchRow.team_a_id).map((row) => row.player_id);
        const savedB = savedSquads.filter((row) => row.team_id === matchRow.team_b_id).map((row) => row.player_id);
        setMatch(matchRow as Match);
        setTournament((tournamentRow as Tournament | null) || null);
        setTeamA((teamRows || []).find((team: Team) => team.id === matchRow.team_a_id) || null);
        setTeamB((teamRows || []).find((team: Team) => team.id === matchRow.team_b_id) || null);
        setPlayers((playerRows || []) as Player[]);
        setTeamASelection(savedA);
        setTeamBSelection(savedB);
        setTeamACaptain(savedSquads.find((row) => row.team_id === matchRow.team_a_id && row.is_captain)?.player_id || null);
        setTeamBCaptain(savedSquads.find((row) => row.team_id === matchRow.team_b_id && row.is_captain)?.player_id || null);
        setShowOfficialSheet(savedA.length >= MIN_PLAYERS && savedB.length >= MIN_PLAYERS);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load this team sheet.");
      } finally {
        setLoading(false);
      }
    }
    if (matchId) loadTeamSheet();
  }, [matchId]);

  const teamAPlayers = useMemo(() => players.filter((player) => player.team_id === match?.team_a_id), [match, players]);
  const teamBPlayers = useMemo(() => players.filter((player) => player.team_id === match?.team_b_id), [match, players]);
  const selectedAPlayers = useMemo(() => teamAPlayers.filter((player) => teamASelection.includes(player.id)), [teamAPlayers, teamASelection]);
  const selectedBPlayers = useMemo(() => teamBPlayers.filter((player) => teamBSelection.includes(player.id)), [teamBPlayers, teamBSelection]);

  const togglePlayer = (playerId: string, selected: string[], setSelected: (next: string[]) => void, captainId: string | null, setCaptainId: (next: string | null) => void) => {
    if (selected.includes(playerId)) {
      if (captainId === playerId) setCaptainId(null);
      return setSelected(selected.filter((id) => id !== playerId));
    }
    if (selected.length < MAX_PLAYERS) setSelected([...selected, playerId]);
  };

  const savePlayingXI = async () => {
    if (!match || !teamA || !teamB) return;
    if (teamASelection.length < MIN_PLAYERS || teamBSelection.length < MIN_PLAYERS) {
      setError(`Select at least ${MIN_PLAYERS} players for each team before submitting.`);
      return;
    }
    if (!teamACaptain || !teamBCaptain) {
      setError("Choose one captain for each team's Playing XI before submitting.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: removeError } = await (supabase.from("match_squads") as any).delete().eq("match_id", match.id);
      if (removeError) throw removeError;
      const rows = [
        ...teamASelection.map((player_id) => ({ match_id: match.id, team_id: teamA.id, player_id, is_captain: player_id === teamACaptain })),
        ...teamBSelection.map((player_id) => ({ match_id: match.id, team_id: teamB.id, player_id, is_captain: player_id === teamBCaptain })),
      ];
      const { error: insertError } = await (supabase.from("match_squads") as any).insert(rows);
      if (insertError) throw insertError;
      setShowOfficialSheet(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the playing squads.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-primary"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading team sheet…</div>;
  if (error && !match) return <div className="mx-auto max-w-xl p-12 text-center"><p className="text-red-600">{error}</p><Link href="/admin/matches" className="mt-4 inline-block text-primary underline">Back to matches</Link></div>;
  if (!match || !teamA || !teamB) return null;

  const dateLabel = match.match_date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${match.match_date}T00:00:00`)) : "Date TBC";
  const printSheet = () => {
    // Some embedded browsers suppress print dialogs on the current tab. Opening
    // the same printable sheet from this user click keeps the native print flow reliable.
    const printWindow = window.open(window.location.href, "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.addEventListener("load", () => {
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    }, { once: true });
  };

  return (
    <div className="admin-themed-page dashboard-page matches-page max-w-6xl mx-auto pb-12 print:max-w-full print:p-0">
      <div className="mb-8 flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/admin/matches" className="rounded-full bg-muted p-2 hover:bg-muted/80"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="h-6 w-6 text-primary" /> Playing XI Team Sheet</h1>
            <p className="text-muted-foreground text-sm">Select the players who will take part in this match, then submit the official sheet.</p>
          </div>
        </div>
        {showOfficialSheet ? <div className="flex gap-2"><button type="button" onClick={() => setShowOfficialSheet(false)} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold"><Edit3 className="h-4 w-4" />Edit XI</button><button type="button" onClick={printSheet} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"><Printer className="h-5 w-5" />Print Sheet</button></div> : null}
      </div>

      {error ? <p role="alert" className="mb-5 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</p> : null}

      {!showOfficialSheet ? (
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm print:hidden">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5"><div><h2 className="text-xl font-bold">Choose the Playing XI</h2><p className="text-muted-foreground text-sm">Every team can select {MIN_PLAYERS} to {MAX_PLAYERS} players from its complete squad.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"><UsersRound className="h-4 w-4" />{teamASelection.length + teamBSelection.length} selected</span></div>
          <div className="grid gap-6 lg:grid-cols-2"><SquadSelector team={teamA} players={teamAPlayers} selected={teamASelection} captainId={teamACaptain} onToggle={(id) => togglePlayer(id, teamASelection, setTeamASelection, teamACaptain, setTeamACaptain)} onCaptainSelect={setTeamACaptain} /><SquadSelector team={teamB} players={teamBPlayers} selected={teamBSelection} captainId={teamBCaptain} onToggle={(id) => togglePlayer(id, teamBSelection, setTeamBSelection, teamBCaptain, setTeamBCaptain)} onCaptainSelect={setTeamBCaptain} /></div>
          <div className="mt-7 flex justify-end border-t border-border pt-5"><button disabled={saving} onClick={savePlayingXI} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Submit Playing Team Sheet</button></div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-300 bg-white p-5 text-slate-950 shadow-lg sm:p-8 print:m-0 print:rounded-none print:border-none print:p-0 print:shadow-none">
          <div className="mb-6 border-b-2 border-slate-950 pb-5 text-center"><div className="mb-4 flex flex-wrap items-center justify-between gap-4"><img src="/brand/crickpulse-logo.png" alt="Crickpulse" className="h-10 w-36 object-contain object-left" /><div className="flex min-w-0 items-center justify-end gap-2">{tournament?.logo_url ? <img src={tournament.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full border border-slate-300 bg-white object-contain p-0.5" /> : null}<p className="max-w-80 truncate text-sm font-black uppercase tracking-[0.12em] text-slate-800">{tournament?.name || "CRICKPULSE"}</p></div></div><h1 className="text-2xl font-black tracking-[0.16em] text-slate-950 sm:text-3xl">OFFICIAL TEAM SHEET</h1><div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-lg font-bold text-slate-900"><span>{teamA.name}</span><span className="text-sm font-black uppercase text-slate-500">vs</span><span>{teamB.name}</span></div><div className="mt-2 font-mono text-sm font-semibold text-slate-600">Date: {dateLabel}{match.match_time ? ` • ${match.match_time}` : ""}{match.ground ? ` • Venue: ${match.ground}` : ""}</div></div>
          <div className="grid gap-8 print:gap-4 md:grid-cols-2"><OfficialSquad team={teamA} players={selectedAPlayers} captainId={teamACaptain} /><OfficialSquad team={teamB} players={selectedBPlayers} captainId={teamBCaptain} /></div>
          <div className="mt-12 flex items-center justify-center gap-2 text-xs text-gray-400 print:mt-8"><img src="/brand/crickpulse-logo.png" alt="Crickpulse" className="h-5 w-20 object-contain" /> <span>Official Export • Generated {new Date().toLocaleString()}</span></div>
        </div>
      )}
    </div>
  );
}

function SquadSelector({ team, players, selected, captainId, onToggle, onCaptainSelect }: { team: Team; players: Player[]; selected: string[]; captainId: string | null; onToggle: (id: string) => void; onCaptainSelect: (id: string) => void }) {
  const captain = players.find((player) => player.id === captainId);
  return <section className="overflow-hidden rounded-xl border border-sky-200 bg-white text-slate-950"><div className="flex items-center gap-3 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50 p-4">{team.logo_url ? <img src={team.logo_url} alt="" className="h-11 w-11 rounded-full border border-sky-200 bg-white object-contain p-1" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 font-black text-sky-700">{team.name.slice(0, 1)}</div>}<div className="min-w-0 flex-1"><h3 className="truncate font-bold text-slate-950">{team.name}</h3><p className="text-xs font-medium text-slate-600">{selected.length}/{MAX_PLAYERS} selected · {captain ? `Captain: ${captain.name}` : "Choose a captain below"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected.length >= MIN_PLAYERS && selected.length <= MAX_PLAYERS && captainId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{captainId ? "Ready" : "Captain needed"}</span></div><div className="max-h-[29rem] divide-y divide-sky-100 overflow-y-auto">{players.length ? players.map((player) => { const isSelected = selected.includes(player.id); const disabled = !isSelected && selected.length === MAX_PLAYERS; const isCaptain = player.id === captainId; return <div key={player.id} className={`flex flex-wrap items-center gap-3 p-3 transition-colors sm:flex-nowrap ${isSelected ? "bg-sky-50" : "hover:bg-slate-50"} ${disabled ? "opacity-50" : ""}`}><input id={`${team.id}-${player.id}`} type="checkbox" checked={isSelected} disabled={disabled} onChange={() => onToggle(player.id)} className="h-5 w-5 shrink-0 accent-sky-600" /><label htmlFor={`${team.id}-${player.id}`} className={`flex min-w-0 flex-1 items-center gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}><PlayerAvatar player={player} /><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-sm font-bold text-slate-950"><span className="truncate">{player.name}</span>{isCaptain ? <CaptainBadge /> : null}</span><RoleBadge role={player.playing_role} /></span></label>{isSelected ? <button type="button" aria-pressed={isCaptain} onClick={() => onCaptainSelect(player.id)} className={`ml-8 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition-colors sm:ml-0 ${isCaptain ? "border-amber-500 bg-amber-400 text-slate-950 shadow-sm" : "border-sky-300 bg-white text-sky-800 hover:border-amber-400 hover:bg-amber-50"}`}><Crown className="h-4 w-4" />{isCaptain ? "Captain selected" : "Select captain"}</button> : null}{isSelected ? <CheckCircle2 className="hidden h-5 w-5 shrink-0 text-emerald-600 sm:block" /> : null}</div>; }) : <p className="p-5 text-sm font-medium text-slate-600">No players are assigned to this team yet.</p>}</div></section>;
}

function OfficialSquad({ team, players, captainId }: { team: Team; players: Player[]; captainId: string | null }) {
  return <section className="min-w-0"><div className="mb-4 flex min-h-16 items-center justify-center gap-3 rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-3 text-center text-lg font-black uppercase text-sky-950">{team.logo_url ? <img src={team.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full border border-sky-200 bg-white object-contain p-0.5" /> : null}<span className="min-w-0 break-words">{team.name}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[29rem] table-fixed border-collapse text-left text-slate-950"><thead><tr className="border-b-2 border-slate-900 bg-[#12346b] text-xs uppercase tracking-wide text-white"><th className="w-12 px-2 py-3 text-center">No.</th><th className="px-2 py-3">Player</th><th className="w-40 px-2 py-3 text-right">Role</th></tr></thead><tbody>{players.map((player, index) => <tr key={player.id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50"><td className="align-middle px-2 py-2.5 text-center font-black text-slate-600">{index + 1}</td><td className="align-middle px-2 py-2.5"><span className="flex min-w-0 items-center gap-2"><PlayerAvatar player={player} /><span className="inline-flex min-w-0 items-center gap-1.5 font-bold text-slate-900"><span className="min-w-0 truncate">{player.name}</span>{player.id === captainId ? <CaptainBadge /> : null}</span></span></td><td className="align-middle px-2 py-2.5"><span className="flex justify-end"><RoleBadge role={player.playing_role} /></span></td></tr>)}</tbody></table></div></section>;
}

function RoleBadge({ role }: { role: string | null }) {
  const details = roleDetails(role);
  const Icon = details.icon;
  return <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.68rem] font-bold leading-none ${details.color}`}><Icon className="h-3.5 w-3.5" />{details.label}</span>;
}

function CaptainBadge() {
  return <span title="Captain" aria-label="Captain" className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sky-700 px-1 text-[10px] font-black leading-none text-white">C</span>;
}
