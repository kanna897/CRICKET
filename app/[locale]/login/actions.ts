"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signInWithEmail(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return { error: error?.message ?? null };
}
