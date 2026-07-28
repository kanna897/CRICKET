-- CrickPulse Live Player Auction
-- Additive schema: existing tournament, registration, team, player and scoring
-- tables retain their current behavior.

create table if not exists public.card_templates (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  template_type text not null check (template_type in ('player', 'team_player')),
  image_url text not null,
  public_id text,
  is_visible boolean not null default true,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_card_templates (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  player_template_id uuid references public.card_templates(id) on delete set null,
  team_player_template_id uuid references public.card_templates(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (player_template_id is not null or team_player_template_id is not null)
);

alter table public.player_registrations
  add column if not exists registration_number integer,
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists player_card_url text;

with numbered as (
  select id, row_number() over (
    partition by tournament_id order by created_at, id
  )::integer as number
  from public.player_registrations
  where registration_number is null
)
update public.player_registrations registration
set registration_number = numbered.number
from numbered
where numbered.id = registration.id;

create unique index if not exists player_registrations_tournament_number_key
  on public.player_registrations(tournament_id, registration_number);

create table if not exists private.tournament_registration_counters (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  last_number integer not null default 0 check (last_number >= 0)
);

insert into private.tournament_registration_counters (tournament_id, last_number)
select tournament_id, coalesce(max(registration_number), 0)
from public.player_registrations
group by tournament_id
on conflict (tournament_id) do update
set last_number = greatest(
  private.tournament_registration_counters.last_number,
  excluded.last_number
);

create or replace function private.assign_tournament_registration_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.registration_number is null then
    insert into private.tournament_registration_counters (tournament_id, last_number)
    values (new.tournament_id, 1)
    on conflict (tournament_id) do update
      set last_number = private.tournament_registration_counters.last_number + 1
    returning last_number into new.registration_number;
  end if;
  return new;
end;
$$;

revoke all on function private.assign_tournament_registration_number() from public;
drop trigger if exists assign_tournament_registration_number on public.player_registrations;
create trigger assign_tournament_registration_number
before insert on public.player_registrations
for each row execute function private.assign_tournament_registration_number();

alter table public.player_registrations
  alter column registration_number set not null;

create table if not exists public.auction_sessions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'live', 'paused', 'completed')),
  current_auction_player_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auction_team_purses (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  initial_purse numeric(14,2) not null default 0 check (initial_purse >= 0),
  total_spent numeric(14,2) not null default 0 check (total_spent >= 0),
  purchased_count integer not null default 0 check (purchased_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, team_id),
  check (total_spent <= initial_purse)
);

