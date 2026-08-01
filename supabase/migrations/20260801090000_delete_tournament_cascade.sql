-- Delete tournament-owned data atomically while retaining player profiles.
create or replace function public.delete_tournament_cascade(p_tournament_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.can_manage_tournament(p_tournament_id)) then
    raise exception 'You are not allowed to delete this tournament';
  end if;

  update public.players
  set team_id = null,
      updated_at = now()
  where team_id in (
    select id from public.teams where tournament_id = p_tournament_id
  );

  delete from public.tournaments where id = p_tournament_id;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

revoke all on function public.delete_tournament_cascade(uuid) from public;
grant execute on function public.delete_tournament_cascade(uuid) to authenticated;
