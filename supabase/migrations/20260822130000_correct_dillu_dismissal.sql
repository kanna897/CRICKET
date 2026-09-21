-- Dillu was officially c Kaja b Arun. The original phone scorer saved the
-- wicket as bowled because the portrait wicket control defaulted to Bowled.
do $$
declare
  v_match constant uuid := '5646a279-16c3-41f2-b845-a5270175ee75';
  p_dillu constant uuid := '9ced8615-f896-47d7-a6e0-741a003e64a6';
  p_arun constant uuid := '285e2b32-d7b9-4d90-a53e-7def1661ea42';
  p_kaja constant uuid := 'f7cf3dfa-dcd2-4d76-8ba3-1cfed863b8ad';
  v_updated integer;
begin
  update public.ball_by_ball b
  set dismissal_type = 'caught', fielder_id = p_kaja,
      commentary = 'Dillu c Kaja b Arun.'
  from public.innings i
  where b.innings_id = i.id
    and i.match_id = v_match and i.innings_number = 1
    and b.player_out_id = p_dillu and b.bowler_id = p_arun
    and b.is_wicket = true and b.over_number = 2 and b.ball_number = 5;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Expected exactly one Dillu wicket delivery; updated %.', v_updated;
  end if;
end $$;
