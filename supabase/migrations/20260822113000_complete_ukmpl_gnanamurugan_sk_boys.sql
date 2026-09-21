-- Reconstruct the remainder of UKMPL 3.0 match 1 from the official Stumps
-- ball history. The guard deliberately refuses to run if live scoring moved
-- beyond the verified 24/1 after 2.1 overs checkpoint.
do $$
declare
  v_match constant uuid := '5646a279-16c3-41f2-b845-a5270175ee75';
  v_gnanamurugan constant uuid := '5a166c34-b9ac-4404-ac7f-98e2cdaa3890';
  v_sk_boys constant uuid := 'be8594cd-82d1-420f-a103-ffea22ad1fa1';

  -- Gnanamurugan players. Sincha is the jersey-53 SATHEES record confirmed
  -- by the organizer; the other SATHEES record is the dismissed batter.
  p_dillu constant uuid := '9ced8615-f896-47d7-a6e0-741a003e64a6';
  p_pathu constant uuid := 'c27e34ac-e320-4442-8e44-81101bd4731c';
  p_kajakopan constant uuid := '54bb1117-0b47-4ff1-a575-f7067f4656a4';
  p_sathees constant uuid := '9cc39201-5b15-4be5-ad00-ea448a1dcb20';
  p_sincha constant uuid := 'e665c642-ebba-4387-8aad-5ceed1d849cc';
  p_akilan constant uuid := 'e6323da9-eb68-4306-91fe-3ca9c25b2533';
  p_rajh constant uuid := 'ef33a0b2-6f37-4e5d-a4f1-49132a470d34';
  p_luki constant uuid := '80892f87-9a51-4131-b5f4-d251cc0c9815';
  p_apisekan constant uuid := 'a272a04c-75e4-44a8-9d37-d7cd1f55431b';
  p_pakeerathan constant uuid := 'e11f4672-28c6-47e7-9c9a-27732637655f';

  -- SK Boys players.
  p_arun constant uuid := '285e2b32-d7b9-4d90-a53e-7def1661ea42';
  p_kavinmaran constant uuid := '7799c5af-1a83-4d75-82ac-801ecf23c674';
  p_kaja constant uuid := 'f7cf3dfa-dcd2-4d76-8ba3-1cfed863b8ad';
  p_thajee constant uuid := 'd0e39afc-46d9-4b7e-ab8d-98e6d3312759';
  p_parthee constant uuid := 'adcab8c6-4945-4597-a045-0a25f97b3ed8';
  p_shankar constant uuid := 'aa236ba5-03e8-4f84-8f42-9d8dd1f97b21';
  p_dravid constant uuid := '9fdaebee-7fd5-4833-9f4a-b95ffb414938';
  p_anojan constant uuid := 'f5c9f30c-1859-456e-92b3-4ba1105bf91a';
  p_kugan constant uuid := '37b550ec-2299-418e-bd5d-bfc06d2650a4';
  p_thinustikan constant uuid := 'dedc5bb0-b2a2-420f-9d41-9d080482f651';
  p_ram constant uuid := '8a52aecb-a434-4a63-8f00-d96e8e7ddf5a';

  v_innings uuid;
  v_striker uuid;
  v_non_striker uuid;
  v_balls integer;
  v_runs integer;
  v_wickets integer;
  v_extras integer;
  v_seq integer := 0;
  e record;
