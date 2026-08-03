alter table public.auction_players
  add column if not exists contact_number text;

drop function if exists public.update_bulk_auction_player_text(uuid, text, text, integer);

create or replace function public.update_bulk_auction_player_text(
  p_auction_player_id uuid,
  p_player_name text,
  p_playing_role text,
  p_registration_number integer default null,
  p_contact_number text default null
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
  clean_phone text := btrim(coalesce(p_contact_number, ''));
  phone_digits text;
begin
  select * into target
  from public.auction_players
  where id = p_auction_player_id
  for update;

  if target.id is null or target.source_type <> 'bulk_upload' then
    raise exception 'Bulk auction player not found';
  end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if clean_name = '' then raise exception 'OCR did not find a player name'; end if;
  if clean_role = '' then clean_role := 'Player'; end if;
  if p_registration_number is not null and p_registration_number < 1 then
    raise exception 'S.NO must be greater than zero';
  end if;

  phone_digits := regexp_replace(clean_phone, '[^0-9]+', '', 'g');
  if char_length(phone_digits) not between 7 and 15 then clean_phone := ''; end if;

  update public.auction_players
  set player_name = left(clean_name, 255),
      playing_role = left(clean_role, 50),
      contact_number = coalesce(nullif(clean_phone, ''), contact_number),
      ocr_serial_number = coalesce(p_registration_number, ocr_serial_number),
      updated_at = now()
  where id = target.id
  returning * into target;

  if target.player_id is not null then
    update public.players
    set name = target.player_name,
        player_name = target.player_name,
        playing_role = target.playing_role,
        phone_number = coalesce(target.contact_number, phone_number),
        contact_number = coalesce(target.contact_number, contact_number)
    where id = target.player_id;
  end if;

  return target;
end;
$$;

revoke all on function public.update_bulk_auction_player_text(
  uuid, text, text, integer, text
) from public, anon;
grant execute on function public.update_bulk_auction_player_text(
  uuid, text, text, integer, text
) to authenticated;

create or replace function private.sync_auction_player_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.player_id is not null
    and char_length(regexp_replace(coalesce(new.contact_number, ''), '[^0-9]+', '', 'g')) between 7 and 15 then
    update public.players
    set phone_number = new.contact_number,
        contact_number = new.contact_number
    where id = new.player_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_auction_player_contact on public.auction_players;
create trigger sync_auction_player_contact
after insert or update of player_id, contact_number
on public.auction_players
for each row execute function private.sync_auction_player_contact();

