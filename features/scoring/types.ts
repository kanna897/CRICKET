export type Match = {
  id: string; team_a_id: string; team_b_id: string; overs_per_match: number; status: string;
  toss_winner_id: string | null; toss_decision: string | null; player_of_match_id: string | null;
  player_of_match_summary: string | null; assigned_scorer_id: string | null; scoring_locked: boolean;
  balls_per_over: number; wickets_per_innings: number; last_man_stands: boolean; allow_wides: boolean;
  allow_no_balls: boolean; revised_overs: number | null; target_method: string | null; interruption_notes: string | null;
};

export type Team = { id: string; name: string; logo_url: string | null; primary_color: string | null };
export type Player = { id: string; name: string; team_id: string | null; playing_role: string | null; photo_url: string | null };
export type Innings = {
  id: string; innings_number: number; batting_team_id: string; bowling_team_id: string; total_runs: number;
  total_wickets: number; balls_bowled: number; extras: number; target: number | null; is_completed: boolean;
  striker_id: string | null; non_striker_id: string | null; current_bowler_id: string | null;
};
export type Ball = {
  id: string; client_event_id?: string; over_number: number; ball_number: number; runs: number; extras: number;
  extras_type: string | null; is_legal: boolean; is_wicket: boolean; dismissal_type: string | null;
  batsman_id: string | null; non_striker_id: string | null; bowler_id: string | null; player_out_id: string | null;
  commentary?: string | null;
};
export type Setup = { battingTeam: string; striker: string; nonStriker: string; bowler: string };
export type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};
