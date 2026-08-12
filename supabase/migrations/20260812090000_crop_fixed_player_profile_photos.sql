-- Fixed-player uploads use the same finished auction-card image format as bulk
-- uploads. Keep the original card on auction_players, but expose only the
-- portrait crop through players.photo_url after assignment.

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
    when p_source_type in ('bulk_upload', 'fixed_upload')
      and p_url like 'https://res.cloudinary.com/%/image/upload/%'
    then replace(
      regexp_replace(
        p_url,
        '/image/upload/(c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/|c_crop,x_80,y_328,w_351,h_351/c_fill,w_(800,h_1000|1200,h_1200),q_auto,f_auto/)?',
        '/image/upload/'
      ),
      '/image/upload/',
      '/image/upload/c_crop,x_80,y_328,w_351,h_351/c_fill,w_1200,h_1200,q_auto,f_auto/'
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
  if new.status in ('sold', 'fixed') and new.player_id is not null then
    update public.players
    set photo_url = private.auction_profile_photo_url(new.photo_url, new.source_type)
    where id = new.player_id
      and photo_url is distinct from private.auction_profile_photo_url(new.photo_url, new.source_type);
  end if;

  return new;
end;
$$;

-- Repair fixed players assigned before this migration was applied.
update public.players player
set photo_url = private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type)
from public.auction_players auction_player
where auction_player.player_id = player.id
  and auction_player.status = 'fixed'
  and auction_player.source_type = 'fixed_upload'
  and player.photo_url is distinct from private.auction_profile_photo_url(auction_player.photo_url, auction_player.source_type);

