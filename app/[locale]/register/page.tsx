"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Eye, EyeOff, Moon, Sun, UserPlus } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase";
import { CrickpulseLogo } from "@/components/crickpulse-logo";

export default function RegisterPage() {
  const params = useParams<{ locale: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const [organizerName, setOrganizerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
      setError("Phone number must contain exactly 10 digits.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          organizer_name: organizerName.trim(),
          organization_name: organizerName.trim(),
          phone_number: phoneNumber || null,
        },
        emailRedirectTo: `${window.location.origin}/${params.locale}/auth/callback`,
      },
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="register-page flex min-h-screen items-center justify-center px-4 py-12 text-foreground">
        <div className="register-grid" aria-hidden="true" />
        <span className="register-orb register-orb-one" aria-hidden="true" />
        <span className="register-orb register-orb-two" aria-hidden="true" />
        <span className="register-floating-ball register-floating-ball-one" aria-hidden="true" />
        <span className="register-floating-ball register-floating-ball-two" aria-hidden="true" />
        <button type="button" className="register-theme-toggle" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}>{resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
        <section className="register-card relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="register-logo-frame"><CrickpulseLogo className="h-16 w-full object-contain" /></div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white"><UserPlus className="h-6 w-6" /></div>
          <h1 className="text-2xl font-bold">Account created</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Check your email and confirm your address. After confirmation, sign in to create and manage your own tournaments.</p>
          <Link href={`/${params.locale}/login`} className="register-submit mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 font-semibold text-white">Go to sign in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="register-page min-h-screen px-4 py-12 text-foreground sm:flex sm:items-center sm:justify-center">
      <div className="register-grid" aria-hidden="true" />
      <span className="register-orb register-orb-one" aria-hidden="true" />
      <span className="register-orb register-orb-two" aria-hidden="true" />
      <span className="register-floating-ball register-floating-ball-one" aria-hidden="true" />
      <span className="register-floating-ball register-floating-ball-two" aria-hidden="true" />
      <button type="button" className="register-theme-toggle" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}>{resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
      <section className="register-card relative z-10 w-full max-w-lg rounded-[1.75rem] border border-white/60 bg-white/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <div className="register-logo-frame">
            <CrickpulseLogo className="h-16 w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold">Create organizer account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Register as an organizer to create and securely manage your own tournaments.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field label="Tournament organizer name (Club name)"><input className="form-input" type="text" autoComplete="organization" value={organizerName} onChange={(event) => setOrganizerName(event.target.value)} required /></Field>
          <Field label="Phone number (optional)"><input className="form-input" type="tel" inputMode="numeric" autoComplete="tel" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="10 digit phone number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} /></Field>
          <Field label="Email address"><input className="form-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <PasswordField label="Password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
            <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} />
          </div>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">{error}</p>}

          <button className="register-submit flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
            <UserPlus className="h-4 w-4" />{isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href={`/${params.locale}/login`} className="font-semibold text-primary hover:underline">Sign in</Link></p>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-2 text-sm font-medium"><span>{label}</span>{children}</label>;
}

function PasswordField({ label, value, onChange, visible, onToggle }: { label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <label className="block space-y-2 text-sm font-medium"><span>{label}</span><span className="relative block"><input className="form-input pr-11" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} value={value} onChange={(event) => onChange(event.target.value)} required /><button type="button" onClick={onToggle} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>;
}
