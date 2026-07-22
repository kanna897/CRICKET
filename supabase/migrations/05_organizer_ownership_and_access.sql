-- Organizer ownership and Master Admin authorization for the existing schema.
-- Public read policies remain in place; all management writes are ownership-scoped.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'organizer';

UPDATE public.profiles
SET name = NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '')
WHERE name IS NULL;
UPDATE public.profiles SET name = '' WHERE name IS NULL;
UPDATE public.profiles AS p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;
ALTER TABLE public.profiles ALTER COLUMN name SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_application_role_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_application_role_check
      CHECK (role IN ('master_admin', 'organizer'));
  END IF;
END $$;

-- Preserve the configured Admin account and map it to the new application role.
UPDATE public.profiles AS p
SET role = 'master_admin'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.profile_id = p.id AND LOWER(r.name) IN ('admin', 'super_admin', 'master_admin')
);

CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, phone, name, email, phone_number, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'organizer_name', NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'phone_number', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'organizer_name', NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'phone_number', ''),
    'organizer'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    role = 'organizer';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.handle_new_auth_user();

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tournament_name TEXT,
  ADD COLUMN IF NOT EXISTS venue TEXT,
  ADD COLUMN IF NOT EXISTS ball_type TEXT,
  ADD COLUMN IF NOT EXISTS overs INTEGER,
  ADD COLUMN IF NOT EXISTS overs_per_match INTEGER,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

UPDATE public.tournaments SET organizer_id = owner_id WHERE organizer_id IS NULL AND owner_id IS NOT NULL;
UPDATE public.tournaments SET organizer_id = (
  SELECT p.id FROM public.profiles p WHERE p.role = 'master_admin' ORDER BY p.created_at LIMIT 1
) WHERE organizer_id IS NULL;
UPDATE public.tournaments SET tournament_name = name WHERE tournament_name IS NULL;
UPDATE public.tournaments SET overs = COALESCE(overs_per_innings, 20) WHERE overs IS NULL;
UPDATE public.tournaments SET overs_per_match = COALESCE(overs, overs_per_innings, 20) WHERE overs_per_match IS NULL;
ALTER TABLE public.tournaments ALTER COLUMN organizer_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer_id ON public.tournaments(organizer_id);

-- Compatibility ownership links used by the existing application screens.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;
UPDATE public.teams AS team SET tournament_id = COALESCE(
  (SELECT tt.tournament_id FROM public.tournament_teams tt WHERE tt.team_id = team.id ORDER BY tt.created_at LIMIT 1),
  (SELECT t.id FROM public.tournaments t WHERE t.organizer_id = team.owner_id ORDER BY t.created_at LIMIT 1)
) WHERE tournament_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_teams_tournament_id ON public.teams(tournament_id);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS playing_role TEXT;
UPDATE public.players AS player SET team_id = (
  SELECT tp.team_id FROM public.team_players tp WHERE tp.player_id = player.id ORDER BY tp.created_at LIMIT 1
) WHERE team_id IS NULL;
UPDATE public.players SET name = NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), '') WHERE name IS NULL;
UPDATE public.players SET playing_role = player_role WHERE playing_role IS NULL;
CREATE INDEX IF NOT EXISTS idx_players_team_id ON public.players(team_id);

CREATE OR REPLACE FUNCTION private.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'master_admin'
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_tournament(target_tournament_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT private.is_master_admin()) OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = target_tournament_id AND t.organizer_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_master_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_manage_tournament(UUID) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_master_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_tournament(UUID) TO authenticated;

-- Profiles: organizers see/update themselves; Master Admin can manage everyone.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_master_admin()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_master_admin()))
  WITH CHECK (((SELECT auth.uid()) = id AND role = 'organizer') OR (SELECT private.is_master_admin()));

-- Tournaments remain publicly readable, while writes require ownership or Master Admin.
DROP POLICY IF EXISTS "Users can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can update own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can delete own tournaments" ON public.tournaments;
CREATE POLICY "Organizers create tournaments" ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (organizer_id = (SELECT auth.uid()) OR (SELECT private.is_master_admin()));
CREATE POLICY "Organizers update own tournaments" ON public.tournaments FOR UPDATE TO authenticated
  USING (organizer_id = (SELECT auth.uid()) OR (SELECT private.is_master_admin()))
  WITH CHECK (organizer_id = (SELECT auth.uid()) OR (SELECT private.is_master_admin()));
CREATE POLICY "Organizers delete own tournaments" ON public.tournaments FOR DELETE TO authenticated
  USING (organizer_id = (SELECT auth.uid()) OR (SELECT private.is_master_admin()));

-- Remove the previous permissive authenticated team-management policies.
DROP POLICY IF EXISTS "Allow authenticated users to insert teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON public.teams;
CREATE POLICY "Owners manage teams" ON public.teams FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament(tournament_id)))
  WITH CHECK ((SELECT private.can_manage_tournament(tournament_id)));

DROP POLICY IF EXISTS "Users can create own players" ON public.players;
DROP POLICY IF EXISTS "Users can update own players" ON public.players;
DROP POLICY IF EXISTS "Users can delete own players" ON public.players;
DROP POLICY IF EXISTS "Players viewable by everyone" ON public.players;
CREATE POLICY "Players viewable by everyone" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners manage players" ON public.players FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament((SELECT t.tournament_id FROM public.teams t WHERE t.id = players.team_id))))
  WITH CHECK ((SELECT private.can_manage_tournament((SELECT t.tournament_id FROM public.teams t WHERE t.id = players.team_id))));

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_matches_insert" ON public.matches;
DROP POLICY IF EXISTS "admin_matches_update" ON public.matches;
DROP POLICY IF EXISTS "admin_matches_delete" ON public.matches;
CREATE POLICY "Owners manage matches" ON public.matches FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament(tournament_id)))
  WITH CHECK ((SELECT private.can_manage_tournament(tournament_id)));

CREATE POLICY "Owners manage innings" ON public.innings FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament((SELECT m.tournament_id FROM public.matches m WHERE m.id = innings.match_id))))
  WITH CHECK ((SELECT private.can_manage_tournament((SELECT m.tournament_id FROM public.matches m WHERE m.id = innings.match_id))));

CREATE POLICY "Owners manage ball by ball" ON public.ball_by_ball FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament((SELECT m.tournament_id FROM public.innings i JOIN public.matches m ON m.id = i.match_id WHERE i.id = ball_by_ball.innings_id))))
  WITH CHECK ((SELECT private.can_manage_tournament((SELECT m.tournament_id FROM public.innings i JOIN public.matches m ON m.id = i.match_id WHERE i.id = ball_by_ball.innings_id))));

CREATE POLICY "Owners manage points table" ON public.points_table FOR ALL TO authenticated
  USING ((SELECT private.can_manage_tournament(tournament_id)))
  WITH CHECK ((SELECT private.can_manage_tournament(tournament_id)));
