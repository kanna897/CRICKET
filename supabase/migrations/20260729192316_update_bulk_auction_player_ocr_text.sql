alter table public.auction_players
  add column if not exists ocr_serial_number integer
    check (ocr_serial_number is null or ocr_serial_number > 0);

create or replace function public.update_bulk_auction_player_text(
  p_auction_player_id uuid,
  p_player_name text,
  p_playing_role text,
  p_registration_number integer default null
)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
  clean_name text := btrim(coalesce(p_player_name, ''));
  clean_role text := btrim(coalesce(p_playing_role, ''));
begin
  select *
  into target
  from public.auction_players
  where id = p_auction_player_id
  for update;

  if target.id is null or target.source_type <> 'bulk_upload' then
    raise exception 'Bulk auction player not found';
  end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if clean_name = '' then
    raise exception 'OCR did not find a player name';
  end if;
  if clean_role = '' then clean_role := 'Player'; end if;
  if p_registration_number is not null and p_registration_number < 1 then
    raise exception 'S.NO must be greater than zero';
  end if;
  update public.auction_players
  set player_name = left(clean_name, 255),
      playing_role = left(clean_role, 50),
      ocr_serial_number = coalesce(p_registration_number, ocr_serial_number),
      updated_at = now()
  where id = target.id
  returning * into target;

  if target.player_id is not null then
    update public.players
    set name = target.player_name,
        player_name = target.player_name,
        playing_role = target.playing_role
    where id = target.player_id;
  end if;

  return target;
end;
$$;

revoke all on function public.update_bulk_auction_player_text(
  uuid, text, text, integer
) from public, anon;
grant execute on function public.update_bulk_auction_player_text(
  uuid, text, text, integer
) to authenticated;
