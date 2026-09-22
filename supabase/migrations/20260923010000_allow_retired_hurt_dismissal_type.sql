-- Allow retired_hurt in ball_by_ball dismissal_type check constraint
-- and provide atomic batter retirement RPC.

alter table public.ball_by_ball
  drop constraint if exists ball_by_ball_dismissal_type_check;

alter table public.ball_by_ball
  add constraint ball_by_ball_dismissal_type_check
  check (
    dismissal_type is null
    or dismissal_type in (
      'bowled', 'caught', 'caught_and_bowled', 'lbw', 'run_out',
      'stumped', 'hit_wicket', 'obstructing_field', 'timed_out',
      'retired_out', 'retired_hurt'
    )
  );

create or replace function public.record_batter_retirement(
  p_innings_id uuid,
  p_player_out_id uuid,
  p_dismissal_type text,
  p_next_striker_id uuid default null,
  p_next_non_striker_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_innings public.innings%rowtype;
  v_ball public.ball_by_ball%rowtype;
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

  -- Update innings striker and non-striker
  update public.innings
  set
    striker_id = p_next_striker_id,
    non_striker_id = p_next_non_striker_id
  where id = p_innings_id
  returning * into v_innings;

  -- Find the latest ball faced by this player or the latest ball of the innings
  select * into v_ball
  from public.ball_by_ball
  where innings_id = p_innings_id and batsman_id = p_player_out_id
  order by created_at desc, id desc
  limit 1;

  if not found then
    select * into v_ball
    from public.ball_by_ball
    where innings_id = p_innings_id
    order by created_at desc, id desc
    limit 1;
  end if;

  if found then
    update public.ball_by_ball
    set
      player_out_id = p_player_out_id,
      dismissal_type = p_dismissal_type
    where id = v_ball.id
    returning * into v_ball;
  end if;

  return jsonb_build_object(
    'innings', to_jsonb(v_innings),
    'ball', case when v_ball.id is not null then to_jsonb(v_ball) else null end
  );
end;
$$;

revoke all on function public.record_batter_retirement(uuid, uuid, text, uuid, uuid) from public, anon;
grant execute on function public.record_batter_retirement(uuid, uuid, text, uuid, uuid) to authenticated;
