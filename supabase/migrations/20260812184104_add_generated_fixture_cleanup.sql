alter table public.matches
  add column if not exists fixture_source text,
  add column if not exists generation_batch_id uuid;

alter table public.matches drop constraint if exists matches_fixture_source_check;
alter table public.matches add constraint matches_fixture_source_check
  check (fixture_source is null or fixture_source in ('auto'));

create index if not exists matches_generation_batch_idx
  on public.matches (tournament_id, generation_batch_id)
  where generation_batch_id is not null;

create or replace function public.delete_unplayed_generated_fixtures(p_tournament_id uuid, p_match_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare requested_count integer; selected_count integer; deleted_count integer;
begin
  if not private.can_manage_tournament(p_tournament_id) then raise exception 'Unauthorized'; end if;
  select count(distinct id) into requested_count from unnest(coalesce(p_match_ids, array[]::uuid[])) as selected(id);
  if requested_count < 1 then raise exception 'Select at least one generated fixture'; end if;
  perform 1 from public.matches where tournament_id = p_tournament_id and id = any(p_match_ids) for update;
  select count(*) into selected_count from public.matches where tournament_id = p_tournament_id and id = any(p_match_ids);
  if selected_count <> requested_count then raise exception 'One or more selected fixtures do not belong to this tournament'; end if;
  if exists (
    select 1 from public.matches match where match.tournament_id = p_tournament_id and match.id = any(p_match_ids) and (
      match.match_scope <> 'tournament' or match.status <> 'scheduled'
      or match.winner_id is not null or match.result_type is not null
      or exists (select 1 from public.innings where match_id = match.id)
      or exists (
        select 1 from public.ball_by_ball ball
        join public.innings innings on innings.id = ball.innings_id
        where innings.match_id = match.id
      )
      or exists (select 1 from public.scoring_audit_log where match_id = match.id)
      or exists (select 1 from public.match_squads where match_id = match.id)
    )
  ) then raise exception 'Only scheduled tournament fixtures with no team sheet or scoring data can be removed'; end if;
  delete from public.matches where tournament_id = p_tournament_id and id = any(p_match_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_unplayed_generated_fixtures(uuid, uuid[]) from public, anon;
grant execute on function public.delete_unplayed_generated_fixtures(uuid, uuid[]) to authenticated;
