-- Separate retained/fixed-player inventory with atomic assignment, purse update,
-- squad creation and duplicate auction-card exclusion by tournament + S.No.

alter table public.auction_players drop constraint if exists auction_players_source_type_check;
alter table public.auction_players add constraint auction_players_source_type_check
  check (source_type in ('registration', 'bulk_upload', 'fixed_upload'));

alter table public.auction_players drop constraint if exists auction_players_status_check;
alter table public.auction_players add constraint auction_players_status_check
  check (status in ('available', 'live', 'sold', 'unsold', 'fixed_unassigned', 'fixed', 'excluded'));

alter table public.auction_history drop constraint if exists auction_history_action_check;
alter table public.auction_history add constraint auction_history_action_check
  check (action in ('live', 'sold', 'unsold', 'reopened', 'fixed', 'fixed_removed'));

create or replace function public.create_fixed_auction_players(p_tournament_id uuid, p_players jsonb)
returns setof public.auction_players language plpgsql security definer set search_path = '' as $$
declare item jsonb; inserted public.auction_players; card_url text; display_name text; display_role text; serial integer;
begin
  if not private.can_manage_tournament(p_tournament_id) then raise exception 'Unauthorized'; end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_array_length(p_players) < 1 or jsonb_array_length(p_players) > 500 then
    raise exception 'Upload between 1 and 500 fixed player cards';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tournament_id::text, 0));
  for item in select value from jsonb_array_elements(p_players) loop
    card_url := btrim(coalesce(item->>'card_url', ''));
    display_name := btrim(coalesce(item->>'player_name', 'Player'));
    display_role := btrim(coalesce(item->>'playing_role', 'Player'));
    serial := nullif(item->>'registration_number', '')::integer;
    if card_url !~ '^https://' then raise exception 'Every fixed player card requires a secure image URL'; end if;
    if serial is null or serial < 1 then raise exception 'Fixed player filename must start with its auction S.No'; end if;
    if exists (select 1 from public.auction_players where tournament_id = p_tournament_id and source_type = 'fixed_upload' and registration_number = serial) then
      raise exception 'A fixed player card already exists for S.No %', serial;
    end if;
    insert into public.auction_players (tournament_id, registration_id, player_id, registration_number, player_name, photo_url, playing_role, batting_style, bowling_style, status, player_card_url, source_type)
    values (p_tournament_id, null, null, serial, left(coalesce(nullif(display_name,''), 'Player'),255), card_url, left(coalesce(nullif(display_role,''),'Player'),50), '', '', 'fixed_unassigned', card_url, 'fixed_upload')
    returning * into inserted;
    return next inserted;
  end loop;
end $$;

create or replace function public.assign_fixed_auction_player(p_auction_player_id uuid, p_team_id uuid, p_points numeric)
returns public.auction_players language plpgsql security definer set search_path = '' as $$
declare target public.auction_players; purse public.auction_team_purses; target_player_id uuid; synthetic_phone text;
begin
  if p_points is null or p_points < 0 then raise exception 'Fixed points must be zero or greater'; end if;
  select * into target from public.auction_players where id = p_auction_player_id for update;
  if target.id is null or target.source_type <> 'fixed_upload' then raise exception 'Fixed player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then raise exception 'Unauthorized'; end if;
  if target.status <> 'fixed_unassigned' then raise exception 'Fixed player is already assigned'; end if;
  if not exists (select 1 from public.teams where id = p_team_id and tournament_id = target.tournament_id and deleted_at is null) then raise exception 'Selected team does not belong to this tournament'; end if;
  if (select count(*) from public.auction_players where tournament_id = target.tournament_id and source_type = 'fixed_upload' and status = 'fixed' and winning_team_id = p_team_id) >= 3 then raise exception 'A team can have a maximum of 3 fixed players'; end if;
  select * into purse from public.auction_team_purses where tournament_id = target.tournament_id and team_id = p_team_id for update;
  if purse.team_id is null then raise exception 'Configure the team purse first'; end if;
  if purse.initial_purse - purse.total_spent < p_points then raise exception 'Fixed points exceed the remaining purse'; end if;
  synthetic_phone := 'fixed-' || target.id::text;
  insert into public.players (name, player_name, phone_number, contact_number, photo_url, playing_role, role, batting_style, bowling_style, jersey_name, jersey_number, team_id)
  values (target.player_name, target.player_name, synthetic_phone, synthetic_phone, target.photo_url, target.playing_role,
    case lower(replace(target.playing_role,' ','_')) when 'all_rounder' then 'all-rounder' when 'wicket_keeper' then 'wicket-keeper' when 'bowler' then 'bowler' else 'batsman' end,
    nullif(target.batting_style,''), nullif(target.bowling_style,''), target.player_name, target.registration_number, p_team_id)
  returning id into target_player_id;
  update public.auction_team_purses set total_spent = total_spent + p_points, purchased_count = purchased_count + 1, updated_at = now() where tournament_id = target.tournament_id and team_id = p_team_id;
  update public.auction_players set player_id = target_player_id, status = 'fixed', winning_team_id = p_team_id, winning_bid = p_points, sold_at = now(), updated_at = now() where id = target.id returning * into target;
  update public.auction_players set status = 'excluded', updated_at = now() where tournament_id = target.tournament_id and source_type = 'bulk_upload' and registration_number = target.registration_number and status in ('available','unsold');
  insert into public.auction_history (tournament_id, auction_player_id, registration_id, team_id, bid_amount, action, created_by) values (target.tournament_id, target.id, null, p_team_id, p_points, 'fixed', auth.uid());
  return target;
end $$;

create or replace function public.unassign_fixed_auction_player(p_auction_player_id uuid)
returns public.auction_players language plpgsql security definer set search_path = '' as $$
declare target public.auction_players;
begin
  select * into target from public.auction_players where id = p_auction_player_id for update;
  if target.id is null or target.source_type <> 'fixed_upload' then raise exception 'Fixed player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then raise exception 'Unauthorized'; end if;
  if target.status <> 'fixed' then raise exception 'Player is not assigned as fixed'; end if;
  update public.auction_team_purses set total_spent = greatest(0, total_spent - coalesce(target.winning_bid,0)), purchased_count = greatest(0, purchased_count - 1), updated_at = now() where tournament_id = target.tournament_id and team_id = target.winning_team_id;
  update public.players set team_id = null where id = target.player_id;
  update public.auction_players set status = 'available', updated_at = now() where tournament_id = target.tournament_id and source_type = 'bulk_upload' and registration_number = target.registration_number and status = 'excluded';
  insert into public.auction_history (tournament_id, auction_player_id, registration_id, team_id, bid_amount, action, created_by) values (target.tournament_id, target.id, null, target.winning_team_id, target.winning_bid, 'fixed_removed', auth.uid());
  update public.auction_players set player_id = null, status = 'fixed_unassigned', winning_team_id = null, winning_bid = null, sold_at = null, updated_at = now() where id = target.id returning * into target;
  return target;
end $$;

revoke all on function public.create_fixed_auction_players(uuid, jsonb) from public, anon;
revoke all on function public.assign_fixed_auction_player(uuid, uuid, numeric) from public, anon;
revoke all on function public.unassign_fixed_auction_player(uuid) from public, anon;
grant execute on function public.create_fixed_auction_players(uuid, jsonb) to authenticated;
grant execute on function public.assign_fixed_auction_player(uuid, uuid, numeric) to authenticated;
grant execute on function public.unassign_fixed_auction_player(uuid) to authenticated;
