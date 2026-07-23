-- Retry-safe delivery IDs and immutable scoring audit history.

alter table public.ball_by_ball
  add column if not exists client_event_id uuid,
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

update public.ball_by_ball set client_event_id = gen_random_uuid()
where client_event_id is null;
alter table public.ball_by_ball alter column client_event_id set default gen_random_uuid();
alter table public.ball_by_ball alter column client_event_id set not null;
create unique index if not exists ball_by_ball_client_event_id_key
  on public.ball_by_ball(client_event_id);

create table if not exists public.scoring_audit_log (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_id uuid references public.innings(id) on delete set null,
  ball_id uuid,
  client_event_id uuid,
  action text not null check (action in ('record', 'correct', 'undo')),
  before_data jsonb,
  after_data jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_scoring_audit_match_created
  on public.scoring_audit_log(match_id, created_at desc);
alter table public.scoring_audit_log enable row level security;

create or replace function private.capture_ball_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.ball_by_ball;
  source_match_id uuid;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select i.match_id into source_match_id
  from public.innings i
  where i.id = source_row.innings_id;

  insert into public.scoring_audit_log (
    match_id, innings_id, ball_id, client_event_id, action,
    before_data, after_data, actor_id
  )
  values (
    source_match_id,
    source_row.innings_id,
    source_row.id,
    source_row.client_event_id,
    case tg_op when 'INSERT' then 'record' when 'UPDATE' then 'correct' else 'undo' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    (select auth.uid())
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.capture_ball_audit() from public;
drop trigger if exists capture_ball_audit on public.ball_by_ball;
create trigger capture_ball_audit
after insert or update or delete on public.ball_by_ball
for each row execute function private.capture_ball_audit();

drop policy if exists "Owners view scoring audit" on public.scoring_audit_log;
create policy "Owners view scoring audit"
  on public.scoring_audit_log for select to authenticated
  using ((select private.can_manage_tournament((
    select m.tournament_id from public.matches m
    where m.id = scoring_audit_log.match_id
  ))));

revoke all on public.scoring_audit_log from anon;
grant select on public.scoring_audit_log to authenticated;

