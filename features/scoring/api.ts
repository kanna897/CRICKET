import { supabase } from "@/lib/supabase";
import type { Json } from "@/types/database.types";
import type { Innings } from "./types";
import { monitorDatabaseOperation } from "@/lib/monitoring/database";

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
    monitorDatabaseOperation("scoring.get_match", () => supabase.from("matches").select("*").eq("id", matchId).maybeSingle()),
  getTeams: (teamIds: string[]) =>
    monitorDatabaseOperation("scoring.get_teams", () => supabase.from("teams").select("id,name,logo_url,primary_color").in("id", teamIds)),
  getPlayers: () =>
    monitorDatabaseOperation("scoring.get_players", () => supabase.from("players").select("id,name,team_id,playing_role,photo_url").order("name")),
  getSquad: (matchId: string) =>
    monitorDatabaseOperation("scoring.get_squad", () => supabase.from("match_squads").select("player_id").eq("match_id", matchId)),
  getLatestInnings: (matchId: string) =>
    monitorDatabaseOperation("scoring.get_latest_innings", () => supabase.from("innings").select("*").eq("match_id", matchId)
      .order("innings_number", { ascending: false }).limit(1).maybeSingle()),
  getSecondInnings: (matchId: string) =>
    monitorDatabaseOperation("scoring.get_second_innings", () => supabase.from("innings").select("*").eq("match_id", matchId)
      .eq("innings_number", 2).maybeSingle()),
  createSecondInnings: (payload: {
    match_id: string;
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    target: number;
  }) => monitorDatabaseOperation("scoring.create_second_innings", () => supabase.from("innings").insert(payload).select("*").maybeSingle()),
  createSecondInningsStrict: (payload: {
    match_id: string;
    innings_number: number;
    batting_team_id: string;
    bowling_team_id: string;
    target: number;
  }) => monitorDatabaseOperation("scoring.create_second_innings_strict", () => supabase.from("innings").insert(payload).select("*").single()),
  getInningsBalls: (inningsId: string) =>
    monitorDatabaseOperation("scoring.get_innings_balls", () => supabase.from("ball_by_ball").select("*").eq("innings_id", inningsId)
      .order("created_at", { ascending: false })),
  recordDelivery: (payload: DeliveryRpc) =>
    monitorDatabaseOperation("scoring.record_delivery", () => supabase.rpc("record_scoring_delivery", payload)),
  getPlayerPhotos: () =>
    monitorDatabaseOperation("scoring.get_player_photos", () => supabase.from("players").select("id,photo_url")),
  updateInnings: (inningsId: string, payload: Partial<Innings>) =>
    monitorDatabaseOperation("scoring.update_innings", () => supabase.from("innings").update(payload).eq("id", inningsId)),
  getMatchInningsIds: (matchId: string) =>
    monitorDatabaseOperation("scoring.get_match_innings_ids", () => supabase.from("innings").select("id").eq("match_id", matchId)),
  getPlayerOfMatchBalls: (inningsIds: string[]) =>
    monitorDatabaseOperation("scoring.get_player_of_match_balls", () => supabase.from("ball_by_ball")
      .select("batsman_id,bowler_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type,fielder_id")
      .in("innings_id", inningsIds)),
  saveInningsSetup: (inningsId: string | null, payload: InningsSetup) =>
    monitorDatabaseOperation("scoring.save_innings_setup", () => inningsId
      ? supabase.from("innings").update(payload).eq("id", inningsId).select("*").single()
      : supabase.from("innings").insert(payload).select("*").single()),
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
  }) => monitorDatabaseOperation("scoring.update_match", () => supabase.from("matches").update(payload).eq("id", matchId)),
  undoDelivery: (payload: { p_innings_id: string }) =>
    monitorDatabaseOperation("scoring.undo_delivery", () => supabase.rpc("undo_last_scoring_delivery", payload)),
};
