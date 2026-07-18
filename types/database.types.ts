export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          venue: string | null
          start_date: string | null
          ball_type: string | null
          overs: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tournaments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tournaments']['Insert']>
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          name: string
          logo_url: string | null
          owner_name: string | null
          contact_number: string | null
          captain_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      players: {
        Row: {
          id: string
          team_id: string | null
          name: string
          phone_number: string
          playing_role: string | null
          batting_style: string | null
          bowling_style: string | null
          photo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['players']['Insert']>
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          team1_id: string
          team2_id: string
          match_number: number | null
          status: string
          toss_winner_id: string | null
          toss_decision: string | null
          winner_id: string | null
          win_margin: string | null
          player_of_match_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      innings: {
        Row: {
          id: string
          match_id: string
          batting_team_id: string | null
          bowling_team_id: string | null
          innings_number: number
          total_runs: number
          total_wickets: number
          total_overs: number
          extras: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['innings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['innings']['Insert']>
      }
      ball_by_ball: {
        Row: {
          id: string
          match_id: string
          innings_id: string
          over_number: number
          ball_number: number
          bowler_id: string | null
          batsman_id: string | null
          non_striker_id: string | null
          runs_scored: number
          extras_type: string | null
          extras_runs: number
          wicket_type: string | null
          player_out_id: string | null
          fielder_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ball_by_ball']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ball_by_ball']['Insert']>
      }
      awards: {
        Row: {
          id: string
          tournament_id: string
          category: string
          player_id: string | null
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['awards']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['awards']['Insert']>
      }
    }
  }
}
