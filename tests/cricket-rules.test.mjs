import test from "node:test";
import assert from "node:assert/strict";
import {
  getWicketLimit,
  isBowlerCreditedDismissal,
  isHatTrick,
  runsChargedToBowler,
  shouldActivateLastMan,
} from "../lib/cricket-rules.ts";

test("only international bowler-credit dismissals add a bowling wicket", () => {
  for (const dismissal of ["bowled", "caught", "caught and bowled", "lbw", "stumped", "hit_wicket"]) {
    assert.equal(isBowlerCreditedDismissal(dismissal), true, dismissal);
  }
  for (const dismissal of ["run_out", "retired_hurt", "retired_out", "obstructing_field", "timed_out", null]) {
    assert.equal(isBowlerCreditedDismissal(dismissal), false, String(dismissal));
  }
});

test("byes and leg byes are not charged to the bowler", () => {
  assert.equal(runsChargedToBowler({ runs: 0, extras: 4, extras_type: "bye" }), 0);
  assert.equal(runsChargedToBowler({ runs: 0, extras: 2, extras_type: "leg_bye" }), 0);
  assert.equal(runsChargedToBowler({ runs: 4, extras: 1, extras_type: "no_ball" }), 5);
  assert.equal(runsChargedToBowler({ runs: 0, extras: 1, extras_type: "wide" }), 1);
});

test("hat-trick requires three consecutive legal bowler-credit wickets", () => {
  const wicket = { is_legal: true, is_wicket: true, dismissal_type: "caught" };
  assert.equal(isHatTrick([wicket, wicket], { ...wicket, dismissal_type: "bowled" }), true);
  assert.equal(isHatTrick([wicket, { ...wicket, dismissal_type: "run_out" }], wicket), false);
  assert.equal(isHatTrick([wicket, wicket], { ...wicket, is_legal: false }), false);
});

test("wicket limits respect squad size, custom limits and Last Man Stands", () => {
  assert.equal(getWicketLimit({ squadSize: 11, configuredWickets: 10, lastManStands: false }), 10);
  assert.equal(getWicketLimit({ squadSize: 6, configuredWickets: 10, lastManStands: false }), 5);
  assert.equal(getWicketLimit({ squadSize: 6, configuredWickets: 10, lastManStands: true }), 6);
  assert.equal(getWicketLimit({ squadSize: 11, configuredWickets: 5, lastManStands: true }), 5);
});

test("Last Man Stands activates only when the final pair loses a batter", () => {
  assert.equal(shouldActivateLastMan({ currentWickets: 4, wicketLimit: 6, lastManStands: true, availableReplacementBatters: 0 }), true);
  assert.equal(shouldActivateLastMan({ currentWickets: 3, wicketLimit: 6, lastManStands: true, availableReplacementBatters: 1 }), false);
  assert.equal(shouldActivateLastMan({ currentWickets: 4, wicketLimit: 5, lastManStands: false, availableReplacementBatters: 0 }), false);
});
