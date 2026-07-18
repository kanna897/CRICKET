# Database Validation Report

## Schema Verification
- **Tables**: `tournaments`, `teams`, `players`, `matches`, `innings`, `ball_by_ball`, `awards` are all verified and exist in `database.types.ts`.
- **Foreign Keys**: Enforced. Example: `matches` correctly reference `teams` (team1_id, team2_id) and `tournaments` (tournament_id).
- **Constraints**: Phone numbers acting as a unique constraint to prevent duplicate players is enforced at the schema and application level (handled during bulk import).

## Storage Buckets
- `logos`: Configured for Team and Tournament graphics.
- `player_photos`: Configured for individual player headshots.
- `posters`: Configured for saving generated match summaries.

## RLS & Realtime
- **Realtime**: Publications are enabled for `matches`, `innings`, and `ball_by_ball` to power the live public website.
- **Row Level Security**: Policies are configured to allow public reads but restrict writes to authenticated Admin sessions.
