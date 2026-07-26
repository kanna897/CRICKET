# CrickPulse Project Audit

Date: 26 July 2026
Scope: application architecture, cricket scoring, Supabase, security, UI/theme, localization, PWA, testing, CI/CD, monitoring and backup.
Audit mode: read-only. No product or database fixes were applied during this audit.

## Executive assessment

CrickPulse has broad functional coverage and a strong visual/product foundation, but it is not yet production-safe for paid multi-organizer use.

| Area | Score | Assessment |
| --- | ---: | --- |
| Feature coverage | 86% | Strong |
| UI, responsive design and themes | 78% | Good, needs systematic accessibility QA |
| Cricket scoring capability | 76% | Broad rules coverage, but transaction and edge-case risks remain |
| Security and tenant isolation | 62% | RLS enabled; three live security warnings require remediation |
| Database performance | 55% | Missing FK indexes and duplicate/overlapping policies |
| Code quality and maintainability | 43% | Type escapes and large monolithic components |
| Automated testing | 28% | Only nine contract tests; little behavioral or rules testing |
| Deployment and operations | 30% | Quality, monitor and backup workflows currently fail |
| Overall production readiness | **58%** | Beta/demo ready; not yet commercial production ready |

## What is already strong

- Public and admin experiences cover tournaments, teams, players, matches, scorecards, points, statistics, analytics, comparison, awards, rankings and brackets.
- Three application roles are represented: master admin, organizer and public viewer.
- English, Tamil and Sinhala routes/messages exist.
- PWA manifest, offline scoring queue, health endpoint, CI, deployment, monitoring and encrypted backup workflows exist.
- Cloudinary upload signing is server-side and validates media kind, MIME type and file size.
- All currently exposed public Supabase tables reported `rls_enabled: true`.
- Scoring supports extras, free hits, several dismissal types, undo/redo, shot zones, commentary, voice scoring, scorer handover and second-innings target logic.
- TypeScript compilation passes.

## Critical findings

### P0 — Release pipeline is red

- The latest GitHub quality runs failed during `npm ci` because `package.json` and `package-lock.json` were not synchronized.
- The current lockfile still resolves `@swc/helpers` 0.5.15 while a dependency declares `>=0.5.17`, so a clean-install verification is required.
- A production deployment must not proceed until a clean `npm ci`, lint, test and build all pass in CI.

### P0 — Production monitoring and backup are not operational

- The production health monitor fails because `PRODUCTION_URL` is empty.
- The encrypted backup workflow fails because `SUPABASE_DB_URL` and `BACKUP_ENCRYPTION_KEY` are empty.
- Cloudinary backup is only a manifest of up to 500 image assets, not a backup of original media files.
- There is no verified restore drill.

### P0 — Scoring writes are not atomic

- A delivery is inserted into `ball_by_ball`, followed by a separate update to `innings`.
- If the ball insert succeeds and the innings update fails, score state can become inconsistent.
- Undo also deletes the ball and restores innings in separate operations.
- Match completion, player-of-match assignment and second-innings creation are separate client-driven writes.
- These operations should be moved into authenticated database RPC transactions with idempotency keys and audit entries.

### P0 — Supabase security advisor warnings

The live Supabase security advisor reported:

1. `public.lookup_player_registration(...)` is a `SECURITY DEFINER` function executable by `anon`.
2. The same function is executable by `authenticated`.
3. Supabase leaked-password protection is disabled.

The registration lookup may intentionally be public, but its privileges, search path, returned columns, rate limiting and brute-force resistance must be reviewed.

## High-priority findings

### P1 — Lint baseline fails

Scoped ESLint result:

- 136 errors
- 69 warnings
- 205 total findings

Main causes:

- 167 `as any` type escapes across the codebase.
- Generated database types are stale and do not include newer tables such as player registrations and scoring audit data.
- React effect/state warnings.
- Many raw `<img>` elements that bypass Next image optimization.
- Unused values and hook dependency issues.

### P1 — Test coverage is too shallow

- There are only nine tests.
- Most tests read source files and check whether routes or text strings exist.
- No reliable tests cover delivery scoring, extras, strike rotation, wickets, free hits, innings completion, ties, all-out NRR, undo/redo, offline replay, concurrent scorers, RLS isolation or ranking calculations.
- No end-to-end browser suite is part of CI.

### P1 — Cricket rule consistency is fragmented

- Dismissal-credit logic is duplicated in multiple files.
- Some code excludes only `run_out` when crediting bowler wickets, while other code correctly excludes a larger set of non-bowler dismissals.
- The hat-trick check uses a better limited set, so displayed bowling wickets, player-of-match calculations and statistics can disagree.
- Net run rate and points are calculated in several locations rather than one authoritative engine.
- Rankings are ICC-inspired tournament ratings, not the proprietary ICC algorithm; this distinction is correctly disclosed but needs localization.

