import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  generatePlayerCardJpeg,
  generateTeamPlayerCardJpeg,
  uploadGeneratedJpeg,
} from "@/lib/auction-card-generator";
import type { PlayerCardLayout } from "@/lib/player-card-layout";

export const runtime = "nodejs";

type PublicPayload = {
  registration_id: string;
  tournament_id: string;
  player_name: string;
  contact_number: string;
  photo_url: string;
  playing_role: string;
  batting_style: string;
  bowling_style: string;
  registration_number: number;
  template_url: string | null;
  template_layout: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      kind?: "player" | "team_player";
      registrationId?: string;
      trackingCode?: string;
      auctionPlayerId?: string;
    };
    if (body.kind === "player") return await createPublicPlayerCard(body.registrationId, body.trackingCode);
    if (body.kind === "team_player") return await createTeamPlayerCard(body.auctionPlayerId);
    return NextResponse.json({ error: "Invalid card generation request." }, { status: 400 });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Card generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createPublicPlayerCard(registrationId?: string, trackingCode?: string) {
  if (!registrationId || !trackingCode) {
    return NextResponse.json({ error: "Registration ID and tracking code are required." }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await (supabase.rpc as any)("get_registration_card_payload", {
    p_registration_id: registrationId,
    p_tracking_code: trackingCode,
  });
  if (error) throw error;
  const payload = (data?.[0] || null) as PublicPayload | null;
  if (!payload) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  if (!payload.template_url) {
    return NextResponse.json({ generated: false, reason: "No active player-card template is selected.", registrationNumber: payload.registration_number });
  }
  const jpeg = await generatePlayerCardJpeg({
    id: payload.registration_id,
    templateUrl: payload.template_url,
    photoUrl: payload.photo_url,
    playerName: payload.player_name,
    playingRole: payload.playing_role,
    battingStyle: payload.batting_style,
    bowlingStyle: payload.bowling_style,
    mobileNumber: payload.contact_number,
    registrationNumber: payload.registration_number,
    layout: payload.template_layout as PlayerCardLayout,
  });
  const cardUrl = await uploadGeneratedJpeg(
    jpeg,
    `crickpulse/tournaments/${payload.tournament_id}/player-cards`,
    `${payload.registration_id}-player-card`,
  );
  const { error: saveError } = await (supabase.rpc as any)("save_registration_card_url", {
    p_registration_id: registrationId,
    p_tracking_code: trackingCode,
    p_card_url: cardUrl,
  });
  if (saveError) throw saveError;
  return NextResponse.json({ generated: true, url: cardUrl, registrationNumber: payload.registration_number });
}

async function createTeamPlayerCard(auctionPlayerId?: string) {
  if (!auctionPlayerId) {
    return NextResponse.json({ error: "Auction player ID is required." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: auctionPlayer, error } = await (supabase.from("auction_players") as any)
    .select("id,tournament_id,registration_id,winning_team_id,winning_bid,status")
    .eq("id", auctionPlayerId)
    .maybeSingle();
  if (error) throw error;
  if (!auctionPlayer || auctionPlayer.status !== "sold" || !auctionPlayer.winning_team_id) {
    return NextResponse.json({ error: "Only sold players can receive a team card." }, { status: 409 });
  }
  const [{ data: registration }, { data: team }, { data: choice }] = await Promise.all([
    (supabase.from("player_registrations") as any)
      .select("player_name,contact_number,photo_url,playing_role,batting_style,bowling_style,registration_number")
      .eq("id", auctionPlayer.registration_id).maybeSingle(),
    (supabase.from("teams") as any).select("name,logo_url").eq("id", auctionPlayer.winning_team_id).maybeSingle(),
    (supabase.from("tournament_card_templates") as any)
      .select("team_player_template_id").eq("tournament_id", auctionPlayer.tournament_id).maybeSingle(),
  ]);
  if (!registration || !team || !choice?.team_player_template_id) {
    return NextResponse.json({ generated: false, reason: "Select a visible team-player template first." });
  }
  const { data: template } = await (supabase.from("card_templates") as any)
    .select("image_url").eq("id", choice.team_player_template_id).eq("is_visible", true).maybeSingle();
  if (!template?.image_url) {
    return NextResponse.json({ generated: false, reason: "The selected team-player template is hidden." });
  }
  const jpeg = await generateTeamPlayerCardJpeg({
    id: auctionPlayer.id,
    templateUrl: template.image_url,
    photoUrl: registration.photo_url,
    playerName: registration.player_name,
    playingRole: registration.playing_role,
    battingStyle: registration.batting_style,
    bowlingStyle: registration.bowling_style,
    mobileNumber: registration.contact_number,
    registrationNumber: registration.registration_number,
    teamName: team.name,
    teamLogoUrl: team.logo_url,
    auctionPrice: Number(auctionPlayer.winning_bid || 0),
  });
  const cardUrl = await uploadGeneratedJpeg(
    jpeg,
    `crickpulse/auction-cards/${auctionPlayer.tournament_id}/teams/${auctionPlayer.winning_team_id}`,
    `${auctionPlayer.id}-team-card`,
  );
  const { error: updateError } = await (supabase.from("auction_players") as any)
    .update({ team_player_card_url: cardUrl }).eq("id", auctionPlayer.id);
  if (updateError) throw updateError;
  return NextResponse.json({ generated: true, url: cardUrl });
}
