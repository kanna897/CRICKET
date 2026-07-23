alter table public.matches
  add column if not exists competition_stage text not null default 'league',
  add column if not exists bracket_round smallint,
  add column if not exists bracket_slot smallint;

alter table public.matches
  drop constraint if exists matches_competition_stage_check;

alter table public.matches
  add constraint matches_competition_stage_check
  check (competition_stage in ('league', 'knockout'));

create unique index if not exists matches_knockout_slot_key
  on public.matches (tournament_id, bracket_round, bracket_slot)
  where competition_stage = 'knockout';

create index if not exists matches_bracket_lookup_idx
  on public.matches (tournament_id, competition_stage, bracket_round, bracket_slot);
