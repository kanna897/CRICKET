export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auction_history: {
        Row: {
          action: string
          auction_player_id: string
          bid_amount: number | null
          created_at: string
          created_by: string | null
          id: number
          registration_id: string | null
          team_id: string | null
          tournament_id: string
        }
        Insert: {
          action: string
          auction_player_id: string
          bid_amount?: number | null
          created_at?: string
          created_by?: string | null
          id?: number
          registration_id?: string | null
          team_id?: string | null
          tournament_id: string
        }
        Update: {
          action?: string
          auction_player_id?: string
          bid_amount?: number | null
          created_at?: string
          created_by?: string | null
          id?: number
          registration_id?: string | null
          team_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_history_auction_player_id_fkey"
            columns: ["auction_player_id"]
            isOneToOne: false
            referencedRelation: "auction_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_history_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "player_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_history_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_players: {
        Row: {
          batting_style: string
          bowling_style: string
          contact_number: string | null
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        Insert: {
          batting_style: string
          bowling_style: string
          contact_number?: string | null
          created_at?: string
          id?: string
          ocr_serial_number?: number | null
          photo_url: string
          player_card_url?: string | null
          player_id?: string | null
          player_name: string
          playing_role: string
          registration_id?: string | null
          registration_number?: number
          sold_at?: string | null
          source_type?: string
          status?: string
          team_player_card_url?: string | null
          tournament_id: string
          updated_at?: string
          winning_bid?: number | null
          winning_team_id?: string | null
        }
        Update: {
          batting_style?: string
          bowling_style?: string
          contact_number?: string | null
          created_at?: string
          id?: string
          ocr_serial_number?: number | null
          photo_url?: string
          player_card_url?: string | null
          player_id?: string | null
          player_name?: string
          playing_role?: string
          registration_id?: string | null
          registration_number?: number
          sold_at?: string | null
          source_type?: string
          status?: string
          team_player_card_url?: string | null
          tournament_id?: string
          updated_at?: string
          winning_bid?: number | null
          winning_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_players_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "player_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_players_winning_team_id_fkey"
            columns: ["winning_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_sessions: {
        Row: {
          created_at: string
          current_auction_player_id: string | null
          ended_at: string | null
          id: string
          started_at: string | null
          status: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_auction_player_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_auction_player_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_sessions_current_auction_player_id_fkey"
            columns: ["current_auction_player_id"]
            isOneToOne: false
            referencedRelation: "auction_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_team_purses: {
        Row: {
          initial_purse: number
          purchased_count: number
          team_id: string
          total_spent: number
          tournament_id: string
          updated_at: string
        }
        Insert: {
          initial_purse?: number
          purchased_count?: number
          team_id: string
          total_spent?: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          initial_purse?: number
          purchased_count?: number
          team_id?: string
          total_spent?: number
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_team_purses_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_team_purses_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          device_browser: string | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          new_values: Json
          old_values: Json
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          device_browser?: string | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          new_values?: Json
          old_values?: Json
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          device_browser?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_values?: Json
          old_values?: Json
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      awards: {
        Row: {
          award_type: string
          created_at: string
          id: string
          player_id: string
          tournament_id: string
        }
        Insert: {
          award_type: string
          created_at?: string
          id?: string
          player_id: string
          tournament_id: string
        }
        Update: {
          award_type?: string
          created_at?: string
          id?: string
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "awards_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      ball_by_ball: {
        Row: {
          ball_number: number
          batsman_id: string | null
          bowler_id: string | null
          client_event_id: string
          commentary: string | null
          created_at: string
          dismissal_type: string | null
          extras: number
          extras_type: string | null
          fielder_id: string | null
          id: string
          innings_id: string
          is_legal: boolean
          is_wicket: boolean
          non_striker_id: string | null
          over_number: number
          player_out_id: string | null
          recorded_by: string | null
          runs: number
        }
        Insert: {
          ball_number: number
          batsman_id?: string | null
          bowler_id?: string | null
          client_event_id?: string
          commentary?: string | null
          created_at?: string
          dismissal_type?: string | null
          extras?: number
          extras_type?: string | null
          fielder_id?: string | null
          id?: string
          innings_id: string
          is_legal?: boolean
          is_wicket?: boolean
          non_striker_id?: string | null
          over_number: number
          player_out_id?: string | null
          recorded_by?: string | null
          runs?: number
        }
        Update: {
          ball_number?: number
          batsman_id?: string | null
          bowler_id?: string | null
          client_event_id?: string
          commentary?: string | null
          created_at?: string
          dismissal_type?: string | null
          extras?: number
          extras_type?: string | null
          fielder_id?: string | null
          id?: string
          innings_id?: string
          is_legal?: boolean
          is_wicket?: boolean
          non_striker_id?: string | null
          over_number?: number
          player_out_id?: string | null
          recorded_by?: string | null
          runs?: number
        }
        Relationships: [
          {
            foreignKeyName: "ball_by_ball_batsman_id_fkey"
            columns: ["batsman_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ball_by_ball_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ball_by_ball_fielder_id_fkey"
            columns: ["fielder_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ball_by_ball_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ball_by_ball_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ball_by_ball_player_out_id_fkey"
            columns: ["player_out_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      batting_scorecard: {
        Row: {
          balls_faced: number
          dismissal_type: string | null
          fours: number
          id: string
          innings_id: string
          is_out: boolean
          player_id: string
          retired_hurt: boolean
          runs: number
          sixes: number
          strike: number | null
        }
        Insert: {
          balls_faced?: number
          dismissal_type?: string | null
          fours?: number
          id?: string
          innings_id: string
          is_out?: boolean
          player_id: string
          retired_hurt?: boolean
          runs?: number
          sixes?: number
          strike?: number | null
        }
        Update: {
          balls_faced?: number
          dismissal_type?: string | null
          fours?: number
          id?: string
          innings_id?: string
          is_out?: boolean
          player_id?: string
          retired_hurt?: boolean
          runs?: number
          sixes?: number
          strike?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batting_scorecard_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batting_scorecard_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      bowling_scorecard: {
        Row: {
          balls_bowled: number
          id: string
          innings_id: string
          no_balls: number
          overs: number
          player_id: string
          runs_conceded: number
          wickets: number
          wides: number
        }
        Insert: {
          balls_bowled?: number
          id?: string
          innings_id: string
          no_balls?: number
          overs?: number
          player_id: string
          runs_conceded?: number
          wickets?: number
          wides?: number
        }
        Update: {
          balls_bowled?: number
          id?: string
          innings_id?: string
          no_balls?: number
          overs?: number
          player_id?: string
          runs_conceded?: number
          wickets?: number
          wides?: number
        }
        Relationships: [
          {
            foreignKeyName: "bowling_scorecard_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bowling_scorecard_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_visible: boolean
          layout: Json
          name: string
          organizer_id: string
          public_id: string | null
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_visible?: boolean
          layout?: Json
          name: string
          organizer_id: string
          public_id?: string | null
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_visible?: boolean
          layout?: Json
          name?: string
          organizer_id?: string
          public_id?: string | null
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_seasons: {
        Row: {
          club_id: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          created_at: string
          id: string
          location: string | null
          logo_url: string | null
          name: string
          organizer_id: string
          short_name: string | null
          social_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          organizer_id: string
          short_name?: string | null
          social_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          organizer_id?: string
          short_name?: string | null
          social_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      innings: {
        Row: {
          balls_bowled: number
          batting_team_id: string
          bowling_team_id: string
          created_at: string
          current_bowler_id: string | null
          extras: number
          id: string
          innings_number: number
          is_completed: boolean
          match_id: string
          non_striker_id: string | null
          overs_completed: number
          striker_id: string | null
          target: number | null
          total_runs: number
          total_wickets: number
        }
        Insert: {
          balls_bowled?: number
          batting_team_id: string
          bowling_team_id: string
          created_at?: string
          current_bowler_id?: string | null
          extras?: number
          id?: string
          innings_number: number
          is_completed?: boolean
          match_id: string
          non_striker_id?: string | null
          overs_completed?: number
          striker_id?: string | null
          target?: number | null
          total_runs?: number
          total_wickets?: number
        }
        Update: {
          balls_bowled?: number
          batting_team_id?: string
          bowling_team_id?: string
          created_at?: string
          current_bowler_id?: string | null
          extras?: number
          id?: string
          innings_number?: number
          is_completed?: boolean
          match_id?: string
          non_striker_id?: string | null
          overs_completed?: number
          striker_id?: string | null
          target?: number | null
          total_runs?: number
          total_wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_current_bowler_id_fkey"
            columns: ["current_bowler_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "innings_striker_id_fkey"
            columns: ["striker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          innings_id: string | null
          match_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          innings_id?: string | null
          match_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          innings_id?: string | null
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_squads: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          match_id: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          match_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_squads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          allow_no_balls: boolean
          allow_wides: boolean
          assigned_scorer_id: string | null
          balls_per_over: number
          bracket_round: number | null
          bracket_slot: number | null
          competition_stage: string
          created_at: string
          ground: string | null
          id: string
          interruption_notes: string | null
          is_public: boolean
          last_man_stands: boolean
          match_date: string | null
          match_number: number | null
          match_scope: string
          match_time: string | null
          match_type: string
          organizer_id: string | null
          overs_per_match: number
          player_of_match_id: string | null
          player_of_match_summary: string | null
          result_type: string | null
          revised_overs: number | null
          scoring_locked: boolean
          status: string
          target_method: string | null
          team_a_id: string
          team_b_id: string
          title: string | null
          toss_decision: string | null
          toss_winner_id: string | null
          tournament_id: string | null
          wickets_per_innings: number
          winner_id: string | null
        }
        Insert: {
          allow_no_balls?: boolean
          allow_wides?: boolean
          assigned_scorer_id?: string | null
          balls_per_over?: number
          bracket_round?: number | null
          bracket_slot?: number | null
          competition_stage?: string
          created_at?: string
          ground?: string | null
          id?: string
          interruption_notes?: string | null
          is_public?: boolean
          last_man_stands?: boolean
          match_date?: string | null
          match_number?: number | null
          match_scope?: string
          match_time?: string | null
          match_type?: string
          organizer_id?: string | null
          overs_per_match?: number
          player_of_match_id?: string | null
          player_of_match_summary?: string | null
          result_type?: string | null
          revised_overs?: number | null
          scoring_locked?: boolean
          status?: string
          target_method?: string | null
          team_a_id: string
          team_b_id: string
          title?: string | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id?: string | null
          wickets_per_innings?: number
          winner_id?: string | null
        }
        Update: {
          allow_no_balls?: boolean
          allow_wides?: boolean
          assigned_scorer_id?: string | null
          balls_per_over?: number
          bracket_round?: number | null
          bracket_slot?: number | null
          competition_stage?: string
          created_at?: string
          ground?: string | null
          id?: string
          interruption_notes?: string | null
          is_public?: boolean
          last_man_stands?: boolean
          match_date?: string | null
          match_number?: number | null
          match_scope?: string
          match_time?: string | null
          match_type?: string
          organizer_id?: string | null
          overs_per_match?: number
          player_of_match_id?: string | null
          player_of_match_summary?: string | null
          result_type?: string | null
          revised_overs?: number | null
          scoring_locked?: boolean
          status?: string
          target_method?: string | null
          team_a_id?: string
          team_b_id?: string
          title?: string | null
          toss_decision?: string | null
          toss_winner_id?: string | null
          tournament_id?: string | null
          wickets_per_innings?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_assigned_scorer_id_fkey"
            columns: ["assigned_scorer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player_of_match_id_fkey"
            columns: ["player_of_match_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_toss_winner_id_fkey"
            columns: ["toss_winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_registrations: {
        Row: {
          batting_style: string
          bowling_style: string
          consent_given: boolean
          contact_number: string
          contact_number_normalized: string | null
          created_at: string
          id: string
          jersey_name: string
          jersey_number: number
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          preferred_team_id: string | null
          registration_number: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tournament_id: string
          tracking_code: string
        }
        Insert: {
          batting_style: string
          bowling_style: string
          consent_given: boolean
          contact_number: string
          contact_number_normalized?: string | null
          created_at?: string
          id?: string
          jersey_name: string
          jersey_number: number
          photo_url: string
          player_card_url?: string | null
          player_id?: string | null
          player_name: string
          playing_role: string
          preferred_team_id?: string | null
          registration_number?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tournament_id: string
          tracking_code?: string
        }
        Update: {
          batting_style?: string
          bowling_style?: string
          consent_given?: boolean
          contact_number?: string
          contact_number_normalized?: string | null
          created_at?: string
          id?: string
          jersey_name?: string
          jersey_number?: number
          photo_url?: string
          player_card_url?: string | null
          player_id?: string | null
          player_name?: string
          playing_role?: string
          preferred_team_id?: string | null
          registration_number?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tournament_id?: string
          tracking_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_registrations_preferred_team_id_fkey"
            columns: ["preferred_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          balls_bowled: number
          balls_faced: number
          fifties: number
          fours: number
          hundreds: number
          id: string
          matches: number
          motm_awards: number
          player_id: string
          runs: number
          runs_conceded: number
          sixes: number
          updated_at: string
          wickets: number
        }
        Insert: {
          balls_bowled?: number
          balls_faced?: number
          fifties?: number
          fours?: number
          hundreds?: number
          id?: string
          matches?: number
          motm_awards?: number
          player_id: string
          runs?: number
          runs_conceded?: number
          sixes?: number
          updated_at?: string
          wickets?: number
        }
        Update: {
          balls_bowled?: number
          balls_faced?: number
          fifties?: number
          fours?: number
          hundreds?: number
          id?: string
          matches?: number
          motm_awards?: number
          player_id?: string
          runs?: number
          runs_conceded?: number
          sixes?: number
          updated_at?: string
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          batting_style: string | null
          bowling_style: string | null
          contact_number: string | null
          created_at: string
          deleted_at: string | null
          id: string
          jersey_name: string | null
          jersey_number: number | null
          name: string
          phone_number: string | null
          photo_url: string | null
          player_name: string
          playing_role: string | null
          role: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          batting_style?: string | null
          bowling_style?: string | null
          contact_number?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          jersey_name?: string | null
          jersey_number?: number | null
          name: string
          phone_number?: string | null
          photo_url?: string | null
          player_name: string
          playing_role?: string | null
          role: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          batting_style?: string | null
          bowling_style?: string | null
          contact_number?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          jersey_name?: string | null
          jersey_number?: number | null
          name?: string
          phone_number?: string | null
          photo_url?: string | null
          player_name?: string
          playing_role?: string | null
          role?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      playing_xi: {
        Row: {
          created_at: string
          id: string
          is_playing: boolean
          jersey_number: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_playing?: boolean
          jersey_number?: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_playing?: boolean
          jersey_number?: number | null
          match_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playing_xi_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playing_xi_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playing_xi_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      points_table: {
        Row: {
          id: string
          lost: number
          no_result: number
          nrr: number
          played: number
          points: number
          rank: number
          team_id: string
          tied: number
          tournament_id: string
          won: number
        }
        Insert: {
          id?: string
          lost?: number
          no_result?: number
          nrr?: number
          played?: number
          points?: number
          rank?: number
          team_id: string
          tied?: number
          tournament_id: string
          won?: number
        }
        Update: {
          id?: string
          lost?: number
          no_result?: number
          nrr?: number
          played?: number
          points?: number
          rank?: number
          team_id?: string
          tied?: number
          tournament_id?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "points_table_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_table_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scoring_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          ball_id: string | null
          before_data: Json | null
          client_event_id: string | null
          created_at: string
          id: string
          innings_id: string | null
          match_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          ball_id?: string | null
          before_data?: Json | null
          client_event_id?: string | null
          created_at?: string
          id?: string
          innings_id?: string | null
          match_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          ball_id?: string | null
          before_data?: Json | null
          client_event_id?: string | null
          created_at?: string
          id?: string
          innings_id?: string | null
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoring_audit_log_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_audit_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          contact_number: string | null
          created_at: string
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          organizer_id: string | null
          owner_name: string | null
          owner_phone: string | null
          primary_color: string | null
          team_name: string
          tournament_id: string | null
          updated_at: string | null
        }
        Insert: {
          contact_number?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          organizer_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          team_name: string
          tournament_id?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_number?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          organizer_id?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          primary_color?: string | null
          team_name?: string
          tournament_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_card_templates: {
        Row: {
          player_template_id: string | null
          team_player_template_id: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          player_template_id?: string | null
          team_player_template_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          player_template_id?: string | null
          team_player_template_id?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_card_templates_player_template_id_fkey"
            columns: ["player_template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_card_templates_team_player_template_id_fkey"
            columns: ["team_player_template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_card_templates_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          id: string
          joined_at: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          team_id: string
          tournament_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          ball_type: string | null
          club_id: string | null
          created_at: string
          deleted_at: string | null
          end_date: string
          id: string
          logo_url: string | null
          max_teams: number
          name: string
          organizer_id: string
          overs: number | null
          overs_per_match: number
          player_registration_enabled: boolean
          players_per_team: number
          season_id: string | null
          start_date: string
          status: string
          tournament_name: string
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          banner_url?: string | null
          ball_type?: string | null
          club_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date: string
          id?: string
          logo_url?: string | null
          max_teams?: number
          name: string
          organizer_id: string
          overs?: number | null
          overs_per_match?: number
          player_registration_enabled?: boolean
          players_per_team?: number
          season_id?: string | null
          start_date: string
          status?: string
          tournament_name: string
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          banner_url?: string | null
          ball_type?: string | null
          club_id?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          id?: string
          logo_url?: string | null
          max_teams?: number
          name?: string
          organizer_id?: string
          overs?: number | null
          overs_per_match?: number
          player_registration_enabled?: boolean
          players_per_team?: number
          season_id?: string | null
          start_date?: string
          status?: string
          tournament_name?: string
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "club_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_tournament_cascade: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      hide_tournament: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      unhide_tournament: {
        Args: { p_tournament_id: string }
        Returns: Json
      }
      consume_registration_lookup_attempt: {
        Args: {
          p_identifier_hash: string
          p_max_attempts?: number
          p_window?: string
        }
        Returns: boolean
      }
      create_bulk_auction_players: {
        Args: { p_players: Json; p_tournament_id: string }
        Returns: {
          batting_style: string
          bowling_style: string
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_registration_card_payload: {
        Args: { p_registration_id: string; p_tracking_code: string }
        Returns: {
          batting_style: string
          bowling_style: string
          contact_number: string
          photo_url: string
          player_name: string
          playing_role: string
          registration_id: string
          registration_number: number
          template_layout: Json
          template_url: string
          tournament_id: string
        }[]
      }
      mark_auction_player_unsold: {
        Args: { p_auction_player_id: string }
        Returns: {
          batting_style: string
          bowling_style: string
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_scoring_delivery: {
        Args: {
          p_ball: Json
          p_innings_complete?: boolean
          p_next_non_striker_id: string
          p_next_striker_id: string
        }
        Returns: Json
      }
      reopen_auction_player: {
        Args: { p_auction_player_id: string }
        Returns: {
          batting_style: string
          bowling_style: string
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_registration_card_url: {
        Args: {
          p_card_url: string
          p_registration_id: string
          p_tracking_code: string
        }
        Returns: boolean
      }
      sell_auction_player: {
        Args: {
          p_auction_player_id: string
          p_team_id: string
          p_winning_bid: number
        }
        Returns: {
          batting_style: string
          bowling_style: string
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_auction_player_live: {
        Args: { p_auction_player_id: string }
        Returns: {
          batting_style: string
          bowling_style: string
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_last_scoring_delivery: {
        Args: { p_innings_id: string }
        Returns: Json
      }
      update_bulk_auction_player_text: {
        Args: {
          p_auction_player_id: string
          p_contact_number?: string
          p_player_name: string
          p_playing_role: string
          p_registration_number?: number
        }
        Returns: {
          batting_style: string
          bowling_style: string
          contact_number: string | null
          created_at: string
          id: string
          ocr_serial_number: number | null
          photo_url: string
          player_card_url: string | null
          player_id: string | null
          player_name: string
          playing_role: string
          registration_id: string | null
          registration_number: number
          sold_at: string | null
          source_type: string
          status: string
          team_player_card_url: string | null
          tournament_id: string
          updated_at: string
          winning_bid: number | null
          winning_team_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "auction_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
