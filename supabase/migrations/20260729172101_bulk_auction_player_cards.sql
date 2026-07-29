-- Auction cards are now uploaded as finished JPG/PNG files directly inside
-- Live Auction. Player registration no longer creates auction inventory.

alter table public.auction_players
  alter column registration_id drop not null,
  add column if not exists source_type text not null default 'registration';

alter table public.auction_players
  drop constraint if exists auction_players_source_type_check,
  add constraint auction_players_source_type_check
    check (source_type in ('registration', 'bulk_upload'));

alter table public.auction_history
  alter column registration_id drop not null;

drop trigger if exists create_auction_player_for_registration
  on public.player_registrations;

create or replace function public.create_bulk_auction_players(
  p_tournament_id uuid,
  p_players jsonb
)
returns setof public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  next_number integer;
  inserted public.auction_players;
  card_url text;
  display_name text;
  display_role text;
begin
  if not private.can_manage_tournament(p_tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if jsonb_typeof(p_players) <> 'array'
     or jsonb_array_length(p_players) < 1
     or jsonb_array_length(p_players) > 500 then
    raise exception 'Upload between 1 and 500 player cards';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tournament_id::text, 0));
  select coalesce(max(registration_number), 0) + 1
    into next_number
  from public.auction_players
  where tournament_id = p_tournament_id;

  for item in select value from jsonb_array_elements(p_players)
  loop
    card_url := btrim(coalesce(item->>'card_url', ''));
    display_name := btrim(coalesce(item->>'player_name', ''));
    display_role := btrim(coalesce(item->>'playing_role', 'Player'));
    if card_url !~ '^https://' then
      raise exception 'Every player card requires a secure image URL';
    end if;
    if display_name = '' then
      display_name := 'Player ' || lpad(next_number::text, 2, '0');
    end if;
    if display_role = '' then display_role := 'Player'; end if;

    insert into public.auction_players (
      tournament_id, registration_id, player_id, registration_number,
      player_name, photo_url, playing_role, batting_style, bowling_style,
      status, player_card_url, source_type
    ) values (
      p_tournament_id, null, null, next_number,
      left(display_name, 255), card_url, left(display_role, 50), '', '',
      'available', card_url, 'bulk_upload'
    )
    returning * into inserted;

    next_number := next_number + 1;
    return next inserted;
  end loop;
end;
$$;

create or replace function public.sell_auction_player(
  p_auction_player_id uuid,
  p_team_id uuid,
  p_winning_bid numeric
)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
  registration public.player_registrations;
  target_player_id uuid;
  purse public.auction_team_purses;
  synthetic_phone text;
begin
  if p_winning_bid is null or p_winning_bid < 0 then
    raise exception 'Winning bid must be zero or greater';
  end if;

  select * into target from public.auction_players
  where id = p_auction_player_id for update;
  if target.id is null then raise exception 'Auction player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if target.status not in ('available', 'live') then
    raise exception 'Player is already completed';
  end if;
  if not exists (
    select 1 from public.teams team
    where team.id = p_team_id and team.tournament_id = target.tournament_id
  ) then
    raise exception 'Selected team does not belong to this tournament';
  end if;

  select * into purse from public.auction_team_purses
  where tournament_id = target.tournament_id and team_id = p_team_id
  for update;
  if purse.team_id is null then raise exception 'Configure the team purse first'; end if;
  if purse.initial_purse - purse.total_spent < p_winning_bid then
    raise exception 'Winning bid exceeds the remaining purse';
  end if;

  target_player_id := target.player_id;
  if target.registration_id is not null then
    select * into registration from public.player_registrations
    where id = target.registration_id for update;
    target_player_id := coalesce(target_player_id, registration.player_id);
  end if;

  if target_player_id is null then
    synthetic_phone := case
      when target.registration_id is null then 'auction-' || target.id::text
      else registration.contact_number
    end;
    insert into public.players (
      name, player_name, phone_number, contact_number, photo_url,
      playing_role, role, batting_style, bowling_style,
      jersey_name, jersey_number, team_id
    ) values (
      target.player_name,
      target.player_name,
      synthetic_phone,
      synthetic_phone,
      target.photo_url,
      target.playing_role,
      case lower(replace(target.playing_role, ' ', '_'))
        when 'all_rounder' then 'all-rounder'
        when 'wicket_keeper' then 'wicket-keeper'
        when 'batsman' then 'batsman'
        when 'bowler' then 'bowler'
        else 'batsman'
      end,
      nullif(target.batting_style, ''),
      nullif(target.bowling_style, ''),
      target.player_name,
      target.registration_number,
      p_team_id
    )
    returning id into target_player_id;
  else
    update public.players set team_id = p_team_id where id = target_player_id;
  end if;

  if target.registration_id is not null then
    update public.player_registrations
    set player_id = target_player_id,
        preferred_team_id = p_team_id,
        status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = target.registration_id;
  end if;

  update public.auction_team_purses
  set total_spent = total_spent + p_winning_bid,
      purchased_count = purchased_count + 1,
      updated_at = now()
  where tournament_id = target.tournament_id and team_id = p_team_id;

  update public.auction_players
  set player_id = target_player_id,
      status = 'sold',
      winning_team_id = p_team_id,
      winning_bid = p_winning_bid,
      sold_at = now(),
      updated_at = now()
  where id = target.id
  returning * into target;

  update public.auction_sessions
  set current_auction_player_id = null, updated_at = now()
  where tournament_id = target.tournament_id;

  insert into public.auction_history (
    tournament_id, auction_player_id, registration_id,
    team_id, bid_amount, action, created_by
  ) values (
    target.tournament_id, target.id, target.registration_id,
    p_team_id, p_winning_bid, 'sold', auth.uid()
  );
  return target;
end;
$$;

revoke all on function public.create_bulk_auction_players(uuid, jsonb) from public, anon;
grant execute on function public.create_bulk_auction_players(uuid, jsonb) to authenticated;
