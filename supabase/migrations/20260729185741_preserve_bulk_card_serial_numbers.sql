-- Bulk auction cards use the serial number printed on the source image.
-- Existing bulk uploads are re-numbered independently from legacy
-- registration-created auction rows, which are no longer shown.

with ordered_cards as (
  select
    id,
    row_number() over (
      partition by tournament_id
      order by created_at, id
    )::integer as printed_order
  from public.auction_players
  where source_type = 'bulk_upload'
)
update public.auction_players player
set registration_number = ordered.printed_order,
    updated_at = now()
from ordered_cards ordered
where player.id = ordered.id;

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
  selected_number integer;
  requested_number text;
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
  where tournament_id = p_tournament_id
    and source_type = 'bulk_upload';

  for item in select value from jsonb_array_elements(p_players)
  loop
    card_url := btrim(coalesce(item->>'card_url', ''));
    display_name := btrim(coalesce(item->>'player_name', ''));
    display_role := btrim(coalesce(item->>'playing_role', 'Player'));
    requested_number := btrim(coalesce(item->>'registration_number', ''));

    if card_url !~ '^https://' then
      raise exception 'Every player card requires a secure image URL';
    end if;
    if requested_number ~ '^[0-9]{1,6}$' and requested_number::integer > 0 then
      selected_number := requested_number::integer;
    else
      selected_number := next_number;
    end if;
    if exists (
      select 1
      from public.auction_players existing
      where existing.tournament_id = p_tournament_id
        and existing.source_type = 'bulk_upload'
        and existing.registration_number = selected_number
    ) then
      raise exception 'Player card S.NO % is already uploaded', selected_number;
    end if;
    if display_name = '' then display_name := 'Player'; end if;
    if display_role = '' then display_role := 'Player'; end if;

    insert into public.auction_players (
      tournament_id, registration_id, player_id, registration_number,
      player_name, photo_url, playing_role, batting_style, bowling_style,
      status, player_card_url, source_type
    ) values (
      p_tournament_id, null, null, selected_number,
      left(display_name, 255), card_url, left(display_role, 50), '', '',
      'available', card_url, 'bulk_upload'
    )
    returning * into inserted;

    next_number := greatest(next_number, selected_number + 1);
    return next inserted;
  end loop;
end;
$$;

revoke all on function public.create_bulk_auction_players(uuid, jsonb)
  from public, anon;
grant execute on function public.create_bulk_auction_players(uuid, jsonb)
  to authenticated;