### P1 — Scoring page is a monolith

- The main scoring page is approximately 71 KB and combines data loading, scoring rules, persistence, offline sync, speech, commentary, UI and modals.
- This increases regression risk and makes cricket-rule testing difficult.
- It should be separated into a pure scoring engine, transactional persistence layer, hooks/state machine and presentational components.

### P1 — Database performance warnings

The live Supabase performance advisor reported:

- Many unindexed foreign keys, including high-traffic `ball_by_ball`, `innings`, `matches`, scorecard and squad relationships.
- Duplicate indexes on `matches.tournament_id` and `players.team_id`.
- Multiple permissive SELECT policies on many public tables, causing every applicable policy to be evaluated.
- Several currently unused indexes. These should not be removed until production query history is representative.

Supabase remediation reference: https://supabase.com/docs/guides/database/database-linter

## Medium-priority findings

### P2 — Authorization is split between UI and RLS

- Admin layout verifies the user and application role.
- Many client components still query and mutate Supabase directly.
- Correctness therefore depends heavily on every RLS policy remaining accurate.
- Sensitive operations should use server actions or API/RPC boundaries and repeat ownership checks server-side.

### P2 — Public media upload abuse controls

- Public player-registration uploads are appropriately restricted to enabled tournaments and signed Cloudinary folders.
- Missing controls: rate limiting, CAPTCHA/abuse protection, image dimension validation, malware/content moderation and abandoned-upload cleanup.

### P2 — Localization is incomplete

- Locale routing exists for English, Tamil and Sinhala.
- A significant amount of feature text remains hard-coded in English, including newer rankings and scoring controls.
- Dates, numbers, pluralization and cricket terminology need locale-aware formatting and review by native speakers.

### P2 — Accessibility and responsive QA are informal

- Light/dark tokens are generally used, and recent ranking pages have readable contrast.
- There is no automated accessibility testing.
- Tables, modals, live score announcements, keyboard focus, reduced motion and mobile overflow need systematic tests.

### P2 — Repository and migration hygiene

- The worktree contains many uncommitted feature changes.
- Migration names mix timestamped and non-timestamped formats and contain both original and “fixed” migrations with the same numeric prefix.
- Generated database types are older than recent migrations.
- A `.next-backup-*` build directory exists locally and caused broad lint scanning to take excessively long because ESLint ignores `.next/**` but not `.next-backup*/**`.

## Recommended implementation order

### Phase 1 — Production safety gate

1. Synchronize dependencies and lockfile; make clean `npm ci` pass.
2. Fix CI quality build and require it before merge/deploy.
3. Configure production health, backup and deployment secrets.
4. Fix Supabase security advisor warnings and enable leaked-password protection.
5. Add transaction-safe scoring RPCs for record, undo and finalize.
6. Add database constraints and idempotency protection.

### Phase 2 — Cricket correctness

1. Extract one pure international-rules scoring engine.
2. Centralize bowler-credit dismissal rules, extras, free hit, strike rotation, innings and match completion.
3. Add rule-focused unit tests and historical scorecard fixtures.
4. Add concurrent-scorer and offline-replay integration tests.
5. Reconcile points, NRR, statistics, awards and rankings against the same completed-match source.

### Phase 3 — Maintainability and database performance

1. Regenerate Supabase TypeScript types and remove priority `as any` usage.
2. Split the scoring monolith.
3. Add missing foreign-key indexes based on real query paths.
4. consolidate duplicate indexes and overlapping RLS policies.
5. Establish migration naming and verification standards.

### Phase 4 — Product quality

1. Complete Tamil and Sinhala strings.
2. Add Playwright end-to-end tests for public, organizer and master-admin journeys.
3. Add automated accessibility checks and mobile viewport coverage.
4. Optimize images and high-traffic queries.
5. Add error monitoring, structured logs and product analytics.

### Phase 5 — New commercial features

Only after Phases 1–4:

- Cross-tournament player career history.
- Team head-to-head history.
- Qualification simulator and win-probability improvements.
- Organizer subscriptions, quotas and billing.
- Native Android/iOS packaging.

## Verification performed

- Project route and source inventory.
- Git status and recent commit review.
- TypeScript: passed.
- Automated tests: 9/9 passed.
- ESLint: failed with 136 errors and 69 warnings.
- Live Supabase table/RLS inventory.
- Live Supabase security and performance advisors.
- GitHub Actions status and failed-job log inspection.
- Production build was not run locally because the active development server shares the `.next` output directory; the latest CI quality build is already failing before build at `npm ci`.
- Dependency vulnerability audit was not completed because it requires transmitting the dependency inventory to the external npm registry.

## Go/no-go decision

**No-go for paid production launch today.**

The application is suitable for continued controlled beta/testing. The next implementation should be the Phase 1 production safety gate, starting with clean-install/CI recovery and transaction-safe scoring—not another end-user feature.
