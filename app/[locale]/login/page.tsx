"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { supabase } from "@/lib/supabase";
import { CrickpulseLogo } from "@/components/crickpulse-logo";
import { signInWithEmail } from "./actions";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ locale: string }>();
  const { resolvedTheme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const requestedPath = searchParams.get("redirectedFrom");
  const redirectTo = requestedPath?.startsWith(`/${params.locale}/`)
    ? requestedPath
    : `/${params.locale}/admin`;
  const accessError = searchParams.get("error") === "unauthorized"
    ? "This account does not have an administrator role."
    : searchParams.get("error") === "session"
      ? "Your sign-in session could not be verified. Please sign in again."
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConfirmationSent(false);
    setNeedsConfirmation(false);
    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const signInResult = await signInWithEmail(normalizedEmail, password);

      if (signInResult.error) {
        if (signInResult.code === "email_not_confirmed") {
          setNeedsConfirmation(true);
          setError("Your email address is not confirmed yet. Open the confirmation link sent to your inbox, or resend it below.");
        } else if (signInResult.code === "invalid_credentials") {
          setError("The email address or password is incorrect.");
        } else {
          setError(signInResult.error);
        }
        return;
      }

      // The Server Action writes persistent auth cookies before navigation.
      window.location.assign(redirectTo);
    } catch (signInError) {
      console.error("Unable to reach Supabase Auth", signInError);
      setError("Unable to connect to the authentication service. Check your internet connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmation() {
    setError(null);
    setConfirmationSent(false);
    setIsResending(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/${params.locale}/auth/callback`,
      },
    });
    setIsResending(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setConfirmationSent(true);
  }

  return (
    <main className="register-page min-h-screen px-4 py-12 text-foreground sm:flex sm:items-center sm:justify-center">
      <div className="register-grid" aria-hidden="true" />
      <span className="register-orb register-orb-one" aria-hidden="true" />
      <span className="register-orb register-orb-two" aria-hidden="true" />
      <span className="register-floating-ball register-floating-ball-one" aria-hidden="true" />
      <span className="register-floating-ball register-floating-ball-two" aria-hidden="true" />
      <button type="button" className="register-theme-toggle" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}>{resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
      <section className="register-card relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/60 bg-white/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="register-logo-frame"><CrickpulseLogo className="h-16 w-full object-contain" /></div>
          <h1 className="text-2xl font-bold">Admin sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to manage your cricket tournaments.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Email address</span>
            <input
              className="form-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>Password</span>
            <span className="relative block"><input className="form-input pr-11" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span>
          </label>

          {(error || accessError) && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600" role="alert">
              {error || accessError}
            </p>
          )}

          {confirmationSent && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700" role="status">Confirmation email sent. Check your inbox and spam folder.</p>}

          {needsConfirmation && <button type="button" onClick={resendConfirmation} disabled={isResending || !email} className="w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60">{isResending ? "Sending…" : "Resend confirmation email"}</button>}

          <button
            className="register-submit flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isSubmitting}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">New tournament organizer? <Link href={`/${params.locale}/register`} className="font-semibold text-primary hover:underline">Create an account</Link></p>
      </section>
    </main>
  );
}
