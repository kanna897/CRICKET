import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSimulatedOvers,
  initialSimulatedInnings,
  simulateDelivery,
  simulateInnings,
  simulatedMatchResult,
} from "./helpers/scoring-simulator.mjs";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

test("custom overs count only legal deliveries", () => {
  const rules = { overs: 1, ballsPerOver: 8, squadSize: 11, wicketsPerInnings: 10, lastManStands: false };
  let state = initialSimulatedInnings();
  for (let index = 0; index < 20; index++) {
    state = simulateDelivery(state, rules, { batterRuns: 0, extras: 1, legal: false, wicket: false });
  }
  assert.equal(state.legalBalls, 0);
  assert.equal(state.completed, false);
  for (let index = 0; index < 8; index++) {
    state = simulateDelivery(state, rules, { batterRuns: 1, extras: 0, legal: true, wicket: false });
  }
  assert.equal(state.completed, true);
  assert.equal(state.completionReason, "overs");
  assert.equal(formatSimulatedOvers(state.legalBalls, rules.ballsPerOver), "1.0");
});

test("Last Man Stands adds one available dismissal", () => {
  const normal = { overs: 20, ballsPerOver: 6, squadSize: 6, wicketsPerInnings: 10, lastManStands: false };
  const lastMan = { ...normal, lastManStands: true };
  let normalState = initialSimulatedInnings();
  let lastManState = initialSimulatedInnings();
  for (let index = 0; index < 5; index++) {
    const wicket = { batterRuns: 0, extras: 0, legal: true, wicket: true };
    normalState = simulateDelivery(normalState, normal, wicket);
    lastManState = simulateDelivery(lastManState, lastMan, wicket);
  }
  assert.equal(normalState.completed, true);
  assert.equal(lastManState.completed, false);
  lastManState = simulateDelivery(lastManState, lastMan, { batterRuns: 0, extras: 0, legal: true, wicket: true });
  assert.equal(lastManState.completed, true);
  assert.equal(lastManState.completionReason, "all_out");
});

test("a revised chase target closes immediately when reached", () => {
  const rules = { overs: 8, ballsPerOver: 6, squadSize: 11, wicketsPerInnings: 10, lastManStands: false, target: 37 };
  let state = initialSimulatedInnings();
  for (let index = 0; index < 6; index++) state = simulateDelivery(state, rules, { batterRuns: 6, extras: 0, legal: true, wicket: false });
  assert.equal(state.completed, false);
  state = simulateDelivery(state, rules, { batterRuns: 1, extras: 0, legal: true, wicket: false });
  assert.equal(state.completed, true);
  assert.equal(state.completionReason, "target");
  assert.equal(state.runs, 37);
});

test("scripted tape-ball match handles wides, no-balls and an exact chase", () => {
  const inningsRules = { overs: 2, ballsPerOver: 6, squadSize: 6, wicketsPerInnings: 5, lastManStands: false };
  const first = simulateInnings(inningsRules, [
    { batterRuns: 4, extras: 0, legal: true, wicket: false },
    { batterRuns: 0, extras: 1, legal: false, wicket: false },
    { batterRuns: 2, extras: 0, legal: true, wicket: false },
    { batterRuns: 0, extras: 0, legal: true, wicket: true },
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 1, extras: 1, legal: false, wicket: false },
    ...Array.from({ length: 8 }, () => ({ batterRuns: 1, extras: 0, legal: true, wicket: false })),
  ]);
  assert.deepEqual(
    { runs: first.runs, wickets: first.wickets, legalBalls: first.legalBalls, extras: first.extras, reason: first.completionReason },
    { runs: 23, wickets: 1, legalBalls: 12, extras: 2, reason: "overs" },
  );

  const chaseRules = { ...inningsRules, target: first.runs + 1 };
  const chase = simulateInnings(chaseRules, [
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 4, extras: 0, legal: true, wicket: false },
    { batterRuns: 0, extras: 0, legal: true, wicket: true },
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 0, extras: 1, legal: false, wicket: false },
    { batterRuns: 1, extras: 0, legal: true, wicket: false },
  ]);
  assert.equal(chase.runs, 24);
  assert.equal(chase.legalBalls, 6);
  assert.equal(chase.completionReason, "target");
  assert.equal(simulatedMatchResult({
    firstInningsRuns: first.runs,
    chase,
    chasingTeam: "Jaffna Kings",
    defendingTeam: "Northern Stars",
    chasingWicketLimit: 5,
  }).result, "Jaffna Kings won by 4 wickets");
});

