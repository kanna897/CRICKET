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
  "app/[locale]/admin/players/import/page.tsx",
  "app/[locale]/admin/settings/page.tsx",
];

test("required viewer and admin routes exist", () => {
  for (const route of routes) assert.equal(existsSync(resolve(root, route)), true, `${route} must exist`);
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
});

test("scoring retains offline queue and handover controls", () => {
  const scoring = readFileSync(resolve(root, "app/[locale]/admin/matches/score/[id]/page.tsx"), "utf8");
  assert.match(scoring, /saveToOfflineQueue/);
  assert.match(scoring, /Scorer Handover/);
});
