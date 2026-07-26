create policy "Service role manages registration lookup limits"
  on private.registration_lookup_limits
  for all
  to service_role
  using (true)
  with check (true);
