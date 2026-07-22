import { NextResponse } from "next/server";
import { calculateNetRunRate, calculatePoints } from "@/lib/calculations";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

    const { match_id, tournament_id, team1_id, team2_id, team1_score, team2_score, team1_overs, team2_overs, winner_id } = await request.json();
    if (!match_id || !tournament_id) return NextResponse.json({ error: "Missing required match parameters" }, { status: 400 });

    const { data: match } = await (supabase.from("matches") as any)
      .select("id, tournament_id")
      .eq("id", match_id)
      .eq("tournament_id", tournament_id)
      .maybeSingle();
    if (!match) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    const nrrImpactTeam1 = calculateNetRunRate(team1_score, team1_overs, team2_score, team2_overs);
    const nrrImpactTeam2 = calculateNetRunRate(team2_score, team2_overs, team1_score, team1_overs);
    const { team1Points, team2Points } = calculatePoints(winner_id, team1_id, team2_id);

    const { data: updated, error } = await (supabase.from("matches") as any)
      .update({ status: "completed" })
      .eq("id", match_id)
      .eq("tournament_id", tournament_id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

    return NextResponse.json({ success: true, message: "Calculations Engine Executed Successfully", nrr: { team1: nrrImpactTeam1, team2: nrrImpactTeam2 }, points: { team1: team1Points, team2: team2Points } });
  } catch (error: unknown) {
    console.error("Calculation Engine Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
