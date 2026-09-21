-- Secure Permanent Tournament Deletion Migration
-- 
-- 1. Updates prevent_tournament_hard_delete trigger to guard direct client deletes
--    while allowing authorized deletion via the SECURITY DEFINER RPC.
-- 2. Defines delete_tournament_permanent(p_tournament_id) with strict authorization checks,
--    audit logging, complete foreign-key cascading order, and preservation of shared teams/players.
-- 3. Grants execute privilege strictly to authenticated users and blocks direct table deletes.

create or replace function public.prevent_tournament_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('crickpulse.allow_tournament_delete', true) = 'on' then
    return old;
  end if;
  raise exception 'Direct tournament deletion is disabled. Use the authorized deletion RPC instead.';
end;
$$;

drop trigger if exists prevent_tournament_hard_delete on public.tournaments;
create trigger prevent_tournament_hard_delete
before delete on public.tournaments
for each row execute function public.prevent_tournament_hard_delete();

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

  -- 1. Record Audit Log before data removal
  begin
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
  exception when others then
    raise warning 'tournament_delete_audit_failure tournament_id=% sqlstate=% message=%', p_tournament_id, sqlstate, sqlerrm;
  end;

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
  where match_id in (select id from public.matches where tournament_id = p_tournament_id)
     or innings_id in (
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
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.delete_tournament_permanent(p_tournament_id);
end;
$$;

revoke all on function public.delete_tournament_permanent(uuid) from public, anon;
revoke all on function public.delete_tournament_cascade(uuid) from public, anon;
grant execute on function public.delete_tournament_permanent(uuid) to authenticated;
grant execute on function public.delete_tournament_cascade(uuid) to authenticated;

revoke delete on public.tournaments from authenticated, anon, public;
