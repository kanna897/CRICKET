import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolveApplicationRole } from "@/lib/application-role";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Database } from "@/types/database.types";

type CreateOrganizerBody = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Only a master admin can create organizers." }, { status: 403 });
  }

  let body: CreateOrganizerBody;
  try {
    body = await request.json() as CreateOrganizerBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Organizer name must contain at least 2 characters." }, { status: 400 });
  }
  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Phone number must contain exactly 10 digits." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
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
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      organizer_name: name,
      organization_name: name,
      phone_number: phone,
    },
    app_metadata: { must_change_password: true },
  });

  if (error) {
    const duplicate = error.message.toLowerCase().includes("already") || error.status === 422;
    return NextResponse.json(
      { error: duplicate ? "An account already exists for this email address." : "The organizer account could not be created." },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ organizer: { id: data.user.id, name, email, phone_number: phone } }, { status: 201 });
}
