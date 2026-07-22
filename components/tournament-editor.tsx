"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type EditableTournament = { id: string; name: string; venue: string | null; start_date: string | null; ball_type: string | null; overs: number | null; status: string | null };

export function TournamentEditor({ tournament }: { tournament: EditableTournament }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: tournament.name, venue: tournament.venue || "", start_date: tournament.start_date || "", ball_type: tournament.ball_type || "Tennis", overs: String(tournament.overs || 20), status: tournament.status || "upcoming" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const { data, error } = await (supabase.from("tournaments") as any).update({ ...form, tournament_name: form.name, overs: Number(form.overs), overs_per_match: Number(form.overs) }).eq("id", tournament.id).select("id").maybeSingle();
    setSaving(false);
    if (error) return setMessage(error.message);
    if (!data) return setMessage("Unauthorized: you cannot update this tournament.");
    setMessage("Tournament settings saved.");
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this tournament? This action is restricted to its organizer or the Master Admin.")) return;
    const { data, error } = await (supabase.from("tournaments") as any).delete().eq("id", tournament.id).select("id").maybeSingle();
    if (error) return setMessage(error.message);
    if (!data) return setMessage("Unauthorized: you cannot delete this tournament.");
    router.replace("/admin/tournaments");
    router.refresh();
  }

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="admin-themed-page mx-auto max-w-3xl space-y-6"><div><h1 className="text-3xl font-bold">Tournament Settings</h1><p className="mt-1 text-muted-foreground">Edit tournament details and management settings.</p></div><form onSubmit={save} className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm">{message && <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}<Field label="Tournament name"><input className="input" required minLength={3} value={form.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Venue"><input className="input" value={form.venue} onChange={(event) => update("venue", event.target.value)} /></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Start date"><input className="input" type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} /></Field><Field label="Overs"><input className="input" type="number" min="1" max="100" value={form.overs} onChange={(event) => update("overs", event.target.value)} /></Field></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Ball type"><select className="input" value={form.ball_type} onChange={(event) => update("ball_type", event.target.value)}><option>Tennis</option><option>Leather</option></select></Field><Field label="Status"><select className="input" value={form.status} onChange={(event) => update("status", event.target.value)}><option value="upcoming">Upcoming</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option></select></Field></div><div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5"><button type="button" onClick={remove} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Delete tournament</button><button disabled={saving} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button></div></form></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>; }
