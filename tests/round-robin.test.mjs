import test from "node:test";
import assert from "node:assert/strict";
import { generateSingleRoundRobin, validateSingleRoundRobin } from "../lib/round-robin.ts";

for (const teamCount of [3, 4, 5, 6, 7, 8, 9, 10, 12, 16]) {
  test(`single round robin is valid for ${teamCount} teams`, () => {
    const ids = Array.from({ length: teamCount }, (_, index) => `team-${index + 1}`);
    const rounds = generateSingleRoundRobin(ids);
    const expectedRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
    assert.equal(rounds.length, expectedRounds);
    assert.equal(rounds.flatMap((round) => round.matches).length, teamCount * (teamCount - 1) / 2);
    assert.equal(validateSingleRoundRobin(ids, rounds), true);
    for (const round of rounds) {
      assert.equal(round.matches.length, Math.floor(teamCount / 2));
      assert.equal(Boolean(round.byeTeamId), teamCount % 2 === 1);
    }
  });
}

test("duplicate team ids are rejected when fewer than two unique teams remain", () => {
  assert.throws(() => generateSingleRoundRobin(["team-1", "team-1"]), /two unique teams/);
});
