-- Custom teams and players entered while scheduling a standalone match are
-- real scoring participants, but never reusable roster or career entities.
alter table public.teams
  add column if not exists standalone_match_id uuid references public.matches(id) on delete cascade;

alter table public.players
  add column if not exists standalone_match_id uuid references public.matches(id) on delete cascade;

create index if not exists idx_teams_standalone_match_id
  on public.teams(standalone_match_id) where standalone_match_id is not null;

create index if not exists idx_players_standalone_match_id
  on public.players(standalone_match_id) where standalone_match_id is not null;

-- A custom participant can only belong to an independent match. This blocks
-- accidental use in tournament fixtures at the database boundary.
create or replace function private.assert_standalone_participant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.standalone_match_id is not null and not exists (
    select 1 from public.matches match
    where match.id = new.standalone_match_id and match.match_scope = 'standalone'
  ) then
    raise exception 'Custom participants can only belong to a standalone match.';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_standalone_participant_scope on public.teams;
create trigger teams_standalone_participant_scope
  before insert or update of standalone_match_id on public.teams
  for each row execute function private.assert_standalone_participant_scope();

drop trigger if exists players_standalone_participant_scope on public.players;
create trigger players_standalone_participant_scope
  before insert or update of standalone_match_id on public.players
  for each row execute function private.assert_standalone_participant_scope();
