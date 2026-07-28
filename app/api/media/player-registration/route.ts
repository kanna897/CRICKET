import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!supabaseUrl || !supabaseKey || !cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Player photo upload service is not configured." }, { status: 503 });
  }

  const formData = await request.formData();
  const tournamentId = formData.get("tournamentId");

  if (typeof tournamentId !== "string" || !tournamentId) {
    return NextResponse.json({ error: "Invalid player photo upload request." }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("player_registration_enabled", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !tournament) {
    return NextResponse.json({ error: "Player registration is not enabled for this tournament." }, { status: 403 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `crickpulse/player-registrations/${tournamentId}`;
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  return NextResponse.json({ cloudName, apiKey, folder, timestamp, signature });
}
