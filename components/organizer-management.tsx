"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type OrganizerSummary = { id: string; name: string; email: string | null; phone_number: string | null };

export function OrganizerManagement({ organizers }: { organizers: OrganizerSummary[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  async function sendReset(organizer: OrganizerSummary) {
    if (!organizer.email) return setMessage("This organizer does not have an email address on record.");
    setSending(organizer.id);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(organizer.email, { redirectTo: `${window.location.origin}/en/login` });
    setSending(null);
    setMessage(error ? error.message : `Password reset instructions sent to ${organizer.email}.`);
  }

  return <div className="admin-themed-page space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Organizers</h1><p className="mt-1 text-muted-foreground">View organizer accounts and send password reset instructions.</p></div>
    {message && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{message}</p>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Organizer</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3 text-right">Account</th></tr></thead><tbody>{organizers.map((organizer) => <tr key={organizer.id} className="border-b border-border"><td className="px-5 py-4 font-medium">{organizer.name || "Unnamed organizer"}</td><td className="px-5 py-4">{organizer.email || "—"}</td><td className="px-5 py-4">{organizer.phone_number || "—"}</td><td className="px-5 py-4 text-right"><button disabled={sending === organizer.id || !organizer.email} onClick={() => sendReset(organizer)} className="rounded-md border border-input px-3 py-2 font-medium hover:bg-muted disabled:opacity-50">{sending === organizer.id ? "Sending…" : "Send password reset"}</button></td></tr>)}</tbody></table>{organizers.length === 0 && <p className="p-8 text-center text-muted-foreground">No organizer accounts found.</p>}</div>
  </div>;
}
