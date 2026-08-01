"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, PlayCircle, ShieldCheck, Users, UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type EditableTournament = { id: string; name: string; venue: string | null; start_date: string | null; ball_type: string | null; overs: number | null; status: string | null; player_registration_enabled?: boolean };
export type TournamentSnapshot = { teams: number; players: number; matches: number; scheduled: number; live: number; completed: number };

export function TournamentEditor({ tournament, snapshot }: { tournament: EditableTournament; snapshot: TournamentSnapshot }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: tournament.name, venue: tournament.venue || "", start_date: tournament.start_date || "", ball_type: tournament.ball_type || "Tennis", overs: String(tournament.overs || 20), status: tournament.status || "upcoming", player_registration_enabled: Boolean(tournament.player_registration_enabled) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.from("tournaments").update({ ...form, tournament_name: form.name, overs: Number(form.overs), overs_per_match: Number(form.overs) }).eq("id", tournament.id).select("id").maybeSingle();
    setSaving(false);
    if (error) return setMessage(error.message);
    if (!data) return setMessage("Unauthorized: you cannot update this tournament.");
    setMessage("Tournament settings saved.");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Permanently delete this tournament and all its matches, scores, teams, registrations and auction data? Players will be kept as Unassigned. This cannot be undone.")) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("delete_tournament_cascade", { p_tournament_id: tournament.id });
    setSaving(false);
    if (error) return setMessage(error.message);
    if (!data) return setMessage("Tournament was not found or could not be deleted.");
    router.replace("/admin/tournaments");
    router.refresh();
  }

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const completion = snapshot.matches ? Math.round(snapshot.completed * 100 / snapshot.matches) : 0;
  const readiness = snapshot.teams >= 2 && snapshot.players >= snapshot.teams * 6;

  return <div className="admin-themed-page mx-auto max-w-5xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Tournament command centre</p><h1 className="mt-1 text-3xl font-bold text-foreground">{tournament.name}</h1><p className="mt-1 text-muted-foreground">Operational health, fixtures and tournament settings.</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/teams/new?tournament=${tournament.id}`} className="control"><UsersRound className="mr-2 h-4 w-4"/>Add Team</Link><Link href={`/admin/matches/new?tournament=${tournament.id}`} className="control bg-primary text-primary-foreground"><CalendarPlus className="mr-2 h-4 w-4"/>Schedule Match</Link></div></div>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><OperationCard icon={<UsersRound className="h-5 w-5"/>} label="Teams" value={snapshot.teams} detail={snapshot.teams >= 2 ? "Fixture ready" : "Minimum 2 required"}/><OperationCard icon={<Users className="h-5 w-5"/>} label="Registered players" value={snapshot.players} detail={`${Math.max(snapshot.teams * 6 - snapshot.players, 0)} more for squad minimum`}/><OperationCard icon={<PlayCircle className="h-5 w-5"/>} label="Matches" value={snapshot.matches} detail={`${snapshot.live} live · ${snapshot.scheduled} scheduled`}/><OperationCard icon={<CheckCircle2 className="h-5 w-5"/>} label="Completed" value={`${completion}%`} detail={`${snapshot.completed} of ${snapshot.matches} matches`}/></section>
    <section className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${readiness ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50" : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50"}`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-current/10"><ShieldCheck className="h-5 w-5"/></span><div><p className="font-black">{readiness ? "Tournament squads are operationally ready" : "Tournament setup needs attention"}</p><p className="mt-0.5 text-sm opacity-80">{readiness ? "Teams have the minimum player coverage required to schedule fixtures." : "Add at least 2 teams and 6 players per team before match scheduling."}</p></div></div><Link href="/admin/teams" className="control shrink-0 bg-background text-foreground">Review teams</Link></section>
    <form onSubmit={save} className="space-y-5 rounded-xl border border-border bg-card p-6 text-foreground shadow-sm"><div><h2 className="text-xl font-black">Tournament settings</h2><p className="text-sm text-muted-foreground">Update competition details and lifecycle status.</p></div>{message && <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}<Field label="Tournament name"><input className="input" required minLength={3} value={form.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Venue"><input className="input" value={form.venue} onChange={(event) => update("venue", event.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Start date"><input className="input" type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} /></Field><Field label="Overs"><input className="input" type="number" min="1" max="100" value={form.overs} onChange={(event) => update("overs", event.target.value)} /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Ball type"><select className="input" value={form.ball_type} onChange={(event) => update("ball_type", event.target.value)}><option>Tennis</option><option>Leather</option></select></Field><Field label="Status"><select className="input" value={form.status} onChange={(event) => update("status", event.target.value)}><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></Field></div><label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-muted/40 p-4"><span><span className="block font-black">Public player registration</span><span className="mt-1 block text-sm text-muted-foreground">{form.player_registration_enabled ? "Visible — public players can submit applications." : "Hidden — registration button and form are unavailable."}</span></span><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${form.player_registration_enabled ? "bg-emerald-600" : "bg-slate-400"}`}><input type="checkbox" className="sr-only" checked={form.player_registration_enabled} onChange={(event) => update("player_registration_enabled", event.target.checked)}/><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${form.player_registration_enabled ? "left-6" : "left-1"}`}/></span></label><div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5"><button type="button" onClick={remove} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">Delete tournament</button><button disabled={saving} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button></div></form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>; }
function OperationCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) { return <article className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span></div><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{detail}</p></article>; }
