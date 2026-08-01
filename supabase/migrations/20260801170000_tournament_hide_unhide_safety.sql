-- Tournament lifecycle safety: hiding is reversible and never mutates child rows.
-- This migration also neutralizes the legacy hard-delete RPC and blocks direct
-- deletes at the database boundary.

alter table public.tournaments
  add column if not exists deleted_at timestamptz null;

create index if not exists tournaments_deleted_at_idx
  on public.tournaments (deleted_at);

create or replace function public.prevent_tournament_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Tournament deletion is disabled. Use Hide Tournament instead.';
end;
$$;

drop trigger if exists prevent_tournament_hard_delete on public.tournaments;
create trigger prevent_tournament_hard_delete
before delete on public.tournaments
for each row execute function public.prevent_tournament_hard_delete();

create or replace function public.delete_tournament_cascade(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Tournament deletion is disabled. Use Hide Tournament instead.';
end;
$$;

revoke all on function public.delete_tournament_cascade(uuid) from public, anon, authenticated;

create or replace function public.hide_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  tournament_row public.tournaments%rowtype;
  hidden_at timestamptz := now();
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.can_manage_tournament(p_tournament_id)) then
    raise exception 'You are not allowed to hide this tournament';
  end if;

  select * into tournament_row
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if tournament_row.deleted_at is not null then
    return jsonb_build_object('ok', true, 'changed', false, 'id', tournament_row.id, 'deleted_at', tournament_row.deleted_at);
  end if;

  update public.tournaments
  set deleted_at = hidden_at,
      updated_at = now()
  where id = p_tournament_id;

  begin
    insert into public.audit_logs (
      user_id, user_name, user_role, action, entity_type, entity_id,
      old_values, new_values, device_browser
    ) values (
      actor_id, 'Tournament lifecycle', 'authorized_manager',
      'Tournament Hidden', 'tournament', tournament_row.id,
      jsonb_build_object('name', tournament_row.name, 'deleted_at', tournament_row.deleted_at),
      jsonb_build_object('name', tournament_row.name, 'deleted_at', hidden_at),
      'database_rpc'
    );
  exception when others then
    raise warning 'tournament_hide_audit_failure tournament_id=% sqlstate=% message=%', p_tournament_id, sqlstate, sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'changed', true, 'id', tournament_row.id, 'deleted_at', hidden_at);
end;
$$;

create or replace function public.unhide_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  tournament_row public.tournaments%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.can_manage_tournament(p_tournament_id)) then
    raise exception 'You are not allowed to unhide this tournament';
  end if;

  select * into tournament_row
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if tournament_row.deleted_at is null then
    return jsonb_build_object('ok', true, 'changed', false, 'id', tournament_row.id, 'deleted_at', null);
  end if;

  update public.tournaments
  set deleted_at = null,
      updated_at = now()
  where id = p_tournament_id;

  begin
    insert into public.audit_logs (
      user_id, user_name, user_role, action, entity_type, entity_id,
      old_values, new_values, device_browser
    ) values (
      actor_id, 'Tournament lifecycle', 'authorized_manager',
      'Tournament Unhidden', 'tournament', tournament_row.id,
      jsonb_build_object('name', tournament_row.name, 'deleted_at', tournament_row.deleted_at),
      jsonb_build_object('name', tournament_row.name, 'deleted_at', null),
      'database_rpc'
    );
  exception when others then
    raise warning 'tournament_unhide_audit_failure tournament_id=% sqlstate=% message=%', p_tournament_id, sqlstate, sqlerrm;
  end;

  return jsonb_build_object('ok', true, 'changed', true, 'id', tournament_row.id, 'deleted_at', null);
end;
$$;

revoke all on function public.hide_tournament(uuid) from public, anon;
revoke all on function public.unhide_tournament(uuid) from public, anon;
grant execute on function public.hide_tournament(uuid) to authenticated;
grant execute on function public.unhide_tournament(uuid) to authenticated;

-- Table DELETE is no longer a supported client operation. UPDATE remains
-- available under the existing ownership policies for normal settings edits.
revoke delete on public.tournaments from authenticated;

