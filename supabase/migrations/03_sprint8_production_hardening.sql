-- Sprint 8 Production Hardening
-- 1. Create user_roles table & RBAC helper function
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'tournament_admin', 'scorer', 'viewer')),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tournament_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(role_name text, tourney_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- super_admin has access to everything
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- check specific role and tournament
  IF tourney_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = role_name 
        AND (tournament_id = tourney_id OR tournament_id IS NULL)
    );
  ELSE
    -- check if they have the role globally or for at least one tournament
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND role = role_name
    );
  END IF;
END;
$$;

-- 2. Drop Old RLS Policies
DROP POLICY IF EXISTS "Auth Write Tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Auth Write Teams" ON public.teams;
DROP POLICY IF EXISTS "Auth Write Players" ON public.players;
DROP POLICY IF EXISTS "Auth Write Matches" ON public.matches;
DROP POLICY IF EXISTS "Auth Write Innings" ON public.innings;
DROP POLICY IF EXISTS "Auth Write Ball By Ball" ON public.ball_by_ball;
DROP POLICY IF EXISTS "Auth Write Awards" ON public.awards;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

-- 3. Rewrite RLS Policies with RBAC
-- Tournaments
CREATE POLICY "Admin Write Tournaments" ON public.tournaments 
FOR ALL USING (has_role('super_admin'));

-- Teams
CREATE POLICY "Admin Write Teams" ON public.teams 
FOR ALL USING (has_role('super_admin') OR has_role('tournament_admin', tournament_id));

-- Players (tournament_id comes from teams)
CREATE POLICY "Admin Write Players" ON public.players 
FOR ALL USING (
  has_role('super_admin') OR 
  has_role('tournament_admin', (SELECT tournament_id FROM public.teams WHERE id = team_id))
);

-- Matches
CREATE POLICY "Admin/Scorer Write Matches" ON public.matches 
FOR ALL USING (
  has_role('super_admin') OR 
  has_role('tournament_admin', tournament_id) OR
  has_role('scorer', tournament_id)
);

-- Innings (match_id links to matches which links to tournament_id)
CREATE POLICY "Admin/Scorer Write Innings" ON public.innings 
FOR ALL USING (
  has_role('super_admin') OR 
  has_role('tournament_admin', (SELECT tournament_id FROM public.matches WHERE id = match_id)) OR
  has_role('scorer', (SELECT tournament_id FROM public.matches WHERE id = match_id))
);

-- Ball by Ball
CREATE POLICY "Admin/Scorer Write Ball By Ball" ON public.ball_by_ball 
FOR ALL USING (
  has_role('super_admin') OR 
  has_role('tournament_admin', (SELECT tournament_id FROM public.matches WHERE id = match_id)) OR
  has_role('scorer', (SELECT tournament_id FROM public.matches WHERE id = match_id))
);

-- Awards
CREATE POLICY "Admin Write Awards" ON public.awards 
FOR ALL USING (has_role('super_admin') OR has_role('tournament_admin', tournament_id));

-- Audit Logs (Only Super Admin)
CREATE POLICY "Super Admins can view audit logs" ON public.audit_logs 
FOR SELECT USING (has_role('super_admin'));
CREATE POLICY "Super Admins can insert audit logs" ON public.audit_logs 
FOR INSERT WITH CHECK (has_role('super_admin'));

-- 4. Add Missing Indexes
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON public.teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON public.matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_team1_id ON public.matches(team1_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2_id ON public.matches(team2_id);
CREATE INDEX IF NOT EXISTS idx_innings_match_id ON public.innings(match_id);
CREATE INDEX IF NOT EXISTS idx_ball_by_ball_match_id ON public.ball_by_ball(match_id);
CREATE INDEX IF NOT EXISTS idx_ball_by_ball_innings_id ON public.ball_by_ball(innings_id);
CREATE INDEX IF NOT EXISTS idx_awards_tournament_id ON public.awards(tournament_id);
CREATE INDEX IF NOT EXISTS idx_awards_player_id ON public.awards(player_id);

-- 5. Storage Fixes
INSERT INTO storage.buckets (id, name, public) VALUES 
('team-logos', 'team-logos', true),
('player-photos', 'player-photos', true),
('tournament-assets', 'tournament-assets', true),
('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Assuming table storage.objects is enabled for RLS (it is by default in Supabase)
CREATE POLICY "Public Read Storage" ON storage.objects FOR SELECT USING (bucket_id IN ('team-logos', 'player-photos', 'tournament-assets', 'posters'));
CREATE POLICY "Admin Write Storage" ON storage.objects FOR ALL USING (
  bucket_id IN ('team-logos', 'player-photos', 'tournament-assets', 'posters') 
  AND (has_role('super_admin') OR has_role('tournament_admin'))
);

-- 6. Add updated_at Triggers
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_tournaments_modtime BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_teams_modtime BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_players_modtime BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_matches_modtime BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 7. New Analytics Tables
CREATE TABLE IF NOT EXISTS public.player_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    matches_played INTEGER DEFAULT 0,
    runs_scored INTEGER DEFAULT 0,
    balls_faced INTEGER DEFAULT 0,
    hundreds INTEGER DEFAULT 0,
    fifties INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    wickets_taken INTEGER DEFAULT 0,
    balls_bowled INTEGER DEFAULT 0,
    runs_conceded INTEGER DEFAULT 0,
    maidens INTEGER DEFAULT 0,
    five_wicket_hauls INTEGER DEFAULT 0,
    best_bowling_figures VARCHAR(50),
    catches INTEGER DEFAULT 0,
    stumpings INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.points_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    matches_played INTEGER DEFAULT 0,
    won INTEGER DEFAULT 0,
    lost INTEGER DEFAULT 0,
    tied INTEGER DEFAULT 0,
    no_result INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    net_run_rate NUMERIC(5,3) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, team_id)
);

CREATE OR REPLACE TRIGGER update_player_statistics_modtime BEFORE UPDATE ON public.player_statistics FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_points_table_modtime BEFORE UPDATE ON public.points_table FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_player_statistics_tournament_id ON public.player_statistics(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_statistics_player_id ON public.player_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_points_table_tournament_id ON public.points_table(tournament_id);
CREATE INDEX IF NOT EXISTS idx_points_table_team_id ON public.points_table(team_id);

-- RLS for Analytics Tables
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Player Statistics" ON public.player_statistics FOR SELECT USING (true);
CREATE POLICY "Admin Write Player Statistics" ON public.player_statistics FOR ALL USING (has_role('super_admin') OR has_role('tournament_admin', tournament_id) OR has_role('scorer', tournament_id));

CREATE POLICY "Public Read Points Table" ON public.points_table FOR SELECT USING (true);
CREATE POLICY "Admin Write Points Table" ON public.points_table FOR ALL USING (has_role('super_admin') OR has_role('tournament_admin', tournament_id) OR has_role('scorer', tournament_id));
