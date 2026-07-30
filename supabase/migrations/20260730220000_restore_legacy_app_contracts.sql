-- Restore API objects still used by the application but absent from the
-- timestamped production migration history.

alter table public.matches
  add column if not exists match_number integer;

create index if not exists matches_tournament_match_number_idx
  on public.matches (tournament_id, match_number);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'tournament_admin', 'scorer', 'viewer')),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists user_roles_global_role_idx
  on public.user_roles (user_id, role)
  where tournament_id is null;
create unique index if not exists user_roles_tournament_role_idx
  on public.user_roles (user_id, tournament_id, role)
  where tournament_id is not null;

alter table public.user_roles enable row level security;
drop policy if exists "Users read own roles" on public.user_roles;
create policy "Users read own roles"
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  ip_address text,
  device_browser text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_at_idx
  on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists "Users insert own audit logs" on public.audit_logs;
create policy "Users insert own audit logs"
  on public.audit_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Super admins read audit logs" on public.audit_logs;
create policy "Super admins read audit logs"
  on public.audit_logs for select to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'super_admin'
    )
  );
revoke all on public.audit_logs from anon;
grant select, insert on public.audit_logs to authenticated;

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
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
