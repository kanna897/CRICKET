"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy team fields are present in the live schema */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2, Save, Shield, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Team = { id: string; name: string; logo_url: string | null; owner_name: string | null; contact_number: string | null; tournament_id: string };
type Player = { id: string; name: string; playing_role: string | null; photo_url: string | null };

export default function ManageTeamPage() {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (!id) return; void (async () => {
    const [teamResult, playerResult] = await Promise.all([
      (supabase.from("teams") as any).select("id,name,logo_url,owner_name,contact_number,tournament_id").eq("id", id).maybeSingle(),
      (supabase.from("players") as any).select("id,name,playing_role,photo_url").eq("team_id", id).order("name"),
    ]);
    setTeam(teamResult.data as Team | null); setPlayers((playerResult.data || []) as Player[]);
    setMessage(teamResult.error?.message || playerResult.error?.message || (teamResult.data ? "" : "Team not found.")); setLoading(false);
  })(); }, [id]);

  const save = async () => {
    if (!team || !team.name.trim()) return;
    setSaving(true); setMessage("");
    const { error } = await (supabase.from("teams") as any).update({ name: team.name.trim(), team_name: team.name.trim(), owner_name: team.owner_name || null, contact_number: team.contact_number || null, owner_phone: team.contact_number || null }).eq("id", team.id);
    setMessage(error?.message || "Team details saved successfully."); setSaving(false);
  };

  if (loading) return <div className="grid min-h-72 place-items-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>;
  if (!team) return <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Shield className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-black">{message || "Team not found."}</p><Link href="/admin/teams" className="mt-4 inline-flex text-primary">Back to teams</Link></div>;

  return <div className="admin-themed-page mx-auto max-w-5xl space-y-6">
    <header className="flex items-center gap-4"><Link href="/admin/teams" aria-label="Back to teams" className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card"><ArrowLeft className="h-5 w-5" /></Link>{team.logo_url ? <img src={team.logo_url} alt="" className="h-16 w-16 rounded-2xl bg-white object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-2xl font-black text-primary">{team.name.slice(0, 1)}</span>}<div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Team Management</p><h1 className="text-3xl font-black">{team.name}</h1><p className="text-sm text-muted-foreground">Edit team details and review the squad.</p></div></header>
    {message && <p role="status" className={`rounded-xl border p-3 text-sm font-bold ${message.includes("successfully") ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}`}>{message}</p>}
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="text-lg font-black">Team details</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Team name" value={team.name} onChange={(value) => setTeam({ ...team, name: value })} /><Field label="Owner name" value={team.owner_name || ""} onChange={(value) => setTeam({ ...team, owner_name: value })} /><Field label="Contact number" value={team.contact_number || ""} onChange={(value) => setTeam({ ...team, contact_number: value })} /></div><button type="button" onClick={() => void save()} disabled={saving || !team.name.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-black text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</button></section>
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><header className="flex items-center gap-2 border-b border-border p-5"><Users className="h-5 w-5 text-primary" /><h2 className="font-black">Squad · {players.length} players</h2></header><div className="grid gap-3 p-4 sm:grid-cols-2">{players.map((player) => { const symbol = roleSymbol(player.playing_role); return <article key={player.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">{player.photo_url ? <img src={player.photo_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 font-black text-primary">{player.name.slice(0, 1)}</span>}<div className="min-w-0"><p className="flex min-w-0 items-center font-black"><span className="truncate">{player.name}</span><span className="ml-3 inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-1.5 text-base leading-none" title={player.playing_role || "Player"} aria-label={`${player.playing_role || "Player"} symbol`}>{symbol}</span></p><p className="text-xs text-muted-foreground">{player.playing_role || "Player"}</p></div></article>; })}</div>{!players.length && <p className="p-8 text-center text-muted-foreground">No players in this squad yet.</p>}</section>
  </div>;
}

function roleSymbol(role?: string | null) {
  const value = (role || "").toLowerCase();
  if (value.includes("wicket")) return "🧤";
  if (value.includes("all")) return "🏏🔴";
  if (value.includes("bowl")) return "🔴";
  return "🏏";
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-bold text-muted-foreground">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block w-full rounded-xl border border-input bg-background px-3 py-2.5 font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30" /></label>; }
