import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Account deletion is not configured." }, 503);
  if (!token) return json({ error: "Authentication is required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return json({ error: "Authentication is required." }, 401);

  const { data: callerProfile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!["admin", "super_admin", "master_admin"].includes(callerProfile?.role ?? "")) {
    return json({ error: "Only a master admin can delete organizers." }, 403);
  }

  const body = await request.json().catch(() => null) as { organizerId?: unknown } | null;
  const organizerId = typeof body?.organizerId === "string" ? body.organizerId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizerId)) {
    return json({ error: "A valid organizer account is required." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: organizer } = await admin.from("profiles").select("id,role").eq("id", organizerId).maybeSingle();
  if (!organizer || organizer.role !== "organizer") return json({ error: "Organizer account not found." }, 404);

  const ownershipChecks = await Promise.all([
    admin.from("tournaments").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId),
    admin.from("clubs").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId),
    admin.from("teams").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId),
    admin.from("matches").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId),
  ]);
  if (ownershipChecks.some((result) => result.error)) {
    return json({ error: "Could not verify organizer ownership. Please try again." }, 500);
  }

  const ownedItems = ownershipChecks.reduce((total, result) => total + (result.count ?? 0), 0);
  if (ownedItems > 0) {
    return json({
      error: `This organizer owns ${ownedItems} cricket record${ownedItems === 1 ? "" : "s"}. Reassign or remove those records before deleting the account.`,
    }, 409);
  }

  const { error } = await admin.auth.admin.deleteUser(organizerId);
  if (error) return json({ error: "The organizer account could not be deleted." }, 500);
  return json({ success: true });
});
