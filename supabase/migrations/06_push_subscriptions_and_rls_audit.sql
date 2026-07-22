-- CrickPulse production hardening: Web Push subscriptions and explicit ownership.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Public cricket data remains view-only. Mutations continue through the
-- organizer ownership policies in 05_organizer_ownership_and_access.sql.
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.innings enable row level security;
alter table public.ball_by_ball enable row level security;
alter table public.match_squads enable row level security;

drop policy if exists "Public read match squads" on public.match_squads;
create policy "Public read match squads" on public.match_squads for select to anon, authenticated using (true);
grant select on public.tournaments, public.teams, public.players, public.matches, public.innings, public.ball_by_ball, public.match_squads to anon;
