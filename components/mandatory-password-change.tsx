"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { CrickpulseLogo } from "@/components/crickpulse-logo";
import { supabase } from "@/lib/supabase";

export function MandatoryPasswordChange({ locale, email }: { locale: string; email: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must contain at least 8 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The password could not be changed.");
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      window.location.assign(`/${locale}/admin`);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "The password could not be changed.");
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
      <section className="register-card relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-7 text-center">
          <div className="register-logo-frame"><CrickpulseLogo className="h-16 w-full object-contain" /></div>
          <h1 className="text-2xl font-bold">Create your new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">You signed in as {email} using a temporary password. Set your own password before continuing.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <PasswordField label="New password" value={password} onChange={setPassword} visible={visible} />
          <PasswordField label="Confirm new password" value={confirmation} onChange={setConfirmation} visible={visible} />
          <button type="button" onClick={() => setVisible((current) => !current)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{visible ? "Hide passwords" : "Show passwords"}</button>
          {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="register-submit flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{submitting ? "Updating..." : "Set password and continue"}</button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange, visible }: { label: string; value: string; onChange: (value: string) => void; visible: boolean }) {
  return <label className="block space-y-2 text-sm font-medium"><span>{label}</span><input className="form-input" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}
