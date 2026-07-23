alter table public.player_registrations
  add column if not exists tracking_code text
  default upper(encode(gen_random_bytes(6), 'hex'));

update public.player_registrations
set tracking_code = upper(encode(gen_random_bytes(6), 'hex'))
where tracking_code is null;

alter table public.player_registrations
  alter column tracking_code set not null;

create unique index if not exists player_registrations_tracking_code_key
  on public.player_registrations (tracking_code);

create unique index if not exists player_registrations_active_contact_key
  on public.player_registrations (
    tournament_id,
    regexp_replace(contact_number, '[^0-9]+', '', 'g')
  )
  where status in ('pending', 'approved');

create or replace function public.lookup_player_registration(
  p_tracking_code text,
  p_contact_number text
)
returns table (
  player_name text,
  tournament_name text,
  registration_status text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    registration.player_name,
    tournament.name,
    registration.status::text,
    registration.review_note,
    registration.created_at,
    registration.reviewed_at
  from public.player_registrations as registration
  join public.tournaments as tournament
    on tournament.id = registration.tournament_id
  where registration.tracking_code = upper(trim(p_tracking_code))
    and regexp_replace(registration.contact_number, '[^0-9]+', '', 'g')
      = regexp_replace(p_contact_number, '[^0-9]+', '', 'g')
  limit 1;
$$;

revoke all on function public.lookup_player_registration(text, text) from public;
grant execute on function public.lookup_player_registration(text, text) to anon, authenticated;
