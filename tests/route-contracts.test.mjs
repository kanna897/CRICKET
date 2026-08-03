import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const routes = [
  "app/[locale]/(public)/players/[id]/page.tsx",
  "app/[locale]/(public)/tournaments/page.tsx",
  "app/[locale]/(public)/tournaments/[id]/page.tsx",
  "app/[locale]/(public)/match/[id]/teamsheet/page.tsx",
  "app/[locale]/(public)/compare/page.tsx",
  "app/[locale]/(public)/register-player/page.tsx",
  "app/[locale]/(public)/rankings/page.tsx",
  "app/[locale]/(public)/statistics/page.tsx",
  "app/[locale]/admin/players/import/page.tsx",
  "app/[locale]/admin/player-registrations/page.tsx",
  "app/[locale]/admin/settings/page.tsx",
  "app/[locale]/admin/rankings/page.tsx",
];

test("required viewer and admin routes exist", () => {
  for (const route of routes) assert.equal(existsSync(resolve(root, route)), true, `${route} must exist`);
});

test("legacy statistics route preserves locale and redirects to stats", () => {
  const statistics = readFileSync(resolve(root, "app/[locale]/(public)/statistics/page.tsx"), "utf8");
  assert.match(statistics, /redirect\(`\/\$\{locale\}\/stats`\)/);
});

test("PWA manifest is valid and standalone", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, "public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "CrickPulse");
  assert.ok(manifest.icons.length >= 2);
});

test("public navigation exposes discovery and comparison", () => {
  const nav = readFileSync(resolve(root, "components/public-nav.tsx"), "utf8");
  assert.match(nav, /\/tournaments/);
  assert.match(nav, /\/compare/);
  assert.match(nav, /Player Registration/);
  assert.match(nav, /Hide/);
  assert.match(nav, /Unhide/);
});

test("production responses define the complete security header baseline", () => {
  const config = readFileSync(resolve(root, "next.config.ts"), "utf8");
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Cross-Origin-Embedder-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
  assert.match(config, /https:\/\/\*\.supabase\.co/);
  assert.match(config, /wss:\/\/\*\.supabase\.co/);
  assert.match(config, /https:\/\/res\.cloudinary\.com/);
  assert.match(config, /connect-src[^\n]*https:\/\/res\.cloudinary\.com/);
  assert.match(config, /https:\/\/challenges\.cloudflare\.com/);
});

test("SEO exposes localized discovery and dynamic entity metadata", () => {
  const sitemap = readFileSync(resolve(root, "app/sitemap.ts"), "utf8");
  const robots = readFileSync(resolve(root, "app/robots.ts"), "utf8");
  const seo = readFileSync(resolve(root, "lib/seo.ts"), "utf8");
  assert.match(sitemap, /tournaments/);
  assert.match(sitemap, /matches/);
  assert.match(sitemap, /teams/);
  assert.match(sitemap, /players/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /admin/);
  assert.match(seo, /openGraph/);
  assert.match(seo, /twitter/);
  assert.match(seo, /languageAlternates/);
  for (const entity of ["tournaments", "match", "teams", "players"]) {
    const layout = readFileSync(
      resolve(root, `app/[locale]/(public)/${entity}/[id]/layout.tsx`),
      "utf8",
    );
    assert.match(layout, /generateMetadata/);
    assert.match(layout, /entityMetadata/);
  }
});

test("scoring retains offline queue and handover controls", () => {
  const scoring = readFileSync(resolve(root, "features/scoring/use-live-scoring-page.tsx"), "utf8");
  assert.match(scoring, /saveToOfflineQueue/);
  assert.match(scoring, /Scorer Handover/);
});

