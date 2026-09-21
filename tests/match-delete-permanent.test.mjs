import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(path.join(root, "supabase", "migrations", "20260921221500_secure_permanent_match_deletion.sql"), "utf8");
const matchesPage = readFileSync(path.join(root, "app", "[locale]", "admin", "matches", "page.tsx"), "utf8");
const modal = readFileSync(path.join(root, "components", "delete-match-modal.tsx"), "utf8");
const dbTypes = readFileSync(path.join(root, "types", "database.types.ts"), "utf8");

test("match delete migration defines secure security-definer RPC with authorization and audit logging", () => {
  assert.match(migration, /create or replace function public\.delete_match_permanent\(p_match_id uuid\)/);
  assert.match(migration, /returns jsonb/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /if actor_id is null then\s+raise exception 'Authentication required';/);
  assert.match(migration, /private\.can_manage_match\(p_match_id\)/);
  assert.match(migration, /insert into public\.audit_logs/);
  assert.match(migration, /'Match Deleted', 'match', match_row\.id/);
});

test("match delete migration enforces strict foreign-key cascade order for match child records", () => {
  // Audit and events
  assert.match(migration, /delete from public\.scoring_audit_log\s+where match_id = p_match_id\s+or innings_id in \(select id from public\.innings where match_id = p_match_id\);/);
  assert.match(migration, /delete from public\.match_events\s+where match_id = p_match_id\s+or innings_id in \(select id from public\.innings where match_id = p_match_id\);/);

  // Scorecards and deliveries via innings_id
  assert.match(
    migration,
    /delete from public\.ball_by_ball\s+where innings_id in \(\s+select id\s+from public\.innings\s+where match_id = p_match_id\s+\);/
  );
  assert.match(
    migration,
    /delete from public\.batting_scorecard\s+where innings_id in \(\s+select id\s+from public\.innings\s+where match_id = p_match_id\s+\);/
  );
  assert.match(
    migration,
    /delete from public\.bowling_scorecard\s+where innings_id in \(\s+select id\s+from public\.innings\s+where match_id = p_match_id\s+\);/
  );

  // Squads and playing XI
  assert.match(migration, /delete from public\.match_squads\s+where match_id = p_match_id;/);
  assert.match(migration, /delete from public\.playing_xi\s+where match_id = p_match_id;/);

  // Innings and match
  assert.match(migration, /delete from public\.innings\s+where match_id = p_match_id;/);
  assert.match(migration, /delete from public\.matches\s+where id = p_match_id;/);
});

test("match delete migration never references non-existent ball_by_ball.match_id", () => {
  assert.doesNotMatch(migration, /delete from public\.ball_by_ball\s+where match_id/);
  assert.doesNotMatch(migration, /ball_by_ball\.match_id/);
});

test("match delete migration preserves shared entities (players, teams, tournaments)", () => {
  assert.doesNotMatch(migration, /delete from public\.players/i);
  assert.doesNotMatch(migration, /delete from public\.teams/i);
  assert.doesNotMatch(migration, /delete from public\.tournaments/i);
  assert.doesNotMatch(migration, /delete from public\.profiles/i);
});

test("match delete migration restricts RPC execution privileges to authenticated users only", () => {
  assert.match(migration, /revoke all on function public\.delete_match_permanent\(uuid\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.delete_match_permanent\(uuid\) to authenticated;/);
});

test("delete match modal requires confirmation and provides loading/disabled protections", () => {
  assert.match(modal, /confirmationInput\.trim\(\)\.toUpperCase\(\) === confirmTarget/);
  assert.match(modal, /delete_match_permanent/);
  assert.match(modal, /isDeleting/);
  assert.match(modal, /Permanently Deleting…/);
  assert.match(modal, /disabled=\{!isConfirmed \|\| isDeleting\}/);
  assert.match(modal, /disabled=\{isDeleting\}/);
});

test("matches admin page integrates permanent match deletion with notification", () => {
  assert.match(matchesPage, /DeleteMatchModal/);
  assert.match(matchesPage, /setDeletingMatch/);
  assert.match(matchesPage, /permanently deleted\./);
  assert.match(matchesPage, /toggleStandaloneVisibility/);
  assert.match(matchesPage, /Trash2/);
});

test("database types declare delete_match_permanent RPC signature", () => {
  assert.match(dbTypes, /delete_match_permanent:\s*\{\s*Args:\s*\{\s*p_match_id:\s*string\s*\}\s*Returns:\s*Json\s*\}/);
});
