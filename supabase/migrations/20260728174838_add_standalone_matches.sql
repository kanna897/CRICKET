-- Standalone matches share the existing scoring engine with tournament matches.
-- Ownership is stored directly on teams and matches so nullable tournament_id
-- never weakens the authorization boundary.

alter table public.teams
  add column if not exists organizer_id uuid references auth.users(id) on delete restrict;

update public.teams team
set organizer_id = tournament.organizer_id
from public.tournaments tournament
where tournament.id = team.tournament_id
  and team.organizer_id is null;

alter table public.matches
  add column if not exists organizer_id uuid references auth.users(id) on delete restrict,
  add column if not exists match_scope text not null default 'tournament',
  add column if not exists match_type text not null default 'tournament',
  add column if not exists title text,
  add column if not exists is_public boolean not null default true;

update public.matches m
set organizer_id = tournament.organizer_id
from public.tournaments tournament
where tournament.id = m.tournament_id
  and m.organizer_id is null;

update public.matches
set match_scope = case when tournament_id is null then 'standalone' else 'tournament' end,
    match_type = case when tournament_id is null then 'friendly' else 'tournament' end;

alter table public.matches
  drop constraint if exists matches_match_scope_check,
  drop constraint if exists matches_match_type_check,
  drop constraint if exists matches_scope_owner_check,
  add constraint matches_match_scope_check
    check (match_scope in ('tournament', 'standalone')),
  add constraint matches_match_type_check
    check (match_type in ('tournament', 'friendly', 'school', 'club', 'exhibition', 'practice')),
  add constraint matches_scope_owner_check check (
    (match_scope = 'tournament' and tournament_id is not null and match_type = 'tournament')
    or
    (match_scope = 'standalone' and tournament_id is null and match_type <> 'tournament')
  );

create index if not exists idx_teams_organizer_id on public.teams(organizer_id);
create index if not exists idx_matches_organizer_id on public.matches(organizer_id);
create index if not exists idx_matches_scope_type on public.matches(match_scope, match_type);

create or replace function private.can_manage_team(target_team_id uuid)
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
      from public.teams team
      left join public.tournaments tournament on tournament.id = team.tournament_id
      where team.id = target_team_id
        and coalesce(team.organizer_id, tournament.organizer_id) = (select auth.uid())
    );
$$;

create or replace function private.can_manage_match(target_match_id uuid)
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
      from public.matches m
      left join public.tournaments tournament on tournament.id = m.tournament_id
      where m.id = target_match_id
        and coalesce(m.organizer_id, tournament.organizer_id) = (select auth.uid())
    );
$$;

create or replace function private.can_score_match(target_match_id uuid)
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
      from public.matches m
      left join public.tournaments tournament on tournament.id = m.tournament_id
      where m.id = target_match_id
        and (
          m.assigned_scorer_id = (select auth.uid())
          or (
            not m.scoring_locked
            and coalesce(m.organizer_id, tournament.organizer_id) = (select auth.uid())
          )
        )
    );
$$;

revoke all on function private.can_manage_team(uuid) from public;
revoke all on function private.can_manage_match(uuid) from public;
revoke all on function private.can_score_match(uuid) from public;
grant execute on function private.can_manage_team(uuid) to authenticated;
grant execute on function private.can_manage_match(uuid) to authenticated;
grant execute on function private.can_score_match(uuid) to authenticated;

drop policy if exists "Owners manage teams" on public.teams;
create policy "Owners manage teams"
  on public.teams for all to authenticated
  using (
    (select private.is_master_admin())
    or organizer_id = (select auth.uid())
    or (select private.can_manage_tournament(tournament_id))
  )
  with check (
    (select private.is_master_admin())
    or organizer_id = (select auth.uid())
    or (select private.can_manage_tournament(tournament_id))
  );

drop policy if exists "Owners manage players" on public.players;
create policy "Owners manage players"
  on public.players for all to authenticated
  using ((select private.can_manage_team(team_id)))
  with check ((select private.can_manage_team(team_id)));

drop policy if exists "Owners manage matches" on public.matches;
create policy "Owners manage matches"
  on public.matches for all to authenticated
  using ((select private.can_manage_match(id)))
  with check (
    (select private.is_master_admin())
    or organizer_id = (select auth.uid())
    or (select private.can_manage_tournament(tournament_id))
  );

drop policy if exists "Owners manage match squads" on public.match_squads;
create policy "Owners manage match squads"
  on public.match_squads for all to authenticated
  using ((select private.can_manage_match(match_id)))
  with check (
    (select private.can_manage_match(match_id))
    and (select private.can_manage_team(team_id))
  );

drop policy if exists "Owners manage playing xi" on public.playing_xi;
create policy "Owners manage playing xi"
  on public.playing_xi for all to authenticated
  using ((select private.can_score_match(match_id)))
  with check ((select private.can_score_match(match_id)));

drop policy if exists "Owners manage batting scorecard" on public.batting_scorecard;
create policy "Owners manage batting scorecard"
  on public.batting_scorecard for all to authenticated
  using ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = batting_scorecard.innings_id
  ))))
  with check ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = batting_scorecard.innings_id
  ))));

drop policy if exists "Owners manage bowling scorecard" on public.bowling_scorecard;
create policy "Owners manage bowling scorecard"
  on public.bowling_scorecard for all to authenticated
  using ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = bowling_scorecard.innings_id
  ))))
  with check ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = bowling_scorecard.innings_id
  ))));

-- Standalone matches use the same scorer policies introduced for tournament
-- matches; recreating them documents and guarantees that behavior.
drop policy if exists "Authorized scorers manage innings" on public.innings;
create policy "Authorized scorers manage innings"
  on public.innings for all to authenticated
  using ((select private.can_score_match(match_id)))
  with check ((select private.can_score_match(match_id)));

drop policy if exists "Authorized scorers manage ball by ball" on public.ball_by_ball;
create policy "Authorized scorers manage ball by ball"
  on public.ball_by_ball for all to authenticated
  using ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = ball_by_ball.innings_id
  ))))
  with check ((select private.can_score_match((
    select innings.match_id
    from public.innings innings
    where innings.id = ball_by_ball.innings_id
  ))));

drop policy if exists "Authorized scorers manage match events" on public.match_events;
create policy "Authorized scorers manage match events"
  on public.match_events for all to authenticated
  using ((select private.can_score_match(match_id)))
  with check ((select private.can_score_match(match_id)));
