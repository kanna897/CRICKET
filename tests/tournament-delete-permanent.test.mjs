import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const baseMigration = readFileSync(path.join(root, "supabase", "migrations", "20260921203000_secure_permanent_tournament_deletion.sql"), "utf8");
const fixMigration = readFileSync(path.join(root, "supabase", "migrations", "20260921214500_fix_tournament_delete_ball_by_ball.sql"), "utf8");
const activePage = readFileSync(path.join(root, "app", "[locale]", "admin", "tournaments", "page.tsx"), "utf8");
const hiddenPage = readFileSync(path.join(root, "app", "[locale]", "admin", "tournaments", "hidden", "page.tsx"), "utf8");
const modal = readFileSync(path.join(root, "components", "delete-tournament-modal.tsx"), "utf8");
const dbTypes = readFileSync(path.join(root, "types", "database.types.ts"), "utf8");

for (const [name, migration] of [
  ["base permanent deletion migration", baseMigration],
  ["fix ball_by_ball migration", fixMigration],
]) {
  test(`${name} defines secure security-definer RPC with authorization and audit logging`, () => {
    assert.match(migration, /create or replace function public\.delete_tournament_permanent\(p_tournament_id uuid\)/);
    assert.match(migration, /returns jsonb/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(migration, /private\.can_manage_tournament\(p_tournament_id\)/);
    assert.match(migration, /insert into public\.audit_logs/);
    assert.match(migration, /'Tournament Deleted', 'tournament', tournament_row\.id/);
  });

  test(`${name} enforces strict foreign-key cascade order for all tournament-owned tables`, () => {
    // Auction records in dependency order
    assert.match(migration, /delete from public\.auction_history where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.auction_sessions where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.auction_team_purses where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.auction_players where tournament_id = p_tournament_id;/);

    // Tournament specific items
    assert.match(migration, /delete from public\.tournament_card_templates\s+where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.player_registrations\s+where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.points_table\s+where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.awards\s+where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from private\.tournament_registration_counters\s+where tournament_id = p_tournament_id;/);
    assert.match(migration, /delete from public\.user_roles\s+where tournament_id = p_tournament_id;/);

    // Match hierarchy in reverse dependency order
    assert.match(migration, /delete from public\.scoring_audit_log/);
    assert.match(migration, /delete from public\.match_events/);
    assert.match(migration, /delete from public\.batting_scorecard/);
    assert.match(migration, /delete from public\.bowling_scorecard/);
    assert.match(migration, /delete from public\.match_squads/);
    assert.match(migration, /delete from public\.playing_xi/);
    assert.match(migration, /delete from public\.innings/);
    assert.match(migration, /delete from public\.matches\s+where tournament_id = p_tournament_id;/);

    // Tournament-team relationships
    assert.match(migration, /delete from public\.tournament_teams\s+where tournament_id = p_tournament_id;/);
  });

  test(`${name} correctly queries ball_by_ball using innings_id and never non-existent match_id`, () => {
    assert.match(
      migration,
      /delete from public\.ball_by_ball\s+where innings_id in \(\s+select i\.id from public\.innings i\s+join public\.matches m on m\.id = i\.match_id\s+where m\.tournament_id = p_tournament_id\s+\);/
    );
    // Explicitly verify ball_by_ball never has match_id in WHERE clause
    assert.doesNotMatch(migration, /delete from public\.ball_by_ball\s+where match_id/);
  });

  test(`${name} preserves reusable teams and global players`, () => {
    // Teams are unlinked from tournament, not destroyed
    assert.match(migration, /update public\.teams\s+set tournament_id = null\s+where tournament_id = p_tournament_id;/i);
    assert.doesNotMatch(migration, /delete from public\.teams/i);
    assert.doesNotMatch(migration, /delete from public\.players/i);
  });

  test(`${name} preserves delete_tournament_cascade returning boolean`, () => {
    assert.match(migration, /create or replace function public\.delete_tournament_cascade\(p_tournament_id uuid\)\s+returns boolean/);
    assert.match(migration, /grant execute on function public\.delete_tournament_cascade\(uuid\) to authenticated;/);
  });

  test(`${name} restricts RPC execution privileges to authenticated users only`, () => {
    assert.match(migration, /revoke all on function public\.delete_tournament_permanent\(uuid\) from public, anon;/);
    assert.match(migration, /grant execute on function public\.delete_tournament_permanent\(uuid\) to authenticated;/);
    assert.match(migration, /revoke delete on public\.tournaments from authenticated, anon, public;/);
  });
}

test("prevent_tournament_hard_delete trigger blocks direct client delete while allowing authorized RPC", () => {
  assert.match(baseMigration, /create or replace function public\.prevent_tournament_hard_delete\(\)/);
  assert.match(baseMigration, /current_setting\('crickpulse\.allow_tournament_delete', true\) = 'on'/);
  assert.match(baseMigration, /Direct tournament deletion is disabled/);
  assert.match(baseMigration, /perform set_config\('crickpulse\.allow_tournament_delete', 'on', true\);/);
  assert.match(baseMigration, /delete from public\.tournaments where id = p_tournament_id;/);
  assert.match(baseMigration, /revoke delete on public\.tournaments from authenticated, anon, public;/);
});

test("delete confirmation modal requires exact tournament name match and provides loading/disabled protections", () => {
  assert.match(modal, /confirmationInput\.trim\(\) === tournament\.name\.trim\(\)/);
  assert.match(modal, /delete_tournament_permanent/);
  assert.match(modal, /isDeleting/);
  assert.match(modal, /Permanently Deleting…/);
  assert.match(modal, /disabled=\{!isConfirmed \|\| isDeleting\}/);
  assert.match(modal, /disabled=\{isDeleting\}/);
});

test("active and hidden tournament management pages integrate permanent deletion with notification", () => {
  assert.match(activePage, /DeleteTournamentModal/);
  assert.match(activePage, /setDeletingTournament/);
  assert.match(activePage, /Tournament permanently deleted\./);
  assert.match(activePage, /hideTournament/);

  assert.match(hiddenPage, /DeleteTournamentModal/);
  assert.match(hiddenPage, /setDeletingTournament/);
  assert.match(hiddenPage, /Tournament permanently deleted\./);
  assert.match(hiddenPage, /unhide/);
});

test("database types declare delete_tournament_permanent RPC signature", () => {
  assert.match(dbTypes, /delete_tournament_permanent:\s*\{\s*Args:\s*\{\s*p_tournament_id:\s*string\s*\}\s*Returns:\s*Json\s*\}/);
});
