"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, Loader2, User, Pencil, Trash2, Save, X } from "lucide-react";
import Link from "next/link";
import { Database } from "@/types/database.types";
import { uploadImage } from "@/lib/media";
import { ModernPlayerProfile, type CareerSnapshot } from "@/components/modern-player-profile";

type Player = Database['public']['Tables']['players']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

type PlayerEditValues = {
  name: string;
  phone_number: string;
  playing_role: string;
  team_id: string;
  batting_style: string;
  bowling_style: string;
};

export default function PlayerProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editValues, setEditValues] = useState<PlayerEditValues | null>(null);
  const [playerCode, setPlayerCode] = useState("#CP-PLAYER-01");
  const [career, setCareer] = useState<CareerSnapshot>({ matches: 0, runs: 0, wickets: 0, highScore: 0, average: 0, catches: 0, stumpings: 0, runOuts: 0, recentScores: [] });

  useEffect(() => {
    async function fetchPlayer() {
      const [{ data }, { data: orderedPlayers }] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),
        supabase.from('players').select('id,name,created_at').order('created_at', { ascending: true }).order('id', { ascending: true }),
      ]);
      if (data) {
        setPlayer(data);
        const ordered = (orderedPlayers || []) as Array<{ id: string; name: string; created_at: string }>;
        const sequence = Math.max(1, ordered.findIndex((row) => row.id === data.id) + 1);
        const shortName = String(data.name).split(/\s+/).map((part: string) => part.replace(/[^a-z0-9]/gi, "").slice(0, 1)).join("").toUpperCase().slice(0, 6) || "PLAYER";
        setPlayerCode(`#CP-${shortName}-${String(sequence).padStart(2, "0")}`);
        const { data: ballRows } = await supabase.from('ball_by_ball').select('innings_id,batsman_id,bowler_id,fielder_id,runs,is_wicket,dismissal_type,player_out_id').or(`batsman_id.eq.${id},bowler_id.eq.${id},fielder_id.eq.${id},player_out_id.eq.${id}`);
        const balls = (ballRows || []) as Array<{ innings_id: string; batsman_id: string | null; bowler_id: string | null; fielder_id: string | null; runs: number | null; is_wicket: boolean | null; dismissal_type: string | null; player_out_id: string | null }>;
        const inningsIds = [...new Set(balls.map((ball) => ball.innings_id))];
        const { data: inningsRows } = inningsIds.length ? await supabase.from('innings').select('id,match_id').in('id', inningsIds) : { data: [] };
        const inningsToMatch = new Map(((inningsRows || []) as Array<{ id: string; match_id: string }>).map((row) => [row.id, row.match_id]));
        const matchIds = [...new Set([...inningsToMatch.values()])];
        const { data: tournamentMatches } = matchIds.length ? await supabase.from('matches').select('id').in('id', matchIds).eq('match_scope', 'tournament') : { data: [] };
        const tournamentMatchIds = new Set((tournamentMatches || []).map((row: { id: string }) => row.id));
        const tournamentInningsIds = new Set([...inningsToMatch.entries()].filter(([, matchId]) => tournamentMatchIds.has(matchId)).map(([inningsId]) => inningsId));
        const tournamentBalls = balls.filter((ball) => tournamentInningsIds.has(ball.innings_id));
        const battingRuns = new Map<string, number>();
        let runs = 0, wickets = 0, dismissals = 0, catches = 0, stumpings = 0, runOuts = 0;
        tournamentBalls.forEach((ball) => {
          const dismissal = (ball.dismissal_type || "").toLowerCase().replaceAll(" ", "_");
          if (ball.batsman_id === id) { const value = Number(ball.runs || 0); runs += value; battingRuns.set(ball.innings_id, (battingRuns.get(ball.innings_id) || 0) + value); }
          if (ball.player_out_id === id && !["retired_hurt", "retired_not_out"].includes(dismissal)) dismissals += 1;
          if (ball.bowler_id === id && ball.is_wicket && !["run_out", "retired_hurt", "obstructing_the_field"].includes(dismissal)) wickets += 1;
          if (ball.fielder_id === id && dismissal.includes("caught")) catches += 1;
          if (ball.fielder_id === id && dismissal.includes("stump")) stumpings += 1;
          if (ball.fielder_id === id && dismissal.includes("run_out")) runOuts += 1;
        });
        const scores = [...battingRuns.values()].sort((a, b) => b - a);
        const recentScores = [...battingRuns.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).reverse().map((entry) => entry[1]);
        setCareer({ matches: tournamentMatchIds.size, runs, wickets, highScore: scores[0] || 0, average: dismissals ? runs / dismissals : runs, catches, stumpings, runOuts, recentScores });
      }
      setLoading(false);
    }
    if (id) fetchPlayer();
  }, [id]);

  useEffect(() => {
    async function fetchTeams() {
      const { data } = await supabase.from('teams').select('*').order('name');
      if (data) setTeams(data);
    }
    fetchTeams();
  }, []);

  const startEditing = () => {
    if (!player) return;
    setEditValues({
      name: player.name,
      phone_number: player.phone_number || '',
      playing_role: player.playing_role || 'Batsman',
      team_id: player.team_id || '',
      batting_style: player.batting_style?.toLowerCase().startsWith('right')
        ? 'Right-hand'
        : player.batting_style?.toLowerCase().startsWith('left')
          ? 'Left-hand'
          : '',
      bowling_style: player.bowling_style || '',
    });
    setIsEditing(true);
  };

  const savePlayer = async () => {
    if (!player || !editValues) return;
    setIsSaving(true);
    try {
      // Legacy database columns are not represented in the generated local type yet.
       
      const { error } = await supabase.from('players')
        .update({
          name: editValues.name.trim(),
          player_name: editValues.name.trim(),
          phone_number: editValues.phone_number.trim(),
          contact_number: editValues.phone_number.trim(),
          playing_role: editValues.playing_role,
          role: editValues.playing_role.toLowerCase(),
          team_id: editValues.team_id || null,
          batting_style: editValues.batting_style || null,
          bowling_style: editValues.bowling_style || null,
        })
        .eq('id', player.id);

      if (error) throw error;
      setPlayer({ ...player, ...editValues, team_id: editValues.team_id || null });
      setIsEditing(false);
      alert('Player updated successfully.');
    } catch (error) {
      console.error('Update player error:', error);
      const message = typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unable to update player.';
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlayer = async () => {
    if (!player || !confirm(`Delete ${player.name}? This action cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('players').delete().eq('id', player.id);
      if (error) throw error;
      router.push('/admin/players');
      router.refresh();
    } catch (error) {
      console.error('Delete player error:', error);
      const message = typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unable to delete player.';
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    setIsUploading(true);
    try {
      const { url: photo_url } = await uploadImage(file, "player-photos");

      const { data: updatedPlayer, error } = await supabase
        .from('players')
        .update({ photo_url })
        .eq('id', player.id)
        .select('id,photo_url')
        .maybeSingle();

      if (error) throw error;
      if (!updatedPlayer?.photo_url) throw new Error("Photo URL was not saved. Please check your admin permission and try again.");

      setPlayer({ ...player, photo_url: updatedPlayer.photo_url });
      alert("Photo uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload photo.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  if (!player) return <div className="p-8 text-center text-red-500">Player not found</div>;
  if (!isEditing) return <ModernPlayerProfile player={player} teams={teams} playerCode={playerCode} career={career} isUploading={isUploading} isDeleting={isDeleting} onEdit={startEditing} onDelete={deletePlayer} onPhotoUpload={handlePhotoUpload} />;

  return (
    <div className="admin-themed-page max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/players" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Profile</h1>
          <p className="text-muted-foreground mt-1">Player ID: <span className="font-mono font-bold text-primary">{playerCode}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isEditing ? (
            <>
              <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving} className="inline-flex items-center rounded-md border border-input h-9 px-3 text-sm font-medium"><X className="w-4 h-4 mr-1" />Cancel</button>
              <button type="button" onClick={savePlayer} disabled={isSaving} className="inline-flex items-center rounded-md bg-primary text-primary-foreground h-9 px-3 text-sm font-medium disabled:opacity-50">{isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Save</button>
            </>
          ) : (
            <>
              <button type="button" onClick={startEditing} className="inline-flex items-center rounded-md border border-input h-9 px-3 text-sm font-medium"><Pencil className="w-4 h-4 mr-1" />Edit</button>
              <button type="button" onClick={deletePlayer} disabled={isDeleting} className="inline-flex items-center rounded-md bg-red-600 text-white h-9 px-3 text-sm font-medium disabled:opacity-50">{isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar / Photo */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-muted bg-muted flex items-center justify-center relative">
              {player.photo_url ? (
                <Image src={player.photo_url} alt={player.name} fill sizes="128px" unoptimized className="object-cover" />
              ) : (
                <User className="w-12 h-12 text-muted-foreground" />
              )}
              
              <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-white rounded-full">
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
              </label>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-bold">{player.name}</h2>
            <p className="text-muted-foreground text-sm font-mono mt-1">{player.phone_number}</p>
            <span className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <span aria-hidden>{profileRoleSymbol(player.playing_role)}</span>{player.playing_role || "Unknown Role"}
            </span>
          </div>
        </div>

        {/* Details / Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Player Details</h3>
            {isEditing && editValues ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <EditField label="Player Name"><input value={editValues.name} onChange={(event) => setEditValues({ ...editValues, name: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md" /></EditField>
                <EditField label="Phone Number"><input value={editValues.phone_number} onChange={(event) => setEditValues({ ...editValues, phone_number: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md" /></EditField>
                <EditField label="Playing Role"><select value={editValues.playing_role} onChange={(event) => setEditValues({ ...editValues, playing_role: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md"><option>Batsman</option><option>Bowler</option><option>All-rounder</option><option>Wicket-keeper</option></select></EditField>
                <EditField label="Team"><select value={editValues.team_id} onChange={(event) => setEditValues({ ...editValues, team_id: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md"><option value="">Unassigned</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></EditField>
                <EditField label="Batting Style"><select value={editValues.batting_style} onChange={(event) => setEditValues({ ...editValues, batting_style: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md"><option value="">Not specified</option><option>Right-hand</option><option>Left-hand</option></select></EditField>
                <EditField label="Bowling Style"><select value={editValues.bowling_style} onChange={(event) => setEditValues({ ...editValues, bowling_style: event.target.value })} className="w-full px-3 py-2 bg-transparent border border-input rounded-md"><option value="">Not specified</option><option>Right-arm fast</option><option>Right-arm medium</option><option>Right-arm off-spin</option><option>Right-arm leg-spin</option><option>Left-arm fast</option><option>Left-arm medium</option><option>Left-arm orthodox</option><option>Left-arm wrist-spin</option></select></EditField>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div><p className="text-muted-foreground">Batting Style</p><p className="font-medium">{player.batting_style || "Not Specified"}</p></div>
                <div><p className="text-muted-foreground">Bowling Style</p><p className="font-medium">{player.bowling_style || "Not Specified"}</p></div>
                <div><p className="text-muted-foreground">Current Team</p><p className="font-medium text-primary">{player.team_id ? "Assigned" : "Unassigned"}</p></div>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Career Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Matches</p>
                <p className="text-2xl font-bold mt-1">{career.matches}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Runs</p>
                <p className="text-2xl font-bold mt-1">{career.runs}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Wickets</p>
                <p className="text-2xl font-bold mt-1">{career.wickets}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-xs text-muted-foreground uppercase font-semibold">High Score</p>
                <p className="text-2xl font-bold mt-1">{career.highScore}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4"><SmallCareerStat label="Average" value={career.average.toFixed(1)} /><SmallCareerStat label="Catches" value={career.catches} /><SmallCareerStat label="Stumpings" value={career.stumpings} /><SmallCareerStat label="Run outs" value={career.runOuts} /></div>
            {!career.matches && <p className="mt-4 text-center text-xs text-muted-foreground">Statistics will populate once the player participates in recorded matches.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 block"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

function SmallCareerStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border bg-muted/50 p-2"><p className="text-[.65rem] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-black text-primary">{value}</p></div>;
}

function profileRoleSymbol(role?: string | null) {
  const value = (role || "").toLowerCase();
  if (value.includes("wicket")) return "🧤";
  if (value.includes("all")) return "🏏🔴";
  if (value.includes("bowl")) return "🔴";
  return "🏏";
}
