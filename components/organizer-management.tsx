"use client";

import { FormEvent, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

export type OrganizerSummary = { id: string; name: string; email: string | null; phone_number: string | null };

export function OrganizerManagement({ organizers }: { organizers: OrganizerSummary[] }) {
  const [rows, setRows] = useState(organizers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createOrganizer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/organizers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json() as { organizer?: OrganizerSummary; error?: string };
      if (!response.ok || !result.organizer) {
        throw new Error(result.error || "The organizer account could not be created.");
      }
      setRows((current) => [result.organizer!, ...current]);
      setName("");
      setEmail("");
      setPassword("");
      setMessage(`${result.organizer.email} can now sign in with the temporary password.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The organizer account could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(organizer: OrganizerSummary) {
    const password = window.prompt(`Enter a new temporary password for ${organizer.name || organizer.email || "this organizer"}. It must contain at least 8 characters.`);
    if (password === null) return;
    if (password.length < 8) return setMessage("Password must contain at least 8 characters.");

    setResetting(organizer.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organizers/${organizer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The organizer password could not be updated.");
      setMessage(`Temporary password updated for ${organizer.email || organizer.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The organizer password could not be updated.");
    } finally {
      setResetting(null);
    }
  }

  async function deleteOrganizer(organizer: OrganizerSummary) {
    const label = organizer.name || organizer.email || "this organizer";
    if (!window.confirm(`Delete ${label}? This permanently removes their login account and cannot be undone.`)) return;

    setDeleting(organizer.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organizers/${organizer.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The organizer account could not be deleted.");
      setRows((current) => current.filter((row) => row.id !== organizer.id));
      setMessage(`${label} was deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The organizer account could not be deleted.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="admin-themed-page space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organizers</h1>
        <p className="mt-1 text-muted-foreground">Create and manage organizer login accounts.</p>
      </div>

      <form onSubmit={createOrganizer} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Create organizer account</h2>
          <p className="text-sm text-muted-foreground">The account is activated immediately. Share the temporary password securely.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm font-medium"><span>Organizer name</span><input className="input" minLength={2} value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label className="space-y-2 text-sm font-medium"><span>Email address</span><input className="input" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="space-y-2 text-sm font-medium"><span>Temporary password</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        </div>
        <button type="submit" disabled={creating} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Creating…" : "Create organizer"}
        </button>
      </form>

      {message && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Organizer</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3 text-right">Account</th></tr></thead>
          <tbody>{rows.map((organizer) => <tr key={organizer.id} className="border-b border-border"><td className="px-5 py-4 font-medium">{organizer.name || "Unnamed organizer"}</td><td className="px-5 py-4">{organizer.email || "—"}</td><td className="px-5 py-4">{organizer.phone_number || "—"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button disabled={resetting === organizer.id || deleting === organizer.id} onClick={() => void resetPassword(organizer)} className="rounded-md border border-input px-3 py-2 font-medium hover:bg-muted disabled:opacity-50">{resetting === organizer.id ? "Updating…" : "Set new password"}</button><button aria-label={`Delete ${organizer.name || organizer.email || "organizer"}`} disabled={deleting === organizer.id || resetting === organizer.id} onClick={() => void deleteOrganizer(organizer)} className="inline-flex items-center gap-2 rounded-md border border-red-500/60 px-3 py-2 font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400 disabled:opacity-50">{deleting === organizer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span>{deleting === organizer.id ? "Deleting…" : "Delete"}</span></button></div></td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-muted-foreground">No organizer accounts found.</p>}
      </div>
    </div>
  );
}