-- Anonymous/public tournament reads must never expose hidden tournaments.
drop policy if exists "Auth Write Tournaments" on public.tournaments;
drop policy if exists "Public Read Tournaments" on public.tournaments;
drop policy if exists tournaments_read_public on public.tournaments;
create policy "Public Read Active Tournaments"
  on public.tournaments for select to anon, authenticated
  using (deleted_at is null);

-- Public tournament-owned records are visible only while their parent is active.
drop policy if exists "Public Read Teams" on public.teams;
drop policy if exists teams_read_public on public.teams;
create policy "Public Read Active Tournament Teams"
  on public.teams for select to anon, authenticated
  using (
    tournament_id is null
    or exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null)
    or exists (
      select 1 from public.tournament_teams tt
      join public.tournaments t on t.id = tt.tournament_id
      where tt.team_id = teams.id and t.deleted_at is null
    )
  );

drop policy if exists "Public Read Active Tournament Team Assignments" on public.tournament_teams;
drop policy if exists tournament_teams_read_public on public.tournament_teams;
create policy "Public Read Active Tournament Team Assignments"
  on public.tournament_teams for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Public Read Matches" on public.matches;
drop policy if exists matches_read_public on public.matches;
create policy "Public Read Active Tournament Matches"
  on public.matches for select to anon, authenticated
  using (
    tournament_id is null
    or exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null)
  );

drop policy if exists "Public Read Innings" on public.innings;
drop policy if exists innings_read_public on public.innings;
create policy "Public Read Active Tournament Innings"
  on public.innings for select to anon, authenticated
  using (
    exists (
      select 1 from public.matches m
      left join public.tournaments t on t.id = m.tournament_id
      where m.id = match_id and (m.tournament_id is null or t.deleted_at is null)
    )
  );

drop policy if exists "Public Read Ball By Ball" on public.ball_by_ball;
drop policy if exists ball_by_ball_read_public on public.ball_by_ball;
create policy "Public Read Active Tournament Deliveries"
  on public.ball_by_ball for select to anon, authenticated
  using (
    exists (
      select 1 from public.innings i
      join public.matches m on m.id = i.match_id
      left join public.tournaments t on t.id = m.tournament_id
      where i.id = innings_id and (m.tournament_id is null or t.deleted_at is null)
    )
  );

drop policy if exists "Public read match squads" on public.match_squads;
drop policy if exists match_squads_read_public on public.match_squads;
create policy "Public read active tournament match squads"
  on public.match_squads for select to anon, authenticated
  using (
    exists (
      select 1 from public.matches m
      left join public.tournaments t on t.id = m.tournament_id
      where m.id = match_id and (m.tournament_id is null or t.deleted_at is null)
    )
  );

drop policy if exists "Public Read Points Table" on public.points_table;
drop policy if exists points_table_read_public on public.points_table;
create policy "Public Read Active Tournament Points Table"
  on public.points_table for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Public Read Awards" on public.awards;
drop policy if exists awards_read_public on public.awards;
create policy "Public Read Active Tournament Awards"
  on public.awards for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Tournament template choices are public" on public.tournament_card_templates;
create policy "Active tournament template choices are public"
  on public.tournament_card_templates for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Auction sessions are public" on public.auction_sessions;
create policy "Active tournament auction sessions are public"
  on public.auction_sessions for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Auction purses are public" on public.auction_team_purses;
create policy "Active tournament auction purses are public"
  on public.auction_team_purses for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Auction players are public" on public.auction_players;
create policy "Active tournament auction players are public"
  on public.auction_players for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

drop policy if exists "Auction history is public" on public.auction_history;
create policy "Active tournament auction history is public"
  on public.auction_history for select to anon, authenticated
  using (exists (select 1 from public.tournaments t where t.id = tournament_id and t.deleted_at is null));

-- Keep the exact tables used by live scoring in the realtime publication.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['matches', 'innings', 'ball_by_ball'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end;
$$;
