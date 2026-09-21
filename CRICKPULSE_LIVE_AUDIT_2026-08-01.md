# CrickPulse live audit — 2026-08-01

Production: https://cricket-zeta-jade.vercel.app/en  
Audited deployment: `0cdd038` (`READY`, Production)

## Executive result

The public site renders correctly on desktop and mobile and the local production build passes. The service is not fully healthy: `/api/health` returns HTTP 503 because the realtime check is unavailable and waits about 2.1 seconds. Authenticated uploads also generate a repeated database audit error. Tournament deletion currently remains unsafe until the pending soft-delete migration is applied to production.

## Critical findings

### P0 — Tournament Delete/Trash contract is not safely deployed

The required behavior is soft delete: move the tournament to View Trash, preserve teams, matches and all tournament data, and never delete players. Restore must return the same tournament and related data.

- A local migration, `supabase/migrations/20260801150000_soft_delete_tournament_to_trash.sql`, implements this behavior by updating only `tournaments.deleted_at`.
- The migration and matching UI changes are currently uncommitted and not in production.
- Until this migration is applied, production Delete must not be used because the currently installed RPC may still perform hard deletion or hit foreign-key/audit-log failures.

### P1 — Production health is degraded and adds about two seconds

`GET /api/health` returned HTTP 503:

- Database: OK, 68 ms
- Realtime: unavailable, 2067 ms
- Total health latency: 2073 ms
- Sentry: disabled

The realtime timeout is a concrete source of slowness and means realtime-dependent scoring/auction behavior needs focused verification after its connection/configuration is repaired.

### P1 — Upload audit writes fail in production

Vercel runtime errors show 9 occurrences of:

`upload_audit_failure { code: '22P02', action: 'Media Uploaded' }`

Root cause: `audit_logs.entity_id` is UUID, but `writeUploadAudit()` stores a Cloudinary `public_id` string in that field. The actual media upload may still return success because the audit function logs the error without throwing, but every affected upload performs a failed database write and loses its audit record.

Recommended fix: always generate a UUID for `entity_id`; retain the Cloudinary public ID inside `new_values.public_id`.

### P1 — Full admin create/submit workflows could not be safely live-tested

The test browser has no authenticated organizer session. `/en/admin` correctly redirects to `/en/login?error=session`. Therefore tournament creation, team/player admin submission, scoring mutations, poster export, registration approval and Trash restore were not executed against production. These require a test organizer account and disposable test tournament.

### P2 — Public data is fetched after initial render

The tournaments list and detail page perform client-side Supabase reads. The detail page initially showed `Loading tournament…`; usable public pages generally appeared in about 1.1–1.2 seconds in the audit browser. Server-rendering or caching public tournament summaries/details would reduce the visible loading state.

### P2 — Player registration cannot currently be exercised publicly

`/en/register-player` reports that registration is closed, so the public form, CAPTCHA, photo upload and final submission could not be tested. Enable registration for a disposable tournament before the end-to-end acceptance test.

### P3 — Registration label has encoding corruption

The source contains `WebP Ãƒâ€šÃ‚Â· max 5MB` instead of `WebP · max 5MB` in the photo field label.

### P3 — Test runner module warnings

All tests pass, but Node reparses several `.ts` modules because `package.json` has no module type. This is a warning and small test-start overhead, not a production failure.

## Verified working

- Latest Vercel production deployment is READY.
- Desktop landing page has no error overlay, broken images, or horizontal overflow.
- Mobile landing and public routes have no horizontal overflow or Next.js error overlay.
- Public routes tested: tournaments, tournament detail, teams, fixtures, rankings, points, statistics, hall of fame, compare and auction.
- Landing page currently displays live tournament/team/player counts and tournament content.
- Production security headers are present, including HSTS, CSP, frame denial, content-type protection, referrer and permissions policies.
- Local automated checks: 41/41 tests passed and TypeScript passed.
- Local Next.js production build completed successfully.

## Recommended acceptance sequence

1. Apply and deploy the soft-delete migration; verify Delete → View Trash → Restore with one disposable tournament and confirm player rows never change.
2. Fix the upload audit UUID mismatch and verify admin uploads plus public registration photo upload.
3. Repair the Supabase realtime health check/configuration; require `/api/health` to return 200 without a two-second timeout.
4. Sign in with a test organizer and execute one complete disposable flow: create tournament → create teams → add/register player → approve/assign → create match → score → poster download → trash/restore.
5. Consider server-rendering/caching public tournament data to remove initial loading states.

## Local workspace state at audit time

- Modified: `app/[locale]/admin/tournaments/page.tsx`
- Modified: `components/tournament-editor.tsx`
- Untracked: `supabase/migrations/20260801150000_soft_delete_tournament_to_trash.sql`
- Untracked accidental empty file: `gh` (must not be committed)

No audit-only code fix was deployed during this review.
