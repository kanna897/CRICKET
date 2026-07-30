import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database.types";
import type { Innings } from "./types";

type InningsSetup = {
  match_id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id: string;
  striker_id: string;
  non_striker_id: string;
  current_bowler_id: string;
};

type DeliveryRpc = {
  p_ball: Json;
  p_next_striker_id: string;
  p_next_non_striker_id: string;
  p_innings_complete: boolean;
};

export const scoringApi = {
  getMatch: (matchId: string) =>
    supabase.from("matches").select("*").eq("id", matchId).maybeSingle(),
  getTeams: (teamIds: string[]) =>
    supabase.from("teams").select("id,name,logo_url,primary_color").in("id", teamIds),
  getPlayers: () =>
    supabase.from("players").select("id,name,team_id,playing_role,photo_url").order("name"),
  getSquad: (matchId: string) =>
    supabase.from("match_squads").select("player_id").eq("match_id", matchId),
  getLatestInnings: (matchId: string) =>
    supabase.from("innings").select("*").eq("match_id", matchId)
      .order("innings_number", { ascending: false }).limit(1).maybeSingle(),
  getSecondInnings: (matchId: string) =>
    supabase.from("innings").select("*").eq("match_id", matchId)
      .eq("innings_number", 2).maybeSingle(),
  createSecondInnings: (payload: {
    match_id: string;
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    target: number;
  }) => supabase.from("innings").insert(payload).select("*").maybeSingle(),
  createSecondInningsStrict: (payload: {
    match_id: string;
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    target: number;
  }) => supabase.from("innings").insert(payload).select("*").single(),
  getInningsBalls: (inningsId: string) =>
    supabase.from("ball_by_ball").select("*").eq("innings_id", inningsId)
      .order("created_at", { ascending: false }),
  recordDelivery: (payload: DeliveryRpc) =>
    supabase.rpc("record_scoring_delivery", payload),
  getPlayerPhotos: () =>
    supabase.from("players").select("id,photo_url"),
  updateInnings: (inningsId: string, payload: Partial<Innings>) =>
    supabase.from("innings").update(payload).eq("id", inningsId),
  getMatchInningsIds: (matchId: string) =>
    supabase.from("innings").select("id").eq("match_id", matchId),
  getPlayerOfMatchBalls: (inningsIds: string[]) =>
    supabase.from("ball_by_ball")
      .select("batsman_id,bowler_id,runs,is_wicket,dismissal_type")
      .in("innings_id", inningsIds),
  saveInningsSetup: (inningsId: string | null, payload: InningsSetup) =>
    inningsId
      ? supabase.from("innings").update(payload).eq("id", inningsId).select("*").single()
      : supabase.from("innings").insert(payload).select("*").single(),
  updateMatch: (matchId: string, payload: {
    status?: string;
    winner_id?: string | null;
    player_of_match_id?: string | null;
    player_of_match_summary?: string | null;
    toss_winner_id?: string;
    toss_decision?: string;
    revised_overs?: number;
    target_method?: string;
    interruption_notes?: string | null;
  }) => supabase.from("matches").update(payload).eq("id", matchId),
  undoDelivery: (payload: { p_innings_id: string }) =>
    supabase.rpc("undo_last_scoring_delivery", payload),
};
