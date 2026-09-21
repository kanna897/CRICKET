-- Fix Permanent Tournament Deletion: ball_by_ball innings_id relation
-- 
-- Replaces delete_tournament_permanent(p_tournament_id) with the corrected ball_by_ball
-- query that resolves via innings_id (foreign key) instead of non-existent match_id.
-- Preserves all security definer protections, RLS guards, authorization checks,
-- atomic audit logging, foreign-key cascade order, and reusable team/player preservation.

create or replace function public.delete_tournament_permanent(p_tournament_id uuid)
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
    raise exception 'You are not allowed to delete this tournament';
  end if;

  select * into tournament_row
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 1. Record Audit Log before data removal (atomic - failure rolls back transaction)
  insert into public.audit_logs (
    user_id, user_name, user_role, action, entity_type, entity_id,
    old_values, new_values, device_browser
  ) values (
    actor_id, 'Tournament lifecycle', 'authorized_manager',
    'Tournament Deleted', 'tournament', tournament_row.id,
    jsonb_build_object(
      'name', tournament_row.name,
      'deleted_at', tournament_row.deleted_at,
      'venue', tournament_row.venue,
      'status', tournament_row.status
    ),
    jsonb_build_object(
      'name', tournament_row.name,
      'deleted_permanently', true,
      'deleted_at', now()
    ),
    'database_rpc'
  );

  -- 2. Delete auction records in strict dependency order
  delete from public.auction_history where tournament_id = p_tournament_id;
  delete from public.auction_sessions where tournament_id = p_tournament_id;
  delete from public.auction_team_purses where tournament_id = p_tournament_id;
  delete from public.auction_players where tournament_id = p_tournament_id;

  -- 3. Delete tournament template associations
  delete from public.tournament_card_templates where tournament_id = p_tournament_id;

  -- 4. Delete player registrations for this tournament
  delete from public.player_registrations where tournament_id = p_tournament_id;

  -- 5. Delete points table standings
  delete from public.points_table where tournament_id = p_tournament_id;

  -- 6. Delete awards
  delete from public.awards where tournament_id = p_tournament_id;

  -- 7. Delete tournament registration counters (private schema)
  delete from private.tournament_registration_counters where tournament_id = p_tournament_id;

  -- 8. Delete user tournament scoped roles
  delete from public.user_roles where tournament_id = p_tournament_id;

  -- 9. Delete matches and all match-dependent child records
  delete from public.scoring_audit_log
  where match_id in (select id from public.matches where tournament_id = p_tournament_id)
     or innings_id in (
       select i.id from public.innings i
       join public.matches m on m.id = i.match_id
       where m.tournament_id = p_tournament_id
     );

  delete from public.match_events
  where match_id in (select id from public.matches where tournament_id = p_tournament_id)
     or innings_id in (
       select i.id from public.innings i
       join public.matches m on m.id = i.match_id
       where m.tournament_id = p_tournament_id
     );

  delete from public.ball_by_ball
  where innings_id in (
    select i.id from public.innings i
    join public.matches m on m.id = i.match_id
    where m.tournament_id = p_tournament_id
  );

  delete from public.batting_scorecard
  where innings_id in (
    select i.id from public.innings i
    join public.matches m on m.id = i.match_id
    where m.tournament_id = p_tournament_id
  );

  delete from public.bowling_scorecard
  where innings_id in (
    select i.id from public.innings i
    join public.matches m on m.id = i.match_id
    where m.tournament_id = p_tournament_id
  );

  delete from public.match_squads
  where match_id in (select id from public.matches where tournament_id = p_tournament_id);

  delete from public.playing_xi
  where match_id in (select id from public.matches where tournament_id = p_tournament_id);

  delete from public.innings
  where match_id in (select id from public.matches where tournament_id = p_tournament_id);

  delete from public.matches
  where tournament_id = p_tournament_id;

  -- 10. Delete tournament-team relationship records
  delete from public.tournament_teams where tournament_id = p_tournament_id;

  -- 11. Preserve reusable teams: unlink tournament_id so team profiles and players remain intact
  update public.teams
  set tournament_id = null
  where tournament_id = p_tournament_id;

  -- 12. Delete tournament record itself under authorized transaction context
  perform set_config('crickpulse.allow_tournament_delete', 'on', true);
  delete from public.tournaments where id = p_tournament_id;

  return jsonb_build_object(
    'ok', true,
    'id', tournament_row.id,
    'name', tournament_row.name
  );
end;
$$;

create or replace function public.delete_tournament_cascade(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.delete_tournament_permanent(p_tournament_id);
  return coalesce((result->>'ok')::boolean, false);
end;
$$;

revoke all on function public.delete_tournament_permanent(uuid) from public, anon;
revoke all on function public.delete_tournament_cascade(uuid) from public, anon;
grant execute on function public.delete_tournament_permanent(uuid) to authenticated;
grant execute on function public.delete_tournament_cascade(uuid) to authenticated;

revoke delete on public.tournaments from authenticated, anon, public;