create table if not exists public.auction_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  registration_id uuid not null unique references public.player_registrations(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  registration_number integer not null,
  player_name text not null,
  photo_url text not null,
  playing_role text not null,
  batting_style text not null,
  bowling_style text not null,
  status text not null default 'available'
    check (status in ('available', 'live', 'sold', 'unsold')),
  winning_team_id uuid references public.teams(id) on delete set null,
  winning_bid numeric(14,2) check (winning_bid is null or winning_bid >= 0),
  sold_at timestamptz,
  player_card_url text,
  team_player_card_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auction_sessions
  drop constraint if exists auction_sessions_current_auction_player_id_fkey,
  add constraint auction_sessions_current_auction_player_id_fkey
    foreign key (current_auction_player_id)
    references public.auction_players(id) on delete set null;

create table if not exists public.auction_history (
  id bigint generated by default as identity primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  auction_player_id uuid not null references public.auction_players(id) on delete cascade,
  registration_id uuid not null references public.player_registrations(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  bid_amount numeric(14,2),
  action text not null check (action in ('live', 'sold', 'unsold', 'reopened')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_templates_owner_type
  on public.card_templates(organizer_id, template_type, is_visible);
create index if not exists idx_auction_players_tournament_status
  on public.auction_players(tournament_id, status, created_at);
create index if not exists idx_auction_history_tournament_created
  on public.auction_history(tournament_id, created_at desc);
create index if not exists idx_auction_team_purses_tournament
  on public.auction_team_purses(tournament_id);

insert into public.auction_players (
  tournament_id, registration_id, player_id, registration_number,
  player_name, photo_url, playing_role, batting_style, bowling_style,
  status, player_card_url
)
select
  registration.tournament_id,
  registration.id,
  registration.player_id,
  registration.registration_number,
  registration.player_name,
  registration.photo_url,
  registration.playing_role,
  registration.batting_style,
  registration.bowling_style,
  'available',
  registration.player_card_url
from public.player_registrations registration
on conflict (registration_id) do nothing;

create or replace function private.create_auction_player_for_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auction_players (
    tournament_id, registration_id, player_id, registration_number,
    player_name, photo_url, playing_role, batting_style, bowling_style,
    status, player_card_url
  )
  values (
    new.tournament_id, new.id, new.player_id, new.registration_number,
    new.player_name, new.photo_url, new.playing_role, new.batting_style,
    new.bowling_style, 'available', new.player_card_url
  )
  on conflict (registration_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_auction_player_for_registration() from public;
drop trigger if exists create_auction_player_for_registration on public.player_registrations;
create trigger create_auction_player_for_registration
after insert on public.player_registrations
for each row execute function private.create_auction_player_for_registration();

create or replace function public.set_auction_player_live(p_auction_player_id uuid)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
begin
  select * into target
  from public.auction_players
  where id = p_auction_player_id
  for update;

  if target.id is null then raise exception 'Auction player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if target.status in ('sold', 'unsold') then
    raise exception 'Completed auction players must be reopened first';
  end if;

  insert into public.auction_sessions (tournament_id, status, started_at)
  values (target.tournament_id, 'live', now())
  on conflict (tournament_id) do update
  set status = 'live',
      started_at = coalesce(public.auction_sessions.started_at, now()),
      ended_at = null,
      updated_at = now();

  update public.auction_players
  set status = 'available', updated_at = now()
  where tournament_id = target.tournament_id
    and status = 'live'
    and id <> target.id;

  update public.auction_players
  set status = 'live', updated_at = now()
  where id = target.id
  returning * into target;

  update public.auction_sessions
  set current_auction_player_id = target.id, updated_at = now()
  where tournament_id = target.tournament_id;

  insert into public.auction_history (
    tournament_id, auction_player_id, registration_id, action, created_by
  ) values (
    target.tournament_id, target.id, target.registration_id, 'live', auth.uid()
  );

  return target;
end;
$$;

create or replace function public.sell_auction_player(
  p_auction_player_id uuid,
  p_team_id uuid,
  p_winning_bid numeric
)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
  registration public.player_registrations;
  target_player_id uuid;
  purse public.auction_team_purses;
begin
  if p_winning_bid is null or p_winning_bid < 0 then
    raise exception 'Winning bid must be zero or greater';
  end if;

  select * into target
  from public.auction_players
  where id = p_auction_player_id
  for update;
  if target.id is null then raise exception 'Auction player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if target.status not in ('available', 'live') then
    raise exception 'Player is already completed';
  end if;
  if not exists (
    select 1 from public.teams team
    where team.id = p_team_id
      and team.tournament_id = target.tournament_id
  ) then
    raise exception 'Selected team does not belong to this tournament';
  end if;

  select * into purse
  from public.auction_team_purses
  where tournament_id = target.tournament_id and team_id = p_team_id
  for update;
  if purse.team_id is null then raise exception 'Configure the team purse first'; end if;
  if purse.initial_purse - purse.total_spent < p_winning_bid then
    raise exception 'Winning bid exceeds the remaining purse';
  end if;

  select * into registration
  from public.player_registrations
  where id = target.registration_id
  for update;

  target_player_id := coalesce(target.player_id, registration.player_id);
  if target_player_id is null then
    insert into public.players (
      name, player_name, phone_number, contact_number, photo_url,
      playing_role, role, batting_style, bowling_style,
      jersey_name, jersey_number, team_id
    ) values (
      registration.player_name,
      registration.player_name,
      registration.contact_number,
      registration.contact_number,
      registration.photo_url,
      registration.playing_role,
      case registration.playing_role
        when 'all_rounder' then 'all-rounder'
        when 'wicket_keeper' then 'wicket-keeper'
        else registration.playing_role
      end,
      registration.batting_style,
      registration.bowling_style,
      registration.jersey_name,
      registration.jersey_number,
      p_team_id
    )
    returning id into target_player_id;
  else
    update public.players set team_id = p_team_id where id = target_player_id;
  end if;

  update public.player_registrations
  set player_id = target_player_id,
      preferred_team_id = p_team_id,
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = target.registration_id;

  update public.auction_team_purses
  set total_spent = total_spent + p_winning_bid,
      purchased_count = purchased_count + 1,
      updated_at = now()
  where tournament_id = target.tournament_id and team_id = p_team_id;

  update public.auction_players
  set player_id = target_player_id,
      status = 'sold',
      winning_team_id = p_team_id,
      winning_bid = p_winning_bid,
      sold_at = now(),
      updated_at = now()
  where id = target.id
  returning * into target;

  update public.auction_sessions
  set current_auction_player_id = null, updated_at = now()
  where tournament_id = target.tournament_id;

  insert into public.auction_history (
    tournament_id, auction_player_id, registration_id,
    team_id, bid_amount, action, created_by
  ) values (
    target.tournament_id, target.id, target.registration_id,
    p_team_id, p_winning_bid, 'sold', auth.uid()
  );

  return target;
end;
$$;

create or replace function public.mark_auction_player_unsold(p_auction_player_id uuid)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
begin
  select * into target
  from public.auction_players
  where id = p_auction_player_id
  for update;
  if target.id is null then raise exception 'Auction player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if target.status = 'sold' then raise exception 'Sold player cannot be marked unsold'; end if;

  update public.auction_players
  set status = 'unsold', winning_team_id = null, winning_bid = null,
      sold_at = null, updated_at = now()
  where id = target.id returning * into target;

  update public.auction_sessions
  set current_auction_player_id = null, updated_at = now()
  where tournament_id = target.tournament_id
    and current_auction_player_id = target.id;

  insert into public.auction_history (
    tournament_id, auction_player_id, registration_id, action, created_by
  ) values (
    target.tournament_id, target.id, target.registration_id, 'unsold', auth.uid()
  );
  return target;
end;
$$;

create or replace function public.reopen_auction_player(p_auction_player_id uuid)
returns public.auction_players
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.auction_players;
begin
  select * into target from public.auction_players
  where id = p_auction_player_id for update;
  if target.id is null then raise exception 'Auction player not found'; end if;
  if not private.can_manage_tournament(target.tournament_id) then
    raise exception 'Unauthorized';
  end if;
  if target.status = 'sold' then raise exception 'Sold players cannot be reopened'; end if;

  update public.auction_players
  set status = 'available', winning_team_id = null, winning_bid = null,
      sold_at = null, updated_at = now()
  where id = target.id returning * into target;
  insert into public.auction_history (
    tournament_id, auction_player_id, registration_id, action, created_by
  ) values (
    target.tournament_id, target.id, target.registration_id, 'reopened', auth.uid()
  );
  return target;
end;
$$;

create or replace function public.get_registration_card_payload(
  p_registration_id uuid,
  p_tracking_code text
)
returns table (
  registration_id uuid,
  tournament_id uuid,
  player_name text,
  contact_number text,
  photo_url text,
  playing_role text,
  batting_style text,
  bowling_style text,
  registration_number integer,
  template_url text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    registration.id,
    registration.tournament_id,
    registration.player_name,
    registration.contact_number,
    registration.photo_url,
    registration.playing_role,
    registration.batting_style,
    registration.bowling_style,
    registration.registration_number,
    template.image_url
  from public.player_registrations registration
  left join public.tournament_card_templates choice
    on choice.tournament_id = registration.tournament_id
  left join public.card_templates template
    on template.id = choice.player_template_id
   and template.is_visible
  where registration.id = p_registration_id
    and registration.tracking_code = upper(trim(p_tracking_code))
  limit 1;
$$;

create or replace function public.save_registration_card_url(
  p_registration_id uuid,
  p_tracking_code text,
  p_card_url text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.player_registrations
  set player_card_url = p_card_url
  where id = p_registration_id
    and tracking_code = upper(trim(p_tracking_code));
  update public.auction_players auction_player
  set player_card_url = p_card_url, updated_at = now()
  where auction_player.registration_id = p_registration_id
    and exists (
      select 1 from public.player_registrations registration
      where registration.id = p_registration_id
        and registration.tracking_code = upper(trim(p_tracking_code))
    );
  return found;
end;
$$;

revoke all on function public.set_auction_player_live(uuid) from public, anon;
revoke all on function public.sell_auction_player(uuid, uuid, numeric) from public, anon;
revoke all on function public.mark_auction_player_unsold(uuid) from public, anon;
revoke all on function public.reopen_auction_player(uuid) from public, anon;
grant execute on function public.set_auction_player_live(uuid) to authenticated;
grant execute on function public.sell_auction_player(uuid, uuid, numeric) to authenticated;
grant execute on function public.mark_auction_player_unsold(uuid) to authenticated;
grant execute on function public.reopen_auction_player(uuid) to authenticated;
revoke all on function public.get_registration_card_payload(uuid, text) from public;
revoke all on function public.save_registration_card_url(uuid, text, text) from public;
grant execute on function public.get_registration_card_payload(uuid, text) to anon, authenticated;
grant execute on function public.save_registration_card_url(uuid, text, text) to anon, authenticated;

alter table public.card_templates enable row level security;
alter table public.tournament_card_templates enable row level security;
alter table public.auction_sessions enable row level security;
alter table public.auction_team_purses enable row level security;
alter table public.auction_players enable row level security;
alter table public.auction_history enable row level security;

create policy "Visible card templates are public"
on public.card_templates for select to anon, authenticated
using (is_visible or organizer_id = (select auth.uid()) or (select private.is_master_admin()));
create policy "Owners manage card templates"
on public.card_templates for all to authenticated
using (organizer_id = (select auth.uid()) or (select private.is_master_admin()))
with check (organizer_id = (select auth.uid()) or (select private.is_master_admin()));

create policy "Tournament template choices are public"
on public.tournament_card_templates for select to anon, authenticated using (true);
create policy "Owners manage tournament template choices"
on public.tournament_card_templates for all to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check (
  (select private.can_manage_tournament(tournament_id))
  and (
    player_template_id is null or exists (
      select 1 from public.card_templates template
      where template.id = player_template_id and template.is_visible
    )
  )
  and (
    team_player_template_id is null or exists (
      select 1 from public.card_templates template
      where template.id = team_player_template_id and template.is_visible
    )
  )
);

create policy "Auction sessions are public"
on public.auction_sessions for select to anon, authenticated using (true);
create policy "Owners manage auction sessions"
on public.auction_sessions for all to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check ((select private.can_manage_tournament(tournament_id)));

create policy "Auction purses are public"
on public.auction_team_purses for select to anon, authenticated using (true);
create policy "Owners manage auction purses"
on public.auction_team_purses for all to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check (
  (select private.can_manage_tournament(tournament_id))
  and exists (
    select 1 from public.teams team
    where team.id = team_id and team.tournament_id = tournament_id
  )
);

create policy "Auction players are public"
on public.auction_players for select to anon, authenticated using (true);
create policy "Owners manage auction players"
on public.auction_players for all to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check ((select private.can_manage_tournament(tournament_id)));

create policy "Auction history is public"
on public.auction_history for select to anon, authenticated using (true);
create policy "Owners manage auction history"
on public.auction_history for all to authenticated
using ((select private.can_manage_tournament(tournament_id)))
with check ((select private.can_manage_tournament(tournament_id)));

grant select on public.card_templates, public.tournament_card_templates,
  public.auction_sessions, public.auction_team_purses,
  public.auction_players, public.auction_history to anon;
grant select, insert, update, delete on public.card_templates,
  public.tournament_card_templates, public.auction_sessions,
  public.auction_team_purses, public.auction_players,
  public.auction_history to authenticated;
grant usage, select on sequence public.auction_history_id_seq to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'auction_sessions', 'auction_team_purses', 'auction_players', 'auction_history'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
