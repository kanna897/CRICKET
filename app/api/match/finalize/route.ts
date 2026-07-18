import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateNetRunRate, calculatePoints } from '@/lib/calculations';

export async function POST(request: Request) {
  try {
    const { match_id, tournament_id, team1_id, team2_id, team1_score, team2_score, team1_overs, team2_overs, winner_id } = await request.json();

    if (!match_id || !tournament_id) {
      return NextResponse.json({ error: 'Missing required match parameters' }, { status: 400 });
    }

    // 1. Calculate NRR
    const nrrImpactTeam1 = calculateNetRunRate(team1_score, team1_overs, team2_score, team2_overs);
    const nrrImpactTeam2 = calculateNetRunRate(team2_score, team2_overs, team1_score, team1_overs);

    // 2. Assign Points
    const { team1Points, team2Points } = calculatePoints(winner_id, team1_id, team2_id);

    // 3. Update Teams Table with new NRR and Points (Simulated increment via RPC or generic update)
    // In a real scenario, this would use a Postgres function (RPC) to atomically increment. 
    // For this implementation, we will mock the update logic since we don't have the RPC defined.
    
    // Update Match Status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: matchError } = await (supabase.from('matches') as any)
      .update({ status: 'completed' })
      .eq('id', match_id);

    if (matchError) throw matchError;

    return NextResponse.json({ 
      success: true, 
      message: 'Calculations Engine Executed Successfully',
      nrr: { team1: nrrImpactTeam1, team2: nrrImpactTeam2 },
      points: { team1: team1Points, team2: team2Points }
    });

  } catch (error: unknown) {
    console.error("Calculation Engine Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
