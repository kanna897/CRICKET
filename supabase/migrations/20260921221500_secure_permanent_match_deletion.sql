-- Secure Permanent Match Deletion Migration
-- 
-- Defines public.delete_match_permanent(p_match_id uuid) with strict authorization checks,
-- atomic audit logging, complete foreign-key cascading order, and preservation of shared teams/players.
-- Grants execute privilege strictly to authenticated users.

create or replace function public.delete_match_permanent(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  match_row public.matches%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not (select private.can_manage_match(p_match_id)) then
    raise exception 'You are not allowed to delete this match';
  end if;

  select * into match_row
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 1. Record Audit Log before data removal (atomic - failure rolls back transaction)
  insert into public.audit_logs (
    user_id, user_name, user_role, action, entity_type, entity_id,
    old_values, new_values, device_browser
  ) values (
    actor_id, 'Match lifecycle', 'authorized_manager',
    'Match Deleted', 'match', match_row.id,
    jsonb_build_object(
      'match_number', match_row.match_number,
      'title', match_row.title,
      'match_scope', match_row.match_scope,
      'match_type', match_row.match_type,
      'team_a_id', match_row.team_a_id,
      'team_b_id', match_row.team_b_id,
      'tournament_id', match_row.tournament_id,
      'status', match_row.status,
      'match_date', match_row.match_date,
      'ground', match_row.ground
    ),
    jsonb_build_object(
      'match_id', match_row.id,
      'deleted_permanently', true,
      'deleted_at', now()
    ),
    'database_rpc'
  );

  -- 2. Delete scoring audit logs for this match and its innings
  delete from public.scoring_audit_log
  where match_id = p_match_id
     or innings_id in (select id from public.innings where match_id = p_match_id);

  -- 3. Delete match events for this match and its innings
  delete from public.match_events
  where match_id = p_match_id
     or innings_id in (select id from public.innings where match_id = p_match_id);

  -- 4. Delete ball-by-ball records linked to this match's innings
  delete from public.ball_by_ball
  where innings_id in (
    select id
    from public.innings
    where match_id = p_match_id
  );

  -- 5. Delete batting scorecard records linked to this match's innings
  delete from public.batting_scorecard
  where innings_id in (
    select id
    from public.innings
    where match_id = p_match_id
  );

  -- 6. Delete bowling scorecard records linked to this match's innings
  delete from public.bowling_scorecard
  where innings_id in (
    select id
    from public.innings
    where match_id = p_match_id
  );

  -- 7. Delete match squads
  delete from public.match_squads
  where match_id = p_match_id;

  -- 8. Delete playing XI records
  delete from public.playing_xi
  where match_id = p_match_id;

  -- 9. Delete innings records for this match
  delete from public.innings
  where match_id = p_match_id;

  -- 10. Finally delete the match record itself
  delete from public.matches
  where id = p_match_id;

  return jsonb_build_object(
    'ok', true,
    'id', match_row.id
  );
end;
$$;

revoke all on function public.delete_match_permanent(uuid) from public, anon;
grant execute on function public.delete_match_permanent(uuid) to authenticated;
