-- Match the portrait crop used by Team Squads (308% zoom at 11% 45%) so the
-- saved player photo is a real square portrait rather than the full card.

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
    then replace(
      regexp_replace(
        p_url,
        '/image/upload/(c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/)?',
        '/image/upload/'
      ),
      '/image/upload/',
      '/image/upload/c_crop,x_80,y_328,w_351,h_351/c_fill,w_1200,h_1200,q_auto,f_auto/'
    )
    else p_url
  end;
$$;

-- Correct every profile already created by a completed bulk auction.
update public.players player
set photo_url = private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type)
from public.auction_players auction_player
where auction_player.player_id = player.id
  and auction_player.status = 'sold'
  and auction_player.source_type = 'bulk_upload'
  and player.photo_url is distinct from private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type);

