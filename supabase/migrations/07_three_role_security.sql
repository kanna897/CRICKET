-- CrickPulse three-role model:
--   master_admin        full platform management and scoring
--   organizer           owns tournaments and scores their matches
--   public viewer       unauthenticated, read-only access through anon

create schema if not exists private;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_application_role_check;
update public.profiles set role = 'master_admin' where role = 'admin';
update public.profiles set role = 'organizer' where role in ('scorer', 'viewer');
alter table public.profiles alter column role set default 'organizer';
alter table public.profiles
  add constraint profiles_application_role_check
  check (role in ('master_admin', 'organizer'));

alter table public.tournaments
  add column if not exists organizer_id uuid references auth.users(id) on delete restrict;

update public.tournaments
set organizer_id = (
  select id from public.profiles
  where role = 'master_admin'
  order by created_at
  limit 1
)
where organizer_id is null;

alter table public.tournaments alter column organizer_id set not null;
create index if not exists idx_tournaments_organizer_id on public.tournaments(organizer_id);
create index if not exists idx_teams_tournament_id on public.teams(tournament_id);
create index if not exists idx_players_team_id on public.players(team_id);
create index if not exists idx_matches_tournament_id on public.matches(tournament_id);
create index if not exists idx_innings_match_id on public.innings(match_id);
create index if not exists idx_ball_by_ball_innings_id on public.ball_by_ball(innings_id);

create or replace function private.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'master_admin'
  );
$$;

create or replace function private.can_manage_tournament(target_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_master_admin())
    or exists (
      select 1
      from public.tournaments t
      where t.id = target_tournament_id
        and t.organizer_id = (select auth.uid())
    );
$$;

revoke all on function private.is_master_admin() from public;
revoke all on function private.can_manage_tournament(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_master_admin() to authenticated;
grant execute on function private.can_manage_tournament(uuid) to authenticated;

-- Every newly authenticated account is an organizer. Public viewers do not need
-- an account and remain the anon role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'organizer_name', ''),
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    'organizer'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

-- Profiles
drop policy if exists profiles_read_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists "Users view own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users view own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_master_admin()));
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select private.is_master_admin()))
  with check (
    ((select auth.uid()) = id and role = 'organizer')
    or (select private.is_master_admin())
  );

-- Remove legacy broad admin/service policies. The service role bypasses RLS and
-- does not need auth.role()-based policies.
drop policy if exists tournaments_insert_admin on public.tournaments;
drop policy if exists tournaments_write_service on public.tournaments;
drop policy if exists teams_insert_admin on public.teams;
drop policy if exists teams_write_service on public.teams;
drop policy if exists players_insert_admin on public.players;
drop policy if exists players_update_admin on public.players;
drop policy if exists players_write_service on public.players;
drop policy if exists matches_write_admin on public.matches;
drop policy if exists matches_write_service on public.matches;
drop policy if exists innings_write_admin on public.innings;
drop policy if exists innings_write_service on public.innings;
drop policy if exists ball_by_ball_write_admin on public.ball_by_ball;
drop policy if exists ball_by_ball_write_service on public.ball_by_ball;
drop policy if exists match_squads_write_admin on public.match_squads;
drop policy if exists match_events_write_service on public.match_events;
drop policy if exists tournament_teams_write_service on public.tournament_teams;
drop policy if exists playing_xi_write_service on public.playing_xi;
drop policy if exists points_table_write_service on public.points_table;
drop policy if exists batting_scorecard_write_service on public.batting_scorecard;
drop policy if exists bowling_scorecard_write_service on public.bowling_scorecard;
drop policy if exists player_stats_write_service on public.player_stats;

drop policy if exists "Owners manage tournaments" on public.tournaments;
create policy "Owners manage tournaments"
  on public.tournaments for all to authenticated
  using ((select private.can_manage_tournament(id)))
  with check (organizer_id = (select auth.uid()) or (select private.is_master_admin()));

drop policy if exists "Owners manage teams" on public.teams;
create policy "Owners manage teams"
  on public.teams for all to authenticated
  using ((select private.can_manage_tournament(tournament_id)))
  with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Owners manage players" on public.players;
create policy "Owners manage players"
  on public.players for all to authenticated
  using ((select private.can_manage_tournament((
    select t.tournament_id from public.teams t where t.id = players.team_id
  ))))
  with check ((select private.can_manage_tournament((
    select t.tournament_id from public.teams t where t.id = players.team_id
  ))));