test("match workflow keeps the active locale in admin navigation", () => {
  const matchList = readFileSync(resolve(root, "app/[locale]/admin/matches/page.tsx"), "utf8");
  const newMatch = readFileSync(resolve(root, "app/[locale]/admin/matches/new/page.tsx"), "utf8");
  const scoring = readFileSync(resolve(root, "features/scoring/use-live-scoring-page.tsx"), "utf8");
  const scorecard = readFileSync(resolve(root, "app/[locale]/admin/matches/scorecard/[id]/page.tsx"), "utf8");
  for (const source of [matchList, newMatch, scoring, scorecard]) assert.match(source, /localePath\(locale,/);
});

test("advanced scorer keeps free-hit, variable extras and mobile controls", () => {
  const scoring = readFileSync(resolve(root, "features/scoring/use-live-scoring-page.tsx"), "utf8");
  assert.match(scoring, /freeHitActive/);
  assert.match(scoring, /Advanced delivery/);
  assert.match(scoring, /Mobile quick scoring/);
  assert.match(scoring, /obstructing_field/);
  assert.match(scoring, /timed_out/);
  assert.match(scoring, /Voice Score/);
  assert.match(scoring, /SpeechRecognition/);
});

test("match analytics exposes phase, batting, bowling and CSV reports", () => {
  const analytics = readFileSync(resolve(root, "components/match-analytics-dashboard.tsx"), "utf8");
  assert.match(analytics, /Phase Performance/);
  assert.match(analytics, /Batting Report/);
  assert.match(analytics, /Bowling Report/);
  assert.match(analytics, /Download Analytics CSV/);
});

test("tournament operations expose readiness and preselected quick actions", () => {
  const editor = readFileSync(resolve(root, "components/tournament-editor.tsx"), "utf8");
  const newMatch = readFileSync(resolve(root, "app/[locale]/admin/matches/new/page.tsx"), "utf8");
  const newTeam = readFileSync(resolve(root, "app/[locale]/admin/teams/new/page.tsx"), "utf8");
  assert.match(editor, /Tournament command centre/);
  assert.match(editor, /Tournament squads are operationally ready/);
  assert.match(editor, /Schedule Match/);
  assert.match(newMatch, /URLSearchParams/);
  assert.match(newTeam, /URLSearchParams/);
});

test("standalone matches reuse the complete match and scoring workflow", () => {
  const newMatch = readFileSync(resolve(root, "app/[locale]/admin/matches/new/page.tsx"), "utf8");
  const matchList = readFileSync(resolve(root, "app/[locale]/admin/matches/page.tsx"), "utf8");
  const newTeam = readFileSync(resolve(root, "app/[locale]/admin/teams/new/page.tsx"), "utf8");
  const migration = readFileSync(resolve(root, "supabase/migrations/20260728174838_add_standalone_matches.sql"), "utf8");
  assert.match(newMatch, /Standalone match/);
  assert.match(newMatch, /friendly/);
  assert.match(newMatch, /school/);
  assert.match(newMatch, /match_squads/);
  assert.match(matchList, /match_scope/);
  assert.match(newTeam, /Standalone team/);
  assert.match(migration, /private\.can_manage_match/);
  assert.match(migration, /private\.can_score_match/);
});

test("team sheet can register a late player and return to the same match", () => {
  const teamSheet = readFileSync(resolve(root, "app/[locale]/admin/matches/teamsheet/[id]/page.tsx"), "utf8");
  const newPlayer = readFileSync(resolve(root, "app/[locale]/admin/players/new/page.tsx"), "utf8");
  assert.match(teamSheet, /Add Player to/);
  assert.match(teamSheet, /returnTo=/);
  assert.match(teamSheet, /team=/);
  assert.match(newPlayer, /requestedTeam/);
  assert.match(newPlayer, /requestedReturn/);
  assert.match(newPlayer, /router\.push\(localePath\(locale, returnPath\)\)/);
});

test("team management can securely replace a team logo", () => {
  const manageTeam = readFileSync(resolve(root, "app/[locale]/admin/teams/[id]/page.tsx"), "utf8");
  assert.match(manageTeam, /uploadImage\(logoFile, "team-logos"\)/);
  assert.match(manageTeam, /logo_url: logoUrl/);
  assert.match(manageTeam, /Change team logo/);
  assert.match(manageTeam, /image\/jpeg,image\/png,image\/webp/);
});

test("player registration supports hide/unhide and organizer approval", () => {
  const editor = readFileSync(resolve(root, "components/tournament-editor.tsx"), "utf8");
  const form = readFileSync(resolve(root, "app/[locale]/(public)/register-player/page.tsx"), "utf8");
  const queue = readFileSync(resolve(root, "app/[locale]/admin/player-registrations/page.tsx"), "utf8");
  assert.match(editor, /player_registration_enabled/);
  assert.match(editor, /Visible — public players can submit applications/);
  assert.match(form, /Same jersey number is allowed/);
  assert.match(form, /consent_given/);
  assert.match(form, /uploadRequest\.set\("file"/);
  assert.match(form, /uploadRequest\.set\("captchaToken"/);
  assert.match(form, /readJson<MediaUpload>/);
  assert.doesNotMatch(form, /api_key|signature\.signature|res\.cloudinary\.com\/v1_1/);
  assert.match(queue, /Approve & Add/);
});

test("team and player rankings are available to admins and public viewers", () => {
  const dashboard = readFileSync(resolve(root, "components/tournament-rankings-dashboard.tsx"), "utf8");
  const engine = readFileSync(resolve(root, "lib/tournament-rankings.ts"), "utf8");
  assert.match(dashboard, /Team Ranking/);
  assert.match(dashboard, /Batsman Ranking/);
  assert.match(dashboard, /Bowler Ranking/);
  assert.match(dashboard, /All-rounder Ranking/);
  assert.match(engine, /result_type === "no_result"/);
  assert.match(engine, /allRounderPoints/);
});

test("live auction is modular, realtime and transaction-backed", () => {
  const dashboard = readFileSync(resolve(root, "components/live-auction-dashboard.tsx"), "utf8");
  const auctionComponents = readFileSync(resolve(root, "features/auction/components.tsx"), "utf8");
  const registration = readFileSync(resolve(root, "app/[locale]/(public)/register-player/page.tsx"), "utf8");
  const migration = readFileSync(resolve(root, "supabase/migrations/20260729172101_bulk_auction_player_cards.sql"), "utf8");
  const ocrMigration = readFileSync(resolve(root, "supabase/migrations/20260729192316_update_bulk_auction_player_ocr_text.sql"), "utf8");
  const ocr = readFileSync(resolve(root, "lib/auction-card-ocr.ts"), "utf8");
  assert.match(dashboard, /Live Player Auction/);
  assert.match(dashboard, /postgres_changes/);
  assert.match(dashboard, /sell_auction_player/);
  assert.match(dashboard, /Bulk Card Downloads/);
  assert.match(dashboard, /Bulk Player Profile Card Upload/);
  assert.match(dashboard, /create_bulk_auction_players/);
  assert.match(dashboard, /playerDetailsFromFilename/);
  assert.match(dashboard, /Complete & Hide/);
  assert.match(auctionComponents, /latestPlayerActions/);
  assert.match(dashboard, /Scan Cards to Text/);
  assert.match(dashboard, /AuctionPlayerDetailsDialog/);
  assert.match(dashboard, /points/);
  assert.match(dashboard, /recognizeAuctionCard/);
  assert.match(dashboard, /\["available","live","sold","unsold"\]/);
  assert.doesNotMatch(registration, /kind: "player"/);
  assert.match(migration, /drop trigger if exists create_auction_player_for_registration/);
  assert.match(migration, /source_type in \('registration', 'bulk_upload'\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /grant execute on function public\.create_bulk_auction_players/);
  assert.match(ocrMigration, /update_bulk_auction_player_text/);
  assert.match(ocr, /createWorker/);
  assert.match(ocr, /PSM\.SINGLE_LINE/);
  const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");
  assert.match(nextConfig, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(nextConfig, /wasm-unsafe-eval/);
});

test("bulk auction cards become cropped player profile photos when sold", () => {
  const migration = readFileSync(resolve(root, "supabase/migrations/20260803183000_match_squad_player_card_crop.sql"), "utf8");
  assert.match(migration, /auction_profile_photo_url/);
  assert.match(migration, /c_crop,x_80,y_328,w_351,h_351/);
  assert.match(migration, /c_fill,w_1200,h_1200,q_auto,f_auto/);
  assert.match(migration, /source_type = 'bulk_upload'/);
});

test("bulk auction card OCR saves the real player phone number", () => {
  const ocr = readFileSync(resolve(root, "lib/auction-card-ocr.ts"), "utf8");
  const dashboard = readFileSync(resolve(root, "components/live-auction-dashboard.tsx"), "utf8");
  const migration = readFileSync(resolve(root, "supabase/migrations/20260803183100_capture_auction_player_phone.sql"), "utf8");
  assert.match(ocr, /contactNumber/);
  assert.match(ocr, /extractPhoneNumber/);
  assert.match(dashboard, /p_contact_number/);
  assert.match(migration, /sync_auction_player_contact/);
});

test("bulk auction card OCR saves batting and bowling styles", () => {
  const ocr = readFileSync(resolve(root, "lib/auction-card-ocr.ts"), "utf8");
  const dashboard = readFileSync(resolve(root, "components/live-auction-dashboard.tsx"), "utf8");
  const migration = readFileSync(resolve(root, "supabase/migrations/20260803183200_capture_auction_player_styles.sql"), "utf8");
  assert.match(ocr, /battingStyle/);
  assert.match(ocr, /bowlingStyle/);
  assert.match(ocr, /cleanPlayingStyle/);
  assert.match(dashboard, /p_batting_style/);
  assert.match(dashboard, /p_bowling_style/);
  assert.match(migration, /batting_style = coalesce/);
  assert.match(migration, /bowling_style = coalesce/);
  assert.match(dashboard, /playerToSell = await scanPlayerCard\(selected\)/);
});

test("player cards use stored template layouts instead of renderer coordinates", () => {
  const renderer = readFileSync(resolve(root, "lib/auction-card-generator.ts"), "utf8");
  const editor = readFileSync(resolve(root, "components/player-card-layout-editor.tsx"), "utf8");
  const route = readFileSync(resolve(root, "app/api/auction/cards/route.ts"), "utf8");
  assert.match(renderer, /normalizePlayerCardLayout\(data\.layout\)/);
  assert.match(renderer, /withMetadata\(\{ density: 300 \}\)/);
  assert.match(editor, /Configure \{templateName\}/);
  assert.match(editor, /fontFamily/);
  assert.match(editor, /fontColour/);
  assert.match(route, /template_layout/);
  assert.match(route, /player-cards/);
});
