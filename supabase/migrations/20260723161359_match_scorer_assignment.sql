alter table public.matches
  add column if not exists assigned_scorer_id uuid references public.profiles(id) on delete set null,
  add column if not exists scoring_locked boolean not null default false;

-- Trigger-only function: it must never be callable through the Data API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

update public.matches m
set assigned_scorer_id = t.organizer_id
from public.tournaments t
where t.id = m.tournament_id
  and m.assigned_scorer_id is null;

create index if not exists idx_matches_assigned_scorer_id
  on public.matches(assigned_scorer_id);

create or replace function private.can_score_match(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_master_admin())
    or exists (
      select 1
      from public.matches m
      join public.tournaments t on t.id = m.tournament_id
      where m.id = target_match_id
        and (
          m.assigned_scorer_id = (select auth.uid())
          or (
            not m.scoring_locked
            and t.organizer_id = (select auth.uid())
          )
        )
    );
$$;

revoke all on function private.can_score_match(uuid) from public;
grant execute on function private.can_score_match(uuid) to authenticated;

drop policy if exists "Owners manage innings" on public.innings;
create policy "Authorized scorers manage innings"
  on public.innings for all to authenticated
  using ((select private.can_score_match(match_id)))
  with check ((select private.can_score_match(match_id)));

drop policy if exists "Owners manage ball by ball" on public.ball_by_ball;
create policy "Authorized scorers manage ball by ball"
  on public.ball_by_ball for all to authenticated
  using ((select private.can_score_match((
    select i.match_id from public.innings i where i.id = ball_by_ball.innings_id
  ))))
  with check ((select private.can_score_match((
    select i.match_id from public.innings i where i.id = ball_by_ball.innings_id
  ))));

drop policy if exists "Owners manage match events" on public.match_events;
create policy "Authorized scorers manage match events"
  on public.match_events for all to authenticated
  using ((select private.can_score_match(match_id)))
  with check ((select private.can_score_match(match_id)));

-- Match ownership remains unchanged. Only the tournament owner/master can
-- assign or lock a scorer and can update match-level result/toss fields.
grant select, insert, update, delete on public.matches, public.innings, public.ball_by_ball, public.match_events to authenticated;
