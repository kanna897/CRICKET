-- Record one delivery and update its innings in a single transaction.
-- The function is SECURITY INVOKER, so existing RLS remains authoritative.

alter table public.ball_by_ball
  drop constraint if exists ball_by_ball_dismissal_type_check;

alter table public.ball_by_ball
  add constraint ball_by_ball_dismissal_type_check
  check (
    dismissal_type is null
    or dismissal_type in (
      'bowled', 'caught', 'caught_and_bowled', 'lbw', 'run_out',
      'stumped', 'hit_wicket', 'obstructing_field', 'timed_out',
      'retired_out'
    )
  );

create or replace function public.record_scoring_delivery(
  p_ball jsonb,
  p_next_striker_id uuid,
  p_next_non_striker_id uuid,
  p_innings_complete boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_innings public.innings%rowtype;
  v_match public.matches%rowtype;
  v_ball public.ball_by_ball%rowtype;
  v_existing public.ball_by_ball%rowtype;
  v_client_event_id uuid;
  v_innings_id uuid;
  v_runs integer;
  v_extras integer;
  v_is_legal boolean;
  v_is_wicket boolean;
  v_next_balls integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  v_innings_id := (p_ball ->> 'innings_id')::uuid;
  v_client_event_id := (p_ball ->> 'client_event_id')::uuid;

  select * into v_innings
  from public.innings
  where id = v_innings_id
  for update;

  if not found then
    raise exception 'Innings not found.' using errcode = 'P0002';
  end if;

  select * into v_match
  from public.matches
  where id = v_innings.match_id;

  if not (select private.can_score_match(v_innings.match_id)) then
    raise exception 'You are not authorized to score this match.' using errcode = '42501';
  end if;

  select * into v_existing
  from public.ball_by_ball
  where client_event_id = v_client_event_id;

  if found then
    return jsonb_build_object(
      'ball', to_jsonb(v_existing),
      'innings', to_jsonb(v_innings),
      'duplicate', true
    );
  end if;

  if v_innings.is_completed or v_match.status = 'completed' then
    raise exception 'The innings is already completed.' using errcode = '23514';
  end if;

  v_runs := coalesce((p_ball ->> 'runs')::integer, 0);
  v_extras := coalesce((p_ball ->> 'extras')::integer, 0);
  v_is_legal := coalesce((p_ball ->> 'is_legal')::boolean, true);
  v_is_wicket := coalesce((p_ball ->> 'is_wicket')::boolean, false);

  if v_runs < 0 or v_extras < 0 or v_runs > 6 or v_extras > 7 then
    raise exception 'Invalid delivery runs.' using errcode = '22023';
  end if;

  if (p_ball ->> 'over_number')::integer <> floor(v_innings.balls_bowled / 6.0)::integer + 1
    or (p_ball ->> 'ball_number')::integer <> (v_innings.balls_bowled % 6) + 1 then
    raise exception 'Delivery sequence is stale. Refresh the live score.' using errcode = '40001';
  end if;

  insert into public.ball_by_ball (
    client_event_id, innings_id, over_number, ball_number,
    batsman_id, non_striker_id, bowler_id, runs, extras, extras_type,
    is_legal, is_wicket, dismissal_type, player_out_id, fielder_id,
    commentary, recorded_by
  )
  values (
    v_client_event_id,
    v_innings_id,
    (p_ball ->> 'over_number')::integer,
    (p_ball ->> 'ball_number')::integer,
    nullif(p_ball ->> 'batsman_id', '')::uuid,
    nullif(p_ball ->> 'non_striker_id', '')::uuid,
    nullif(p_ball ->> 'bowler_id', '')::uuid,
    v_runs,
    v_extras,
    nullif(p_ball ->> 'extras_type', ''),
    v_is_legal,
    v_is_wicket,
    nullif(p_ball ->> 'dismissal_type', ''),
    nullif(p_ball ->> 'player_out_id', '')::uuid,
    nullif(p_ball ->> 'fielder_id', '')::uuid,
    nullif(p_ball ->> 'commentary', ''),
    (select auth.uid())
  )
  returning * into v_ball;

  v_next_balls := v_innings.balls_bowled + case when v_is_legal then 1 else 0 end;

  update public.innings
  set
    total_runs = total_runs + v_runs + v_extras,
    total_wickets = total_wickets + case when v_is_wicket then 1 else 0 end,
    balls_bowled = v_next_balls,
    extras = extras + v_extras,
    overs_completed = (floor(v_next_balls / 6.0)::text || '.' || (v_next_balls % 6)::text)::numeric,
    is_completed = p_innings_complete,
    striker_id = p_next_striker_id,
    non_striker_id = p_next_non_striker_id
  where id = v_innings_id
  returning * into v_innings;

  update public.matches
  set status = 'live'
  where id = v_innings.match_id
    and status = 'scheduled';

  return jsonb_build_object(
    'ball', to_jsonb(v_ball),
    'innings', to_jsonb(v_innings),
    'duplicate', false
  );
end;
$$;

revoke all on function public.record_scoring_delivery(jsonb, uuid, uuid, boolean) from public, anon;
grant execute on function public.record_scoring_delivery(jsonb, uuid, uuid, boolean) to authenticated;
