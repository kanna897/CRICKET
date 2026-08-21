import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { isActivePublicMatch } from "../lib/public-match-visibility.ts";

const root = process.cwd();
const migration = readFileSync(path.join(root, "supabase", "migrations", "20260801170000_tournament_hide_unhide_safety.sql"), "utf8");
const activePage = readFileSync(path.join(root, "app", "[locale]", "admin", "tournaments", "page.tsx"), "utf8");
const hiddenPage = readFileSync(path.join(root, "app", "[locale]", "admin", "tournaments", "hidden", "page.tsx"), "utf8");
const editor = readFileSync(path.join(root, "components", "tournament-editor.tsx"), "utf8");

test("tournament lifecycle RPCs update only the tournament visibility field", () => {
  assert.match(migration, /create or replace function public\.hide_tournament/);
  assert.match(migration, /create or replace function public\.unhide_tournament/);
  assert.match(migration, /set deleted_at = hidden_at/);
  assert.match(migration, /set deleted_at = null/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
  assert.doesNotMatch(migration, /update\s+public\.(?:players|teams|matches|innings|ball_by_ball)/i);
});

test("hard tournament deletion is blocked at RPC, privilege and trigger boundaries", () => {
  assert.match(migration, /Tournament deletion is disabled\. Use Hide Tournament instead\./);
  assert.match(migration, /before delete on public\.tournaments/);
  assert.match(migration, /revoke delete on public\.tournaments from authenticated/);
  assert.match(migration, /revoke all on function public\.delete_tournament_cascade\(uuid\) from public, anon, authenticated/);
});

test("production broad public read policies are replaced by active-parent policies", () => {
  const legacyPublicPolicies = [
    ["tournaments_read_public", "tournaments"],
    ["teams_read_public", "teams"],
    ["tournament_teams_read_public", "tournament_teams"],
    ["matches_read_public", "matches"],
    ["innings_read_public", "innings"],
    ["ball_by_ball_read_public", "ball_by_ball"],
    ["match_squads_read_public", "match_squads"],
    ["points_table_read_public", "points_table"],
    ["awards_read_public", "awards"],
  ];

  for (const [policy, table] of legacyPublicPolicies) {
    assert.match(migration, new RegExp(`drop policy if exists ${policy} on public\\.${table}`));
  }
  assert.match(migration, /create policy "Public Read Active Tournaments"[\s\S]*using \(deleted_at is null\)/);
  assert.match(migration, /create policy "Public Read Active Tournament Matches"[\s\S]*t\.deleted_at is null/);
  assert.match(migration, /create policy "Public Read Active Tournament Innings"[\s\S]*t\.deleted_at is null/);
  assert.match(migration, /create policy "Public Read Active Tournament Deliveries"[\s\S]*t\.deleted_at is null/);
});

test("admin tournament UI exposes only Hide and Unhide terminology", () => {
  assert.match(activePage, /Hide Tournament/);
  assert.match(hiddenPage, /Hidden Tournaments/);
  assert.match(hiddenPage, /Unhide Tournament/);
  assert.doesNotMatch(activePage + hiddenPage + editor, /Delete tournament|View Trash|Move .* Trash/i);
  assert.doesNotMatch(activePage + hiddenPage + editor, /delete_tournament_cascade/);
});

test("hide audit uses the tournament UUID and preserves upload UUID safety", () => {
  assert.match(migration, /'Tournament Hidden', 'tournament', tournament_row\.id/);
  assert.match(migration, /'Tournament Unhidden', 'tournament', tournament_row\.id/);
  const uploadSecurity = readFileSync(path.join(root, "lib", "cloudinary-upload-security.ts"), "utf8");
  assert.match(uploadSecurity, /entity_id: crypto\.randomUUID\(\)/);
  assert.match(uploadSecurity, /public_id: input\.upload\?\.publicId/);
});

test("public tournament pages enforce active parent visibility on the server", () => {
  const listPage = readFileSync(path.join(root, "app", "[locale]", "(public)", "tournaments", "page.tsx"), "utf8");
  const detailPage = readFileSync(path.join(root, "app", "[locale]", "(public)", "tournaments", "[id]", "page.tsx"), "utf8");
  assert.doesNotMatch(listPage + detailPage, /useEffect|use client/);
  assert.match(listPage, /is\("deleted_at", null\)/);
  assert.match(detailPage, /is\("deleted_at", null\)/);
  assert.match(detailPage, /notFound\(\)/);
});

test("all public match routes are protected by an active-parent server guard", () => {
  const helper = readFileSync(path.join(root, "lib", "public-match.ts"), "utf8");
  const layout = readFileSync(path.join(root, "app", "[locale]", "(public)", "match", "[id]", "layout.tsx"), "utf8");
  const publicRoutes = [
    ["page.tsx"],
    ["scorecard", "page.tsx"],
    ["analytics", "page.tsx"],
    ["teamsheet", "page.tsx"],
  ];

  assert.match(helper, /select\("id,tournament_id,match_scope,is_public,tournaments\(deleted_at\)"\)/);
  assert.match(helper, /if \(error \|\| !isActivePublicMatch/);
  assert.match(layout, /await getActivePublicMatchById\(id\)/);
  assert.match(layout, /notFound\(\)/);
  for (const route of publicRoutes) {
    const page = readFileSync(path.join(root, "app", "[locale]", "(public)", "match", "[id]", ...route), "utf8");
    assert.match(page, /await getActivePublicMatchById\(id\)/);
    assert.match(page, /notFound\(\)/);
  }
});

test("active and standalone matches remain public", () => {
  assert.equal(isActivePublicMatch({ id: "active", tournament_id: "tournament-a", tournaments: { deleted_at: null } }), true);
  assert.equal(isActivePublicMatch({ id: "standalone", tournament_id: null, tournaments: null }), true);
  assert.equal(isActivePublicMatch({ id: "hidden-standalone", tournament_id: null, match_scope: "standalone", is_public: false, tournaments: null }), false);
});

test("hidden parent visibility denies authenticated owners and missing parents", () => {
  assert.equal(isActivePublicMatch({ id: "hidden", tournament_id: "tournament-a", tournaments: { deleted_at: "2026-08-01T12:00:00Z" } }), false);
  assert.equal(isActivePublicMatch({ id: "rls-hidden", tournament_id: "tournament-a", tournaments: null }), false);
  assert.equal(isActivePublicMatch(null), false);

  const helper = readFileSync(path.join(root, "lib", "public-match.ts"), "utf8");
  assert.doesNotMatch(helper, /auth\.uid|organizer_id|from\("players"\)|from\("teams"\)|update\(|delete\(/);
});

test("upload audit exceptions are contained and never rethrown", () => {
  const uploadSecurity = readFileSync(path.join(root, "lib", "cloudinary-upload-security.ts"), "utf8");
  const auditFunction = uploadSecurity.slice(uploadSecurity.indexOf("export async function writeUploadAudit"));
  assert.match(auditFunction, /try \{/);
  assert.match(auditFunction, /catch \(error\)/);
  assert.match(auditFunction, /upload_audit_failure/);
  assert.match(auditFunction, /entity_id: crypto\.randomUUID\(\)/);
  assert.doesNotMatch(auditFunction, /throw error/);
});

test("fixtures and stats loaders exclude hidden parents on the server", () => {
  const fixturesPage = readFileSync(path.join(root, "app", "[locale]", "(public)", "fixtures", "page.tsx"), "utf8");
  const fixturesClient = readFileSync(path.join(root, "app", "[locale]", "(public)", "fixtures", "fixtures-client.tsx"), "utf8");
  const statsPage = readFileSync(path.join(root, "app", "[locale]", "(public)", "stats", "page.tsx"), "utf8");
  const statsClient = readFileSync(path.join(root, "components", "stats-match-analytics.tsx"), "utf8");

  for (const page of [fixturesPage, statsPage]) {
    assert.match(page, /tournaments\(deleted_at\)/);
    assert.match(page, /filter\(isActivePublicMatch\)/);
    assert.match(page, /createSupabaseServerClient/);
  }
  assert.doesNotMatch(fixturesClient, /from\("matches"\)/);
  assert.match(statsClient, /from\("tournaments"\)\.select\("id"\)\.is\("deleted_at", null\)/);
  assert.match(statsClient, /tournament_id\.is\.null,tournament_id\.in/);
});

test("admin team and match lists require an active tournament parent", () => {
  const teamsPage = readFileSync(path.join(root, "app", "[locale]", "admin", "teams", "page.tsx"), "utf8");
  const matchesPage = readFileSync(path.join(root, "app", "[locale]", "admin", "matches", "page.tsx"), "utf8");

  for (const page of [teamsPage, matchesPage]) {
    assert.match(page, /from\("tournaments"\)[\s\S]*is\("deleted_at", null\)/);
  }
  assert.match(teamsPage, /team\.tournament_id[\s\S]{0,100}ids\.includes\(team\.tournament_id\)/);
  assert.match(matchesPage, /team\.tournament_id[\s\S]{0,100}ids\.includes\(team\.tournament_id\)/);
  assert.match(matchesPage, /match\.tournament_id[\s\S]*ids\.includes\(match\.tournament_id\)/);
  assert.doesNotMatch(teamsPage, /isMasterAdmin \|\| ids\.includes\(team\.tournament_id/);
  assert.doesNotMatch(matchesPage, /isMasterAdmin \|\| ids\.includes\(match\.tournament_id/);
});

test("active fixtures and analytics preserve standalone matches", () => {
  const rows = [
    { id: "active", tournament_id: "tournament-a", tournaments: { deleted_at: null } },
    { id: "hidden", tournament_id: "tournament-b", tournaments: { deleted_at: "2026-08-01T12:00:00Z" } },
    { id: "standalone", tournament_id: null, tournaments: null },
  ];
  assert.deepEqual(rows.filter(isActivePublicMatch).map((row) => row.id), ["active", "standalone"]);
});

test("registration status service-role lookup hides inactive tournaments", () => {
  const edgeFunction = readFileSync(path.join(root, "supabase", "functions", "player-registration-status", "index.ts"), "utf8");
  assert.match(edgeFunction, /tournaments!inner\(name,deleted_at\)/);
  assert.match(edgeFunction, /is\("tournaments\.deleted_at", null\)/);
  assert.match(edgeFunction, /if \(!data\) \{\s*return json\(\{ found: false \}\)/);
  assert.doesNotMatch(edgeFunction, /update\(|delete\(/);
});