begin
  if exists (select 1 from public.innings where match_id = v_match and innings_number = 2) then
    raise notice 'UKMPL match already reconstructed; skipping.';
    return;
  end if;

  select id, striker_id, non_striker_id, balls_bowled, total_runs, total_wickets, extras
    into v_innings, v_striker, v_non_striker, v_balls, v_runs, v_wickets, v_extras
  from public.innings
  where match_id = v_match and innings_number = 1
  for update;

  if v_innings is null or v_runs <> 24 or v_wickets <> 1 or v_balls <> 13
     or v_striker <> p_pathu or v_non_striker <> p_kajakopan then
    raise exception 'Verified checkpoint mismatch; expected 24/1 after 2.1 with Pathu and Kajakopan.';
  end if;
  if (select count(*) from public.ball_by_ball where innings_id = v_innings) <> 14 then
    raise exception 'Verified checkpoint mismatch; expected exactly 14 stored delivery events.';
  end if;

  create temporary table ukmpl_tape (
    seq integer generated always as identity,
    innings_no integer not null,
    bowler uuid not null,
    runs integer not null default 0,
    extras integer not null default 0,
    extras_type text,
    legal boolean not null default true,
    dismissal text,
    next_batter uuid,
    fielder uuid,
    striker_override uuid,
    non_striker_override uuid
  ) on commit drop;

  -- First innings continuation: Stumps 2.2 through 9.6.
  insert into ukmpl_tape (innings_no,bowler,runs,extras,extras_type,legal,dismissal,next_batter,fielder) values
    (1,p_thinustikan,0,0,null,true,'caught',p_sathees,p_arun),
    (1,p_thinustikan,0,1,'no_ball',false,null,null,null),
    (1,p_thinustikan,0,1,'leg_bye',true,null,null,null),
    (1,p_thinustikan,0,0,null,true,null,null,null),
    (1,p_thinustikan,2,0,null,true,null,null,null),
    (1,p_thinustikan,0,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,'bowled',p_akilan,null),
    (1,p_shankar,0,0,null,true,null,null,null),
    (1,p_shankar,1,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,null,null,null),
    (1,p_shankar,6,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,'caught',p_sincha,p_dravid),
    (1,p_thinustikan,0,0,null,true,null,null,null),
    (1,p_thinustikan,0,0,null,true,null,null,null),
    (1,p_thinustikan,1,0,null,true,null,null,null),
    (1,p_thinustikan,6,0,null,true,null,null,null),
    (1,p_thinustikan,0,4,'leg_bye',true,null,null,null),
    (1,p_thinustikan,0,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,null,null,null),
    (1,p_shankar,1,0,null,true,null,null,null),
    (1,p_shankar,0,0,null,true,null,null,null),
    (1,p_shankar,4,0,null,true,null,null,null),
    (1,p_shankar,6,0,null,true,null,null,null),
    (1,p_kaja,0,1,'no_ball',false,null,null,null),
    (1,p_kaja,1,0,null,true,null,null,null),
    (1,p_kaja,6,0,null,true,null,null,null),
    (1,p_kaja,0,0,null,true,null,null,null),
    (1,p_kaja,0,1,'no_ball',false,null,null,null),
    (1,p_kaja,6,0,null,true,null,null,null),
    (1,p_kaja,6,0,null,true,null,null,null),
    (1,p_kaja,0,0,null,true,null,null,null),
    (1,p_arun,0,0,null,true,null,null,null),
    (1,p_arun,0,0,null,true,null,null,null),
    (1,p_arun,0,0,null,true,null,null,null),
    (1,p_arun,0,0,null,true,'bowled',p_rajh,null),
    (1,p_arun,0,0,null,true,null,null,null),
    (1,p_arun,0,0,null,true,null,null,null),
    (1,p_thajee,0,0,null,true,null,null,null),
    (1,p_thajee,6,0,null,true,null,null,null),
    (1,p_thajee,1,0,null,true,null,null,null),
    (1,p_thajee,1,0,null,true,null,null,null),
    (1,p_thajee,0,0,null,true,null,null,null),
    (1,p_thajee,0,0,null,true,null,null,null),
    (1,p_kugan,0,1,'wide',false,null,null,null),
    (1,p_kugan,0,0,null,true,'caught',p_luki,p_kavinmaran),
    (1,p_kugan,1,0,null,true,null,null,null),
    (1,p_kugan,6,0,null,true,null,null,null),
    (1,p_kugan,6,0,null,true,null,null,null),
    (1,p_kugan,0,0,null,true,null,null,null),
    (1,p_kugan,0,0,null,true,null,null,null);

  -- Second innings, complete official tape.
  insert into ukmpl_tape (innings_no,bowler,runs,extras,extras_type,legal,dismissal,next_batter,fielder,striker_override,non_striker_override) values
    (2,p_pakeerathan,0,0,null,true,null,null,null,null,null),(2,p_pakeerathan,1,0,null,true,null,null,null,null,null),(2,p_pakeerathan,4,0,null,true,null,null,null,null,null),(2,p_pakeerathan,2,0,null,true,null,null,null,null,null),(2,p_pakeerathan,0,0,null,true,null,null,null,null,null),(2,p_pakeerathan,2,0,null,true,null,null,null,null,null),
    (2,p_sincha,0,0,null,true,null,null,null,null,null),(2,p_sincha,1,0,null,true,null,null,null,null,null),(2,p_sincha,4,0,null,true,null,null,null,null,null),(2,p_sincha,2,0,null,true,null,null,null,null,null),(2,p_sincha,0,0,null,true,null,null,null,null,null),(2,p_sincha,6,0,null,true,null,null,null,null,null),
    (2,p_pathu,0,0,null,true,null,null,null,null,null),(2,p_pathu,6,0,null,true,null,null,null,null,null),(2,p_pathu,0,0,null,true,null,null,null,null,null),(2,p_pathu,0,0,null,true,null,null,null,null,null),(2,p_pathu,4,0,null,true,null,null,null,null,null),(2,p_pathu,0,0,null,true,null,null,null,null,null),
    (2,p_dillu,0,0,null,true,null,null,null,null,null),(2,p_dillu,0,0,null,true,'caught',p_kaja,p_apisekan,null,null),(2,p_dillu,0,0,null,true,'bowled',p_thajee,null,null,null),(2,p_dillu,1,0,null,true,null,null,null,null,null),(2,p_dillu,1,0,null,true,null,null,null,null,null),(2,p_dillu,1,0,null,true,null,null,null,null,null),
    (2,p_rajh,0,1,'leg_bye',true,null,null,null,null,null),(2,p_rajh,0,0,null,true,'bowled',p_parthee,null,null,null),(2,p_rajh,0,1,'wide',false,null,null,null,null,null),(2,p_rajh,1,0,null,true,null,null,null,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),
    (2,p_dillu,0,0,null,true,null,null,null,null,null),(2,p_dillu,2,0,null,true,null,null,null,null,null),(2,p_dillu,0,0,null,true,null,null,null,null,null),(2,p_dillu,1,0,null,true,null,null,null,null,null),(2,p_dillu,0,0,null,true,null,null,null,null,null),(2,p_dillu,0,0,null,true,null,null,null,null,null),
    (2,p_pakeerathan,0,0,null,true,null,null,null,null,null),(2,p_pakeerathan,0,1,'wide',false,null,null,null,null,null),(2,p_pakeerathan,0,1,'bye',true,null,null,null,null,null),(2,p_pakeerathan,1,0,null,true,null,null,null,null,null),(2,p_pakeerathan,0,0,null,true,null,null,null,null,null),(2,p_pakeerathan,0,1,'leg_bye',true,null,null,null,null,null),(2,p_pakeerathan,1,0,null,true,null,null,null,null,null),
    (2,p_sincha,1,0,null,true,null,null,null,null,null),(2,p_sincha,2,0,null,true,null,null,null,null,null),(2,p_sincha,6,0,null,true,null,null,null,null,null),(2,p_sincha,1,0,null,true,null,null,null,null,null),(2,p_sincha,0,0,null,true,null,null,null,null,null),(2,p_sincha,0,1,'no_ball',false,null,null,null,null,null),(2,p_sincha,6,0,null,true,null,null,null,null,null),
    (2,p_rajh,0,0,null,true,'caught',p_shankar,p_dillu,null,null),(2,p_rajh,0,0,null,true,'caught',p_dravid,p_sincha,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),(2,p_rajh,0,0,null,true,null,null,null,null,null),(2,p_rajh,1,0,null,true,null,null,null,null,null),
    (2,p_apisekan,0,0,null,true,'bowled',p_anojan,null,null,null),(2,p_apisekan,0,1,'wide',false,null,null,null,null,null),(2,p_apisekan,0,0,null,true,'run_out',p_kugan,null,null,null),(2,p_apisekan,0,0,null,true,'bowled',p_thinustikan,null,p_thajee,p_kugan),(2,p_apisekan,0,0,null,true,'bowled',p_ram,null,p_kugan,p_thinustikan),(2,p_apisekan,0,0,null,true,null,null,null,p_thinustikan,p_ram),(2,p_apisekan,0,5,'wide',false,null,null,null,null,null),(2,p_apisekan,0,0,null,true,null,null,null,null,null);

  -- Apply the first-innings continuation.
  for e in select * from ukmpl_tape where innings_no = 1 order by seq loop
    if e.striker_override is not null then v_striker := e.striker_override; end if;
    if e.non_striker_override is not null then v_non_striker := e.non_striker_override; end if;
    v_seq := v_seq + 1;
    insert into public.ball_by_ball
      (client_event_id,innings_id,over_number,ball_number,batsman_id,non_striker_id,bowler_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type,player_out_id,fielder_id,commentary,created_at)
    values
      (gen_random_uuid(),v_innings,(v_balls/6)+1,(v_balls%6)+1,v_striker,v_non_striker,e.bowler,e.runs,e.extras,e.extras_type,e.legal,e.dismissal is not null,e.dismissal,case when e.dismissal is not null then v_striker end,e.fielder,'Imported from official Stumps ball history.',clock_timestamp() + v_seq * interval '1 millisecond');
    v_runs := v_runs + e.runs + e.extras;
    v_extras := v_extras + e.extras;
    if e.dismissal is not null then v_wickets := v_wickets + 1; v_striker := e.next_batter; end if;
    if mod(e.runs,2)=1 or (e.extras_type in ('bye','leg_bye') and mod(e.extras,2)=1) then select v_non_striker,v_striker into v_striker,v_non_striker; end if;
    if e.legal then v_balls := v_balls + 1; if mod(v_balls,6)=0 then select v_non_striker,v_striker into v_striker,v_non_striker; end if; end if;
  end loop;
  if v_runs <> 100 or v_wickets <> 6 or v_balls <> 60 or v_extras <> 10 then raise exception 'First innings validation failed: %/% balls %, extras %',v_runs,v_wickets,v_balls,v_extras; end if;
  update public.innings set total_runs=v_runs,total_wickets=v_wickets,balls_bowled=v_balls,overs_completed=10.0,extras=v_extras,is_completed=true,striker_id=v_striker,non_striker_id=v_non_striker,current_bowler_id=p_kugan where id=v_innings;

  insert into public.innings (match_id,innings_number,batting_team_id,bowling_team_id,total_runs,total_wickets,balls_bowled,overs_completed,extras,target,is_completed,striker_id,non_striker_id,current_bowler_id)
  values (v_match,2,v_sk_boys,v_gnanamurugan,0,0,0,0,0,101,false,p_arun,p_kavinmaran,p_pakeerathan)
  returning id into v_innings;
  v_striker:=p_arun; v_non_striker:=p_kavinmaran; v_balls:=0; v_runs:=0; v_wickets:=0; v_extras:=0;

  for e in select * from ukmpl_tape where innings_no = 2 order by seq loop
    if e.striker_override is not null then v_striker := e.striker_override; end if;
    if e.non_striker_override is not null then v_non_striker := e.non_striker_override; end if;
    v_seq := v_seq + 1;
    insert into public.ball_by_ball
      (client_event_id,innings_id,over_number,ball_number,batsman_id,non_striker_id,bowler_id,runs,extras,extras_type,is_legal,is_wicket,dismissal_type,player_out_id,fielder_id,commentary,created_at)
    values
      (gen_random_uuid(),v_innings,(v_balls/6)+1,(v_balls%6)+1,v_striker,v_non_striker,e.bowler,e.runs,e.extras,e.extras_type,e.legal,e.dismissal is not null,e.dismissal,case when e.dismissal is not null then v_striker end,e.fielder,'Imported from official Stumps ball history.',clock_timestamp() + v_seq * interval '1 millisecond');
    v_runs := v_runs + e.runs + e.extras;
    v_extras := v_extras + e.extras;
    if e.dismissal is not null then v_wickets := v_wickets + 1; v_striker := e.next_batter; end if;
    if mod(e.runs,2)=1 or (e.extras_type in ('bye','leg_bye') and mod(e.extras,2)=1) then select v_non_striker,v_striker into v_striker,v_non_striker; end if;
    if e.legal then v_balls := v_balls + 1; if mod(v_balls,6)=0 then select v_non_striker,v_striker into v_striker,v_non_striker; end if; end if;
  end loop;
  if v_runs <> 70 or v_wickets <> 9 or v_balls <> 60 then raise exception 'Second innings validation failed: %/% balls %, extras %',v_runs,v_wickets,v_balls,v_extras; end if;
  update public.innings set total_runs=v_runs,total_wickets=v_wickets,balls_bowled=v_balls,overs_completed=10.0,extras=v_extras,target=101,is_completed=true,striker_id=p_thinustikan,non_striker_id=p_ram,current_bowler_id=p_apisekan where id=v_innings;
  update public.matches set status='completed',winner_id=v_gnanamurugan,player_of_match_id=p_apisekan,player_of_match_summary='3 wickets for 6 runs' where id=v_match;
end $$;
