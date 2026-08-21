alter table public.teams add column if not exists fixture_order integer;

alter table public.teams drop constraint if exists teams_fixture_order_positive;
alter table public.teams add constraint teams_fixture_order_positive
  check (fixture_order is null or fixture_order > 0);

create unique index if not exists teams_tournament_fixture_order_unique
  on public.teams (tournament_id, fixture_order)
  where tournament_id is not null and fixture_order is not null and deleted_at is null;

update public.teams
set fixture_order = ordering.fixture_order
from (values
  ('5a166c34-b9ac-4404-ac7f-98e2cdaa3890'::uuid, 1),
  ('d138fb73-7f83-4ec6-9502-0b629cf0b69a'::uuid, 2),
  ('59fdea07-7117-4765-81d5-a5d333797b70'::uuid, 3),
  ('bd77e4d6-fb95-4b2d-9b9a-9d12f623cb0b'::uuid, 4),
  ('1fc5ddbc-1253-4d68-a03a-1996759ab06e'::uuid, 5),
  ('600230f7-c6c9-4ab5-a46b-26a76f610eef'::uuid, 6),
  ('13463796-56a9-4d48-903c-526b62ebb595'::uuid, 7),
  ('be8594cd-82d1-420f-a103-ffea22ad1fa1'::uuid, 8)
) as ordering(team_id, fixture_order)
where teams.id = ordering.team_id
  and teams.tournament_id = 'aa651c46-f308-41e4-8940-4222ee069b4a'::uuid;
