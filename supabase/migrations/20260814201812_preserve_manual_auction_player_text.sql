alter table public.auction_players
  add column if not exists manual_text_updated_at timestamptz;

drop function if exists public.update_bulk_auction_player_text(uuid, text, text, integer, text, text, text);

create function public.update_bulk_auction_player_text(
  p_auction_player_id uuid, p_player_name text, p_playing_role text,
  p_registration_number integer default null, p_contact_number text default null,
  p_batting_style text default null, p_bowling_style text default null,
  p_manual boolean default false
) returns public.auction_players language plpgsql security definer set search_path = '' as $$
declare
  target public.auction_players;
  clean_name text := btrim(coalesce(p_player_name, ''));
  clean_role text := btrim(coalesce(p_playing_role, ''));
  clean_phone text := regexp_replace(btrim(coalesce(p_contact_number, '')), '[[:space:]().-]+', '', 'g');
  clean_batting text := btrim(coalesce(p_batting_style, ''));
  clean_bowling text := btrim(coalesce(p_bowling_style, ''));
begin
  select * into target from public.auction_players where id = p_auction_player_id for update;
  if target.id is null or target.source_type not in ('bulk_upload', 'fixed_upload') then
    raise exception 'Uploaded auction player not found';
  end if;
  if not private.can_manage_tournament(target.tournament_id) then raise exception 'Unauthorized'; end if;
  if clean_name = '' then raise exception 'OCR did not find a player name'; end if;
  if clean_role = '' then clean_role := 'Player'; end if;
  if p_registration_number is not null and p_registration_number < 1 then raise exception 'S.NO must be greater than zero'; end if;
  if clean_phone !~ '^[0-9]{10}$' and not (left(clean_phone, 3) = '+94' and substring(clean_phone from 4) ~ '^[0-9]{9}$') then clean_phone := ''; end if;

  update public.auction_players set
    player_name = case when manual_text_updated_at is not null and not p_manual then player_name else left(clean_name, 255) end,
    playing_role = case when manual_text_updated_at is not null and not p_manual then playing_role else left(clean_role, 50) end,
    contact_number = coalesce(nullif(clean_phone, ''), contact_number),
    batting_style = coalesce(nullif(clean_batting, ''), batting_style),
    bowling_style = coalesce(nullif(clean_bowling, ''), bowling_style),
    ocr_serial_number = case when manual_text_updated_at is not null and not p_manual then ocr_serial_number else coalesce(p_registration_number, ocr_serial_number) end,
    manual_text_updated_at = case when p_manual then now() else manual_text_updated_at end,
    updated_at = now()
  where id = target.id returning * into target;

  if target.player_id is not null then
    update public.players set name = target.player_name, player_name = target.player_name,
      playing_role = target.playing_role, phone_number = coalesce(target.contact_number, phone_number),
      contact_number = coalesce(target.contact_number, contact_number),
      batting_style = coalesce(nullif(target.batting_style, ''), batting_style),
      bowling_style = coalesce(nullif(target.bowling_style, ''), bowling_style)
    where id = target.player_id;
  end if;
  return target;
end; $$;

revoke all on function public.update_bulk_auction_player_text(uuid, text, text, integer, text, text, text, boolean) from public, anon;
grant execute on function public.update_bulk_auction_player_text(uuid, text, text, integer, text, text, text, boolean) to authenticated;
