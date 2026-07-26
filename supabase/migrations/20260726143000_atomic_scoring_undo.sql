-- Undo the latest delivery and restore the innings aggregate atomically.

create or replace function public.undo_last_scoring_delivery(p_innings_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_innings public.innings%rowtype;
  v_ball public.ball_by_ball%rowtype;
  v_runs integer;
  v_wickets integer;
  v_extras integer;
  v_legal_balls integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_innings
  from public.innings
  where id = p_innings_id
  for update;

  if not found then
    raise exception 'Innings not found.' using errcode = 'P0002';
  end if;

  if not (select private.can_score_match(v_innings.match_id)) then
    raise exception 'You are not authorized to score this match.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.matches
    where id = v_innings.match_id and status = 'completed'
  ) then
    raise exception 'A completed match cannot be changed.' using errcode = '23514';
  end if;

  select * into v_ball
  from public.ball_by_ball
  where innings_id = p_innings_id
  order by created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception 'There is no delivery to undo.' using errcode = 'P0002';
  end if;

  delete from public.ball_by_ball where id = v_ball.id;

  select
    coalesce(sum(runs + extras), 0)::integer,
    coalesce(count(*) filter (where is_wicket), 0)::integer,
    coalesce(sum(extras), 0)::integer,
    coalesce(count(*) filter (where is_legal), 0)::integer
  into v_runs, v_wickets, v_extras, v_legal_balls
  from public.ball_by_ball
  where innings_id = p_innings_id;

  update public.innings
  set
    total_runs = v_runs,
    total_wickets = v_wickets,
    extras = v_extras,
    balls_bowled = v_legal_balls,
    overs_completed = (floor(v_legal_balls / 6.0)::text || '.' || (v_legal_balls % 6)::text)::numeric,
    is_completed = false,
    striker_id = v_ball.batsman_id,
    non_striker_id = v_ball.non_striker_id,
    current_bowler_id = v_ball.bowler_id
  where id = p_innings_id
  returning * into v_innings;

  return jsonb_build_object(
    'ball', to_jsonb(v_ball),
    'innings', to_jsonb(v_innings)
  );
end;
$$;

revoke all on function public.undo_last_scoring_delivery(uuid) from public, anon;
grant execute on function public.undo_last_scoring_delivery(uuid) to authenticated;
