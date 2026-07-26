create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  short_name text check (short_name is null or char_length(trim(short_name)) between 2 and 20),
  location text,
  logo_url text,
  website_url text,
  social_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  start_date date,
  end_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, name),
  check (end_date is null or start_date is null or end_date >= start_date)
);

alter table public.tournaments
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists season_id uuid references public.club_seasons(id) on delete set null;

create index if not exists idx_clubs_organizer_id on public.clubs(organizer_id);
create index if not exists idx_club_seasons_club_id on public.club_seasons(club_id);
create index if not exists idx_tournaments_club_season on public.tournaments(club_id, season_id);

alter table public.clubs enable row level security;
alter table public.club_seasons enable row level security;

drop policy if exists "Club owners can manage clubs" on public.clubs;
create policy "Club owners can manage clubs" on public.clubs
for all to authenticated
using (organizer_id = (select auth.uid()) or (select private.is_master_admin()))
with check (organizer_id = (select auth.uid()) or (select private.is_master_admin()));

drop policy if exists "Club owners can manage seasons" on public.club_seasons;
create policy "Club owners can manage seasons" on public.club_seasons
for all to authenticated
using (exists (
  select 1 from public.clubs
  where clubs.id = club_seasons.club_id
    and (clubs.organizer_id = (select auth.uid()) or (select private.is_master_admin()))
))
with check (exists (
  select 1 from public.clubs
  where clubs.id = club_seasons.club_id
    and (clubs.organizer_id = (select auth.uid()) or (select private.is_master_admin()))
));

grant select, insert, update, delete on public.clubs to authenticated;
grant select, insert, update, delete on public.club_seasons to authenticated;

comment on table public.clubs is 'Long-lived cricket organisations spanning multiple seasons and tournaments.';
comment on table public.club_seasons is 'Season containers used to group a club''s tournaments and history.';
