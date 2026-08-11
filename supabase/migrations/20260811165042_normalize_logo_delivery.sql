-- Store Cloudinary logos with whitespace trimmed and a consistent contain canvas.
-- This keeps arbitrary tournament/team logo shapes inside every UI and poster frame.
update public.tournaments
set logo_url = replace(
  logo_url,
  '/image/upload/',
  '/image/upload/e_trim:12,c_fit,w_512,h_512,q_auto,f_auto/'
)
where logo_url like 'https://res.cloudinary.com/%/image/upload/%'
  and logo_url not like '%/e_trim:%';

update public.teams
set logo_url = replace(
  logo_url,
  '/image/upload/',
  '/image/upload/e_trim:12,c_fit,w_512,h_512,q_auto,f_auto/'
)
where logo_url like 'https://res.cloudinary.com/%/image/upload/%'
  and logo_url not like '%/e_trim:%';
