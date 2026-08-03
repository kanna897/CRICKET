-- Bulk auction inventory stores the uploaded card as its source image. Once a
-- player is sold, keep that card for auction downloads but save a subject crop
-- as the player's reusable profile photo.

create or replace function private.auction_profile_photo_url(
  p_url text,
  p_source_type text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source_type = 'bulk_upload'
      and p_url like 'https://res.cloudinary.com/%/image/upload/%'
      and p_url not like '%/c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/%'
    then replace(
      p_url,
      '/image/upload/',
      '/image/upload/c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/'
    )
    else p_url
  end;
$$;

create or replace function private.sync_auction_player_profile_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sold' and new.player_id is not null then
    update public.players
    set photo_url = private.auction_profile_photo_url(new.photo_url, new.source_type)
    where id = new.player_id
      and photo_url is distinct from private.auction_profile_photo_url(new.photo_url, new.source_type);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_auction_player_profile_photo
  on public.auction_players;

create trigger sync_auction_player_profile_photo
after insert or update of status, player_id, photo_url
on public.auction_players
for each row
execute function private.sync_auction_player_profile_photo();

-- Repair profiles created by completed bulk auctions before this migration.
update public.players player
set photo_url = private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type)
from public.auction_players auction_player
where auction_player.player_id = player.id
  and auction_player.status = 'sold'
  and auction_player.source_type = 'bulk_upload'
  and player.photo_url is distinct from private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type);

