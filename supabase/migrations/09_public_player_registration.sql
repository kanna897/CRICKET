alter table public.tournaments
  add column if not exists player_registration_enabled boolean not null default false;

create table if not exists public.player_registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  preferred_team_id uuid references public.teams(id) on delete set null,
  player_name text not null check (char_length(btrim(player_name)) between 2 and 100),
  contact_number text not null check (char_length(btrim(contact_number)) between 7 and 30),
  photo_url text not null,
  playing_role text not null check (playing_role in ('batsman', 'bowler', 'all_rounder', 'wicket_keeper')),
  batting_style text not null,
  bowling_style text not null,
  jersey_name text not null check (char_length(btrim(jersey_name)) between 1 and 30),
  jersey_number integer not null check (jersey_number between 0 and 999),
  consent_given boolean not null check (consent_given),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_registrations_tournament_status
  on public.player_registrations(tournament_id, status, created_at desc);

alter table public.player_registrations enable row level security;

drop policy if exists "Public can submit enabled registrations" on public.player_registrations;
create policy "Public can submit enabled registrations"
on public.player_registrations for insert
to anon, authenticated
with check (
  status = 'pending'
  and consent_given
  and exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and t.player_registration_enabled
      and t.deleted_at is null
  )
  and (
    preferred_team_id is null
    or exists (
      select 1
      from public.teams tm
      where tm.id = preferred_team_id
        and tm.tournament_id = player_registrations.tournament_id
        and tm.deleted_at is null
    )
  )
);

drop policy if exists "Managers can read tournament registrations" on public.player_registrations;
create policy "Managers can read tournament registrations"
on public.player_registrations for select
to authenticated
using ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Managers can review tournament registrations" on public.player_registrations;
create policy "Managers can review tournament registrations"
on public.player_registrations for update
to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check ((select private.can_manage_tournament(tournament_id)));

drop policy if exists "Managers can delete tournament registrations" on public.player_registrations;
create policy "Managers can delete tournament registrations"
on public.player_registrations for delete
to authenticated
using ((select private.can_manage_tournament(tournament_id)));

grant select (id, name, player_registration_enabled) on public.tournaments to anon;
grant select (id, name, tournament_id) on public.teams to anon;
grant insert on public.player_registrations to anon, authenticated;
grant select, update, delete on public.player_registrations to authenticated;

-- Registration photos are stored in Cloudinary. Only the resulting secure URL
-- is persisted in player_registrations.photo_url.