test("a completed chase ignores accidental follow-up scoring events", () => {
  const rules = { overs: 5, ballsPerOver: 6, squadSize: 6, wicketsPerInnings: 5, lastManStands: false, target: 7 };
  const completed = simulateInnings(rules, [
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 1, extras: 0, legal: true, wicket: false },
  ]);
  const afterLateEvent = simulateDelivery(completed, rules, { batterRuns: 6, extras: 1, legal: false, wicket: true });
  assert.strictEqual(afterLateEvent, completed);
  assert.equal(afterLateEvent.runs, 7);
  assert.equal(afterLateEvent.wickets, 0);
});

test("match result reports ties and defending margins correctly", () => {
  const tied = simulatedMatchResult({
    firstInningsRuns: 48,
    chase: { runs: 48, wickets: 5 },
    chasingTeam: "Blue",
    defendingTeam: "Red",
    chasingWicketLimit: 5,
  });
  assert.deepEqual(tied, { winner: null, result: "Match tied" });

  const defended = simulatedMatchResult({
    firstInningsRuns: 48,
    chase: { runs: 47, wickets: 5 },
    chasingTeam: "Blue",
    defendingTeam: "Red",
    chasingWicketLimit: 5,
  });
  assert.deepEqual(defended, { winner: "Red", result: "Red won by 1 run" });
});

test("Last Man Stands chase reports remaining dismissals from its configured limit", () => {
  const rules = { overs: 5, ballsPerOver: 6, squadSize: 6, wicketsPerInnings: 6, lastManStands: true, target: 11 };
  const chase = simulateInnings(rules, [
    { batterRuns: 0, extras: 0, legal: true, wicket: true },
    { batterRuns: 0, extras: 0, legal: true, wicket: true },
    { batterRuns: 6, extras: 0, legal: true, wicket: false },
    { batterRuns: 4, extras: 1, legal: false, wicket: false },
  ]);
  assert.equal(chase.completionReason, "target");
  assert.equal(simulatedMatchResult({
    firstInningsRuns: 10,
    chase,
    chasingTeam: "LMS XI",
    defendingTeam: "Club XI",
    chasingWicketLimit: 6,
  }).result, "LMS XI won by 4 wickets");
});

test("10,000 deterministic deliveries preserve scoring invariants", () => {
  const random = seededRandom(20260726);
  const formats = [
    { overs: 5, ballsPerOver: 6, squadSize: 6, wicketsPerInnings: 5, lastManStands: false },
    { overs: 10, ballsPerOver: 8, squadSize: 8, wicketsPerInnings: 7, lastManStands: true },
    { overs: 20, ballsPerOver: 6, squadSize: 11, wicketsPerInnings: 10, lastManStands: false },
  ];
  let deliveries = 0;
  let completedInnings = 0;
  while (deliveries < 10_000) {
    const rules = formats[completedInnings % formats.length];
    let state = initialSimulatedInnings();
    while (!state.completed && deliveries < 10_000) {
      const before = state;
      const roll = random();
      const legal = roll > 0.09;
      const wicket = legal && roll > 0.965;
      const batterRuns = wicket ? 0 : [0, 1, 2, 3, 4, 6][Math.floor(random() * 6)];
      const extras = legal ? (random() > 0.97 ? 1 : 0) : 1 + Math.floor(random() * 3);
      state = simulateDelivery(state, rules, { batterRuns, extras, legal, wicket });
      assert.ok(state.runs >= before.runs);
      assert.ok(state.wickets >= before.wickets);
      assert.ok(state.legalBalls >= before.legalBalls);
      assert.equal(state.legalBalls - before.legalBalls, legal ? 1 : 0);
      assert.ok(state.legalBalls <= rules.overs * rules.ballsPerOver);
      deliveries++;
    }
    if (state.completed) completedInnings++;
  }
  assert.equal(deliveries, 10_000);
  assert.ok(completedInnings > 50);
});
