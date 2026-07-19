"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/database.types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

export default function NewMatchPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teamASquad, setTeamASquad] = useState<string[]>([]);
  const [teamBSquad, setTeamBSquad] = useState<string[]>([]);
  const [form, setForm] = useState({ tournament_id: "", team_a_id: "", team_b_id: "", ground: "", match_date: "", match_time: "", overs_per_match: "20" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      const [teamsResult, playersResult, tournamentsResult] = await Promise.all([supabase.from("teams").select("*").order("name"), supabase.from("players").select("*").order("name"), supabase.from("tournaments").select("*").order("created_at", { ascending: false })]);
      if (teamsResult.data) setTeams(teamsResult.data);
      if (playersResult.data) setPlayers(playersResult.data);
      if (tournamentsResult.data) setTournaments(tournamentsResult.data);
    }
    loadOptions();
  }, []);

  const tournamentTeams = form.tournament_id ? teams.filter((team) => team.tournament_id === form.tournament_id) : teams;
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const teamPlayers = (teamId: string) => players.filter((player) => player.team_id === teamId);
  const toggleSquadPlayer = (playerId: string, squad: string[], setSquad: (value: string[]) => void) => {
    if (squad.includes(playerId)) return setSquad(squad.filter((id) => id !== playerId));
    if (squad.length < 11) setSquad([...squad, playerId]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.team_a_id || !form.team_b_id || !form.match_date) return setError("Select both teams and a match date.");
    if (form.team_a_id === form.team_b_id) return setError("Choose two different teams.");
    if (teamASquad.length < 6 || teamASquad.length > 11 || teamBSquad.length < 6 || teamBSquad.length > 11) return setError("Select 6 to 11 players for each team.");
    setSaving(true);
    try {
      const { data: match, error: insertError } = await (supabase.from("matches") as any).insert({
        tournament_id: form.tournament_id || null,
        team_a_id: form.team_a_id,
        team_b_id: form.team_b_id,
        ground: form.ground || null,
        match_date: form.match_date,
        match_time: form.match_time || null,
        overs_per_match: Number(form.overs_per_match),
        status: "scheduled",
      }).select("id").single();
      if (insertError) throw insertError;
      const squadRows = [
        ...teamASquad.map((player_id) => ({ match_id: match.id, team_id: form.team_a_id, player_id })),
        ...teamBSquad.map((player_id) => ({ match_id: match.id, team_id: form.team_b_id, player_id })),
      ];
      const { error: squadError } = await (supabase.from("match_squads") as any).insert(squadRows);
      if (squadError) {
        await (supabase.from("matches") as any).delete().eq("id", match.id);
        throw squadError;
      }
      router.push("/admin/matches");
      router.refresh();
    } catch (reason) {
      const message = typeof reason === "object" && reason && "message" in reason && typeof reason.message === "string" ? reason.message : "Unable to schedule match.";
      setError(message);
    } finally { setSaving(false); }
  };

  return <div className="max-w-3xl mx-auto space-y-6">
    <div className="flex items-center gap-4"><Link href="/admin/matches" className="p-2 hover:bg-muted rounded-full"><ArrowLeft className="w-5 h-5" /></Link><div><h1 className="text-3xl font-bold">Schedule Match</h1><p className="text-muted-foreground mt-1">Create a fixture before starting live scoring.</p></div></div>
    <form onSubmit={submit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Field label="Tournament (optional)"><select value={form.tournament_id} onChange={(event) => update("tournament_id", event.target.value)} className="input"><option value="">Independent match</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></Field>
      <div className="grid md:grid-cols-2 gap-5"><Field label="Team A"><select required value={form.team_a_id} onChange={(event) => { update("team_a_id", event.target.value); setTeamASquad([]); }} className="input"><option value="">Select team</option>{tournamentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field><Field label="Team B"><select required value={form.team_b_id} onChange={(event) => { update("team_b_id", event.target.value); setTeamBSquad([]); }} className="input"><option value="">Select team</option>{tournamentTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field></div>
      <div className="grid md:grid-cols-2 gap-5"><SquadPicker title="Team A Playing Squad" players={teamPlayers(form.team_a_id)} selected={teamASquad} onToggle={(playerId) => toggleSquadPlayer(playerId, teamASquad, setTeamASquad)} /><SquadPicker title="Team B Playing Squad" players={teamPlayers(form.team_b_id)} selected={teamBSquad} onToggle={(playerId) => toggleSquadPlayer(playerId, teamBSquad, setTeamBSquad)} /></div>
      <div className="grid md:grid-cols-3 gap-5"><Field label="Match Date"><input required type="date" value={form.match_date} onChange={(event) => update("match_date", event.target.value)} className="input" /></Field><Field label="Match Time"><input type="time" value={form.match_time} onChange={(event) => update("match_time", event.target.value)} className="input" /></Field><Field label="Overs"><input required min="1" max="100" type="number" value={form.overs_per_match} onChange={(event) => update("overs_per_match", event.target.value)} className="input" /></Field></div>
      <Field label="Ground / Venue"><input value={form.ground} onChange={(event) => update("ground", event.target.value)} placeholder="e.g. Jaffna Cricket Ground" className="input" /></Field>
      <div className="pt-4 border-t border-border flex justify-end gap-3"><Link href="/admin/matches" className="inline-flex items-center border border-input rounded-md h-10 px-4 text-sm font-medium">Cancel</Link><button disabled={saving} className="inline-flex items-center bg-primary text-primary-foreground rounded-md h-10 px-4 text-sm font-medium disabled:opacity-50">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Schedule Match</button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2 text-sm font-medium">{label}{children}</label>; }

function SquadPicker({ title, players, selected, onToggle }: { title: string; players: Player[]; selected: string[]; onToggle: (playerId: string) => void }) {
  return <div className="border border-border rounded-lg p-4 space-y-3"><div className="flex justify-between"><h2 className="font-semibold">{title}</h2><span className={`text-sm font-bold ${selected.length >= 6 && selected.length <= 11 ? "text-green-600" : "text-red-600"}`}>{selected.length}/11 (min 6)</span></div>{players.length === 0 ? <p className="text-sm text-muted-foreground">No players assigned to this team. Add players from Player Profile → Edit → Team.</p> : <div className="max-h-56 overflow-y-auto space-y-2">{players.map((player) => <label key={player.id} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={selected.includes(player.id)} onChange={() => onToggle(player.id)} disabled={!selected.includes(player.id) && selected.length === 11} />{player.name}<span className="text-xs text-muted-foreground">{player.playing_role || ""}</span></label>)}</div>}</div>;
}
