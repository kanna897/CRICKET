"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return { error: error?.message ?? null, code: error?.code ?? null };
}

export async function signInWithForm(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const locale = ["en", "ta", "si"].includes(String(formData.get("locale"))) ? String(formData.get("locale")) : "en";
  const requestedPath = String(formData.get("redirectTo") || "");
  const redirectTo = requestedPath.startsWith(`/${locale}/`) ? requestedPath : `/${locale}/admin`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/${locale}/login?error=${error.code === "email_not_confirmed" ? "confirmation" : "credentials"}`);
  redirect(redirectTo);
}
