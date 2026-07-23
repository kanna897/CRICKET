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

Monitoring:

- `PRODUCTION_URL` without a trailing slash
- `MONITOR_ALERT_WEBHOOK` (optional Slack/Teams-compatible JSON webhook)

Backups:

- `SUPABASE_DB_URL` — use the direct/pooler Postgres connection string kept only in GitHub secrets
- `BACKUP_ENCRYPTION_KEY` — at least 24 random characters, stored separately from downloaded backups

## Backup schedule and recovery

The backup workflow runs daily at 23:50 Asia/Colombo (18:20 UTC). It creates schema, role and data dumps plus a Cloudinary asset manifest, encrypts the bundle with AES-256-CBC/PBKDF2 and retains it for seven days.

To decrypt:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in crickpulse-backup-YYYY-MM-DD.tar.gz.enc \
  -out crickpulse-backup.tar.gz \
  -pass env:BACKUP_ENCRYPTION_KEY
tar -xzf crickpulse-backup.tar.gz
```

Restore only into a new/staging Supabase project first. Follow the current Supabase backup/restore guide; verify authentication, RLS, tournament counts, completed-match counts and media URLs before directing production traffic to it.

Cloudinary's manifest records asset IDs and delivery URLs. Enable Cloudinary's own backup/versioning option for binary-level recovery; database backups do not contain image bytes.

## Incident checklist

1. Check `/api/health` and the latest Production health monitor run.
2. Check Vercel function/deployment logs.
3. Check Supabase Database, Auth and Realtime status/logs.
4. Pause scorer handovers if database writes are degraded; offline scoring queues preserve pending balls.
5. Restore into staging, validate, then schedule production cutover.
