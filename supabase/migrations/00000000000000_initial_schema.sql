-- Initial Schema for CRICKPULSE

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tournaments
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    venue VARCHAR(255),
    start_date DATE,
    ball_type VARCHAR(50),
    overs INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'upcoming', -- upcoming, ongoing, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Teams
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    owner_name VARCHAR(255),
    contact_number VARCHAR(50),
    captain_id UUID, -- Will reference players(id) later
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Players
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL UNIQUE,
    playing_role VARCHAR(50), -- batsman, bowler, all_rounder, wicket_keeper
    batting_style VARCHAR(50), -- right_hand, left_hand
    bowling_style VARCHAR(50), -- right_arm_fast, left_arm_spin, etc
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for captain
ALTER TABLE teams ADD CONSTRAINT fk_captain FOREIGN KEY (captain_id) REFERENCES players(id) ON DELETE SET NULL;

-- 4. Matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team1_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    team2_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    match_number INTEGER,
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, toss_done, ongoing, completed, abandoned
    toss_winner_id UUID REFERENCES teams(id),
    toss_decision VARCHAR(20), -- bat, bowl
    winner_id UUID REFERENCES teams(id),
    win_margin VARCHAR(255),
    player_of_match_id UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Innings
CREATE TABLE innings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    batting_team_id UUID REFERENCES teams(id),
    bowling_team_id UUID REFERENCES teams(id),
    innings_number INTEGER NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_overs NUMERIC(5,2) DEFAULT 0.0,
    extras JSONB DEFAULT '{"wides": 0, "no_balls": 0, "byes": 0, "leg_byes": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Ball by Ball
CREATE TABLE ball_by_ball (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    innings_id UUID REFERENCES innings(id) ON DELETE CASCADE,
    over_number INTEGER NOT NULL,
    ball_number INTEGER NOT NULL,
    bowler_id UUID REFERENCES players(id),
    batsman_id UUID REFERENCES players(id),
    non_striker_id UUID REFERENCES players(id),
    runs_scored INTEGER DEFAULT 0,
    extras_type VARCHAR(20), -- wide, no_ball, bye, leg_bye
    extras_runs INTEGER DEFAULT 0,
    wicket_type VARCHAR(50), -- bowled, caught, lbw, run_out, stumped, etc
    player_out_id UUID REFERENCES players(id),
    fielder_id UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Awards
CREATE TABLE awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    category VARCHAR(255) NOT NULL, -- Orange Cap, Purple Cap, etc
    player_id UUID REFERENCES players(id),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('player_photos', 'player_photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true) ON CONFLICT DO NOTHING;

-- RLS Policies (Assuming Admin is authenticated via Supabase Auth)
-- For this MVP, we will allow read access to everyone, and write access to authenticated users.

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Auth Write Tournaments" ON tournaments FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Auth Write Teams" ON teams FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Players" ON players FOR SELECT USING (true);
CREATE POLICY "Auth Write Players" ON players FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Auth Write Matches" ON matches FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Innings" ON innings FOR SELECT USING (true);
CREATE POLICY "Auth Write Innings" ON innings FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE ball_by_ball ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Ball By Ball" ON ball_by_ball FOR SELECT USING (true);
CREATE POLICY "Auth Write Ball By Ball" ON ball_by_ball FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Awards" ON awards FOR SELECT USING (true);
CREATE POLICY "Auth Write Awards" ON awards FOR ALL USING (auth.role() = 'authenticated');

-- Enable Realtime for matches, innings, and ball_by_ball
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table innings;
alter publication supabase_realtime add table ball_by_ball;