drop policy if exists "Owners manage matches" on public.matches;
create policy "Owners manage matches"
  on public.matches for all to authenticated
  using ((select private.can_manage_tournament(tournament_id)))
  with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Owners manage innings" on public.innings;
create policy "Owners manage innings"
  on public.innings for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = innings.match_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = innings.match_id
  ))));

drop policy if exists "Owners manage ball by ball" on public.ball_by_ball;
create policy "Owners manage ball by ball"
  on public.ball_by_ball for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i
    join public.matches m on m.id = i.match_id
    where i.id = ball_by_ball.innings_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i
    join public.matches m on m.id = i.match_id
    where i.id = ball_by_ball.innings_id
  ))));

drop policy if exists "Owners manage match squads" on public.match_squads;
create policy "Owners manage match squads"
  on public.match_squads for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = match_squads.match_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = match_squads.match_id
  ))));

drop policy if exists "Owners manage match events" on public.match_events;
create policy "Owners manage match events"
  on public.match_events for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = match_events.match_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = match_events.match_id
  ))));

drop policy if exists "Owners manage tournament teams" on public.tournament_teams;
create policy "Owners manage tournament teams"
  on public.tournament_teams for all to authenticated
  using ((select private.can_manage_tournament(tournament_id)))
  with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Owners manage playing xi" on public.playing_xi;
create policy "Owners manage playing xi"
  on public.playing_xi for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = playing_xi.match_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m where m.id = playing_xi.match_id
  ))));

drop policy if exists "Owners manage points table" on public.points_table;
create policy "Owners manage points table"
  on public.points_table for all to authenticated
  using ((select private.can_manage_tournament(tournament_id)))
  with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Owners manage awards" on public.awards;
create policy "Owners manage awards"
  on public.awards for all to authenticated
  using ((select private.can_manage_tournament(tournament_id)))
  with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Owners manage batting scorecard" on public.batting_scorecard;
create policy "Owners manage batting scorecard"
  on public.batting_scorecard for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i join public.matches m on m.id = i.match_id
    where i.id = batting_scorecard.innings_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i join public.matches m on m.id = i.match_id
    where i.id = batting_scorecard.innings_id
  ))));

drop policy if exists "Owners manage bowling scorecard" on public.bowling_scorecard;
create policy "Owners manage bowling scorecard"
  on public.bowling_scorecard for all to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i join public.matches m on m.id = i.match_id
    where i.id = bowling_scorecard.innings_id
  ))))
  with check ((select private.can_manage_tournament((
    select m.tournament_id
    from public.innings i join public.matches m on m.id = i.match_id
    where i.id = bowling_scorecard.innings_id
  ))));

drop policy if exists "Owners manage player stats" on public.player_stats;
create policy "Owners manage player stats"
  on public.player_stats for all to authenticated
  using ((select private.can_manage_tournament((
    select t.tournament_id
    from public.players p
    join public.teams t on t.id = p.team_id
    where p.id = player_stats.player_id
  ))))
  with check ((select private.can_manage_tournament((
    select t.tournament_id
    from public.players p
    join public.teams t on t.id = p.team_id
    where p.id = player_stats.player_id
  ))));

-- Public viewers receive only read grants; authenticated organizer accounts
-- receive the grants required for the ownership-scoped policies above.
grant select on public.tournaments, public.teams, public.players, public.matches,
  public.innings, public.ball_by_ball, public.match_squads, public.match_events,
  public.tournament_teams, public.playing_xi, public.points_table,
  public.batting_scorecard, public.bowling_scorecard, public.player_stats,
  public.awards to anon;

grant select, insert, update, delete on public.tournaments, public.teams,
  public.players, public.matches, public.innings, public.ball_by_ball,
  public.match_squads, public.match_events, public.tournament_teams,
  public.playing_xi, public.points_table, public.batting_scorecard,
  public.bowling_scorecard, public.player_stats, public.awards to authenticated;

revoke insert, update, delete on public.tournaments, public.teams, public.players,
  public.matches, public.innings, public.ball_by_ball, public.match_squads,
  public.match_events, public.tournament_teams, public.playing_xi,
  public.points_table, public.batting_scorecard, public.bowling_scorecard,
  public.player_stats, public.awards from anon;
