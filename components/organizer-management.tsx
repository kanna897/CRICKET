"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type OrganizerSummary = { id: string; name: string; email: string | null; phone_number: string | null };

export function OrganizerManagement({ organizers }: { organizers: OrganizerSummary[] }) {
  const [rows, setRows] = useState(organizers);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function sendReset(organizer: OrganizerSummary) {
    if (!organizer.email) return setMessage("This organizer does not have an email address on record.");
    setSending(organizer.id);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(organizer.email, { redirectTo: `${window.location.origin}/en/login` });
    setSending(null);
    setMessage(error ? error.message : `Password reset instructions sent to ${organizer.email}.`);
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

  return <div className="admin-themed-page space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Organizers</h1><p className="mt-1 text-muted-foreground">Manage organizer accounts and password access.</p></div>
    {message && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{message}</p>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Organizer</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3 text-right">Account</th></tr></thead><tbody>{rows.map((organizer) => <tr key={organizer.id} className="border-b border-border"><td className="px-5 py-4 font-medium">{organizer.name || "Unnamed organizer"}</td><td className="px-5 py-4">{organizer.email || "—"}</td><td className="px-5 py-4">{organizer.phone_number || "—"}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button disabled={sending === organizer.id || deleting === organizer.id || !organizer.email} onClick={() => sendReset(organizer)} className="rounded-md border border-input px-3 py-2 font-medium hover:bg-muted disabled:opacity-50">{sending === organizer.id ? "Sending…" : "Send password reset"}</button><button aria-label={`Delete ${organizer.name || organizer.email || "organizer"}`} disabled={deleting === organizer.id || sending === organizer.id} onClick={() => void deleteOrganizer(organizer)} className="inline-flex items-center gap-2 rounded-md border border-red-500/60 px-3 py-2 font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400 disabled:opacity-50">{deleting === organizer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span>{deleting === organizer.id ? "Deleting…" : "Delete"}</span></button></div></td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-8 text-center text-muted-foreground">No organizer accounts found.</p>}</div>
  </div>;
}
