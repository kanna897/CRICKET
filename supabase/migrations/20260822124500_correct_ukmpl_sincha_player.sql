-- Correct the two duplicate SATHEES identities in UKMPL match 1.
-- The jersey-138 player is Sincha (53 not out and 2 overs); the jersey-53
-- player is the batter dismissed for zero.
do $$
declare
  v_match constant uuid := '5646a279-16c3-41f2-b845-a5270175ee75';
  v_correct_sincha constant uuid := 'e665c642-ebba-4387-8aad-5ceed1d849cc';
  v_other_sathees constant uuid := '9cc39201-5b15-4be5-ad00-ea448a1dcb20';
  v_innings_ids uuid[];
begin
  select array_agg(id order by innings_number) into v_innings_ids
  from public.innings where match_id = v_match;

  if coalesce(array_length(v_innings_ids, 1), 0) <> 2 then
    raise exception 'Expected two completed innings before correcting Sincha.';
  end if;
  if (select coalesce(sum(runs),0) from public.ball_by_ball where innings_id = v_innings_ids[1] and batsman_id = v_other_sathees) <> 53 then
    raise exception 'Expected the provisional SATHEES record to own 53 first-innings runs.';
  end if;

  update public.ball_by_ball set
    batsman_id = case batsman_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else batsman_id end,
    non_striker_id = case non_striker_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else non_striker_id end,
    bowler_id = case bowler_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else bowler_id end,
    player_out_id = case player_out_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else player_out_id end,
    fielder_id = case fielder_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else fielder_id end
  where innings_id = any(v_innings_ids)
    and (batsman_id in (v_correct_sincha,v_other_sathees)
      or non_striker_id in (v_correct_sincha,v_other_sathees)
      or bowler_id in (v_correct_sincha,v_other_sathees)
      or player_out_id in (v_correct_sincha,v_other_sathees)
      or fielder_id in (v_correct_sincha,v_other_sathees));

  update public.innings set
    striker_id = case striker_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else striker_id end,
    non_striker_id = case non_striker_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else non_striker_id end,
    current_bowler_id = case current_bowler_id when v_correct_sincha then v_other_sathees when v_other_sathees then v_correct_sincha else current_bowler_id end
  where match_id = v_match;

  update public.players
  set name = 'SATHEES (SINCHA)', jersey_name = 'SATHEES (SINCHA)'
  where id = v_correct_sincha;

  if (select coalesce(sum(runs),0) from public.ball_by_ball where innings_id = v_innings_ids[1] and batsman_id = v_correct_sincha) <> 53 then
    raise exception 'Sincha correction validation failed.';
  end if;
end $$;
