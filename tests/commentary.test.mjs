import test from "node:test";
import assert from "node:assert/strict";
import { generateCommentary } from "../lib/commentary.ts";

const delivery = {
  over: 1,
  ball: 3,
  batterName: "Eagles Test Player 4",
  bowlerName: "Mylankadu Test Player 1",
  runs: 0,
  extras: 0,
  teamScore: 16,
  overs: "0.3",
  batterScore: 8,
  bowlerRuns: 16,
  bowlerWickets: 0,
  partnership: 16,
};

test("six commentary reads like a professional broadcast call", () => {
  const result = generateCommentary({ ...delivery, runs: 6, teamScore: 22, batterScore: 14, shotZone: "fine_leg" });
  assert.match(result, /^1\.3: Mylankadu Test Player 1 to Eagles Test Player 4 — SIX!/);
  assert.match(result, /launched over fine leg/);
  assert.match(result, /Score: 22 after 0\.3 overs\./);
  assert.doesNotMatch(result, /adds six runs|Shot played towards/);
});

test("no-ball commentary combines bat runs, extras and free-hit context", () => {
  const result = generateCommentary({
    ...delivery,
    runs: 2,
    extras: 1,
    extrasType: "no_ball",
    teamScore: 19,
    shotZone: "cover",
  });
  assert.match(result, /NO BALL!/);
  assert.match(result, /adds two runs through the covers/);
  assert.match(result, /3 runs from the delivery/);
});

test("chase commentary includes the live equation", () => {
  const result = generateCommentary({ ...delivery, runs: 1, requiredRuns: 12, ballsRemaining: 8 });
  assert.match(result, /12 runs needed from 8 balls\./);
});

test("milestones receive broadcast-quality emphasis", () => {
  const result = generateCommentary({ ...delivery, runs: 4, batterScore: 50, teamScore: 100, partnership: 50 });
  assert.match(result, /FIFTY for Eagles Test Player 4/);
  assert.match(result, /team total reaches 100/);
  assert.match(result, /fifty-run partnership/);
});
