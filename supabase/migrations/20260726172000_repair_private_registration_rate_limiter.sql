create or replace function public.consume_registration_lookup_attempt(
  p_identifier_hash text,
  p_max_attempts integer default 5,
  p_window interval default interval '10 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row private.registration_lookup_limits%rowtype;
begin
  if p_identifier_hash is null
    or length(p_identifier_hash) <> 64
    or p_max_attempts < 1
    or p_window < interval '1 minute'
  then
    return false;
  end if;

  insert into private.registration_lookup_limits (
    identifier_hash,
    window_started_at,
    attempts,
    updated_at
  )
  values (p_identifier_hash, now(), 1, now())
  on conflict (identifier_hash) do update
  set
    window_started_at = case
      when private.registration_lookup_limits.window_started_at <= now() - p_window
        then now()
      else private.registration_lookup_limits.window_started_at
    end,
    attempts = case
      when private.registration_lookup_limits.window_started_at <= now() - p_window
        then 1
      else private.registration_lookup_limits.attempts + 1
    end,
    updated_at = now()
  returning * into current_row;

  return current_row.attempts <= p_max_attempts;
end;
$$;

revoke all on function public.consume_registration_lookup_attempt(text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.consume_registration_lookup_attempt(text, integer, interval)
  to service_role;
