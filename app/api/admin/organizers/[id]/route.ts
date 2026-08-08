import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (resolveApplicationRole(currentProfile?.role) !== "master_admin") {
    return NextResponse.json({ error: "Only a master admin can reset organizer passwords." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Account management is not configured." }, { status: 503 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: organizer } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!organizer || organizer.role !== "organizer") {
    return NextResponse.json({ error: "Organizer account not found." }, { status: 404 });
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(id);
  if (authUserError || !authUser.user) {
    return NextResponse.json({ error: "Organizer account not found." }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    password,
    app_metadata: { ...authUser.user.app_metadata, must_change_password: true },
  });
  if (error) {
    return NextResponse.json({ error: "The organizer password could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (resolveApplicationRole(currentProfile?.role) !== "master_admin") {
    return NextResponse.json({ error: "Only a master admin can delete organizers." }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Account deletion is not configured." }, { status: 503 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: organizer } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", id)
    .maybeSingle();

  if (!organizer || organizer.role !== "organizer") {
    return NextResponse.json({ error: "Organizer account not found." }, { status: 404 });
  }

  const ownershipChecks = await Promise.all([
    admin.from("tournaments").select("id", { count: "exact", head: true }).eq("organizer_id", id),
    admin.from("clubs").select("id", { count: "exact", head: true }).eq("organizer_id", id),
    admin.from("teams").select("id", { count: "exact", head: true }).eq("organizer_id", id),
    admin.from("matches").select("id", { count: "exact", head: true }).eq("organizer_id", id),
  ]);
  const ownershipError = ownershipChecks.find((result) => result.error)?.error;
  if (ownershipError) {
    return NextResponse.json({ error: "Could not verify organizer ownership. Please try again." }, { status: 500 });
  }

  const ownedItems = ownershipChecks.reduce((total, result) => total + (result.count ?? 0), 0);
  if (ownedItems > 0) {
    return NextResponse.json(
      { error: `This organizer owns ${ownedItems} cricket record${ownedItems === 1 ? "" : "s"}. Reassign or remove those records before deleting the account.` },
      { status: 409 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: "The organizer account could not be deleted." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
