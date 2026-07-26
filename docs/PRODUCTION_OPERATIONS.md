# CrickPulse production operations

## Required GitHub secrets

Deployment:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Run `npm run verify:production-env` before every production build. The verifier checks that the Supabase URL is HTTPS and project-scoped, rejects Supabase secret/service-role keys in the public client variable, and detects suspicious `NEXT_PUBLIC_*` secret names.

Supabase now recommends a publishable key (`sb_publishable_...`) for browser clients. `NEXT_PUBLIC_SUPABASE_ANON_KEY` remains the application's compatibility variable name and may contain either a publishable key or a legacy `anon` JWT during migration. It must never contain `sb_secret_...` or a `service_role` JWT.

Environment scope:

- Production Vercel variables must point only to the production Supabase and Cloudinary projects.
- Preview variables should point to a separate staging Supabase project; never give preview deployments the production database URL.
- E2E credentials should belong to a dedicated staging admin and should only be configured in CI/local test environments.
- `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY`, Cloudinary API secret and Vercel token are server/CI secrets and must never use a `NEXT_PUBLIC_` prefix.

Monitoring:

- `PRODUCTION_URL` without a trailing slash
- `MONITOR_ALERT_WEBHOOK` (optional Slack/Teams-compatible JSON webhook)

Backups:

- `SUPABASE_DB_URL` — use the direct/pooler Postgres connection string kept only in GitHub secrets
- `BACKUP_ENCRYPTION_KEY` — at least 24 random characters, stored separately from downloaded backups

## Backup schedule and recovery

The backup workflow runs daily at 23:50 Asia/Colombo (18:20 UTC). It creates schema, role and data dumps, a paginated Cloudinary inventory for image/video/raw assets, and SHA-256 checksums. The bundle is encrypted with AES-256-CBC/PBKDF2, decrypted once inside the workflow as an integrity test, and retained for 30 days.

GitHub Actions currently has no repository secrets configured. Add every required secret before manually running the production workflows. Never paste database passwords, Cloudinary API secrets or encryption keys into source files.

To decrypt:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in crickpulse-backup-YYYY-MM-DD.tar.gz.enc \
  -out crickpulse-backup.tar.gz \
  -pass env:BACKUP_ENCRYPTION_KEY
tar -xzf crickpulse-backup.tar.gz
cd backup
sha256sum --check SHA256SUMS
```

Restore only into a new/staging Supabase project first. Never test a restore against the production database. Follow the current Supabase backup/restore guide; verify authentication, RLS, tournament counts, completed-match counts and media URLs before directing production traffic to it.

Monthly restore drill:

1. Download the latest encrypted artifact from GitHub Actions.
2. Decrypt it and verify `SHA256SUMS`.
3. Create a temporary Supabase development/staging project.
4. Restore `roles.sql`, `schema.sql`, then `data.sql`.
5. Sign in with a staging admin account.
6. Verify at least one tournament, team, player, completed scorecard and public ranking page.
7. Confirm RLS prevents one organizer from managing another organizer's tournament.
8. Record the drill date, artifact run ID, row counts and any recovery problems.
9. Delete the temporary project after the drill.

Cloudinary's manifest records all paginated asset IDs, delivery URLs, versions, sizes and metadata. Enable Cloudinary's own backup/versioning option for binary-level recovery; database backups and the inventory do not contain image bytes.

## Monitoring behavior

The monitor runs every ten minutes and validates both:

- `/api/health` returns JSON with application and database status `ok`.
- `/en` returns the expected CrickPulse landing-page signature.

Configure `MONITOR_ALERT_WEBHOOK` to receive failure messages. GitHub Actions also records a failed run even when no webhook is configured.

## Incident checklist

1. Check `/api/health` and the latest Production health monitor run.
2. Check Vercel function/deployment logs.
3. Check Supabase Database, Auth and Realtime status/logs.
4. Pause scorer handovers if database writes are degraded; offline scoring queues preserve pending balls.
5. Restore into staging, validate, then schedule production cutover.
