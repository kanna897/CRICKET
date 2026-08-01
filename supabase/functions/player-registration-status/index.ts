import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const normalizeContact = (value: unknown) =>
  typeof value === "string" ? value.replace(/\D/g, "") : "";

const normalizeCode = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const trackingCode = normalizeCode(payload.trackingCode);
  const contactNumber = normalizeContact(payload.contactNumber);
  if (!/^[A-F0-9]{12}$/.test(trackingCode) || !/^\d{7,15}$/.test(contactNumber)) {
    return json({ error: "Enter a valid tracking code and contact number." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Status service is temporarily unavailable." }, 503);
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwardedFor ||
    "unknown";
  const identifierHash = await sha256(`registration-status:${clientAddress}`);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allowed, error: limitError } = await supabase.rpc(
    "consume_registration_lookup_attempt",
    {
      p_identifier_hash: identifierHash,
      p_max_attempts: 5,
      p_window: "10 minutes",
    },
  );
  if (limitError) {
    console.error("Registration lookup rate-limit failed", limitError.message);
    return json({ error: "Status service is temporarily unavailable." }, 503);
  }
  if (!allowed) {
    return json(
      { error: "Too many attempts. Please try again after 10 minutes." },
      429,
    );
  }

  const { data, error } = await supabase
    .from("player_registrations")
    .select(
      "player_name,status,created_at,reviewed_at,tournaments!inner(name,deleted_at)",
    )
    .eq("tracking_code", trackingCode)
    .eq("contact_number_normalized", contactNumber)
    .is("tournaments.deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Registration status lookup failed", error.message);
    return json({ error: "Status service is temporarily unavailable." }, 503);
  }

  if (!data) {
    return json({ found: false });
  }

  const tournament = Array.isArray(data.tournaments)
    ? data.tournaments[0]
    : data.tournaments;

  return json({
    found: true,
    registration: {
      playerName: data.player_name,
      tournamentName: tournament?.name ?? "Tournament",
      status: data.status,
      submittedAt: data.created_at,
      reviewedAt: data.reviewed_at,
    },
  });
});
