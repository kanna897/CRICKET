alter table public.matches
  add column if not exists fixture_round integer;

alter table public.matches
  drop constraint if exists matches_fixture_round_positive;

alter table public.matches
  add constraint matches_fixture_round_positive
  check (fixture_round is null or fixture_round > 0);

create index if not exists matches_fixture_round_lookup_idx
  on public.matches (tournament_id, fixture_round, match_number)
  where fixture_round is not null;
