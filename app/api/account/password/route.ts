import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

export async function PATCH(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  if (user.app_metadata?.must_change_password !== true) {
    return NextResponse.json({ error: "Use account settings to change your password." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Password management is not configured." }, { status: 503 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  if (error) return NextResponse.json({ error: "The password could not be changed." }, { status: 500 });

  if (!user.email) {
    return NextResponse.json({ error: "This account does not have a sign-in email address." }, { status: 400 });
  }
  const { error: sessionError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (sessionError) {
    return NextResponse.json({ error: "Password changed, but the session could not be renewed. Please sign in again." }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
