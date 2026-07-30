# Playwright E2E suite

Start the application in one terminal, then run Playwright in another:

```bash
npm run dev
# second terminal
npm run test:e2e
```

CI can set `E2E_BASE_URL` to an already-running preview deployment.

The full suite creates disposable Supabase Auth users and cricket data, runs
the workflows, and removes the seeded tournament and users in global teardown.
Use a non-production Supabase project and set:

```text
E2E_RUN_FULL=true
E2E_SUPABASE_SERVICE_ROLE_KEY=...
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_ORGANIZER_EMAIL=...
E2E_ORGANIZER_PASSWORD=...
E2E_SCORER_EMAIL=...
E2E_SCORER_PASSWORD=...
```

Never prefix the service-role key with `NEXT_PUBLIC_`. The seed client exists
only in Playwright's Node process; it is never bundled into the application.

The full suite covers admin login, tournament/team/player creation, organizer
and scorer authorization, live match setup, scoring, undo, innings and match
completion, auction controls, public live score, and signed-out access.
