import test from "node:test";
import assert from "node:assert/strict";
import { generateMatchDayDates, generateSingleRoundRobin, scheduleRoundRobinMatches, validateSingleRoundRobin } from "../lib/round-robin.ts";

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

test("selected weekend dates skip weekdays between tournament weekends", () => {
  assert.deepEqual(generateMatchDayDates({ mode: "weekdays", startDate: "2026-08-22", dayCount: 4, weekdays: [6, 0] }), ["2026-08-22", "2026-08-23", "2026-08-29", "2026-08-30"]);
});

test("selected weekdays support mixed weekday and weekend schedules", () => {
  assert.deepEqual(generateMatchDayDates({ mode: "weekdays", startDate: "2026-08-22", dayCount: 4, weekdays: [3, 6, 0] }), ["2026-08-22", "2026-08-23", "2026-08-26", "2026-08-29"]);
});

test("custom dates are sorted, deduplicated and used exactly", () => {
  assert.deepEqual(generateMatchDayDates({ mode: "custom", startDate: "2026-08-22", dayCount: 4, customDates: ["2026-08-30", "2026-08-22", "2026-08-29", "2026-08-23", "2026-08-22"] }), ["2026-08-22", "2026-08-23", "2026-08-29", "2026-08-30"]);
});

test("custom dates reject impossible calendar dates", () => {
  assert.throws(() => generateMatchDayDates({ mode: "custom", startDate: "2026-08-22", dayCount: 2, customDates: ["2026-08-22", "2026-02-30"] }), /valid YYYY-MM-DD/);
});

test("duplicate team ids are rejected when fewer than two unique teams remain", () => {
  assert.throws(() => generateSingleRoundRobin(["team-1", "team-1"]), /two unique teams/);
});

for (const teamCount of [3, 4, 5, 6, 7, 8, 9, 10, 12, 16]) {
  test(`daily schedule prevents consecutive appearances for ${teamCount} teams`, () => {
    const ids = Array.from({ length: teamCount }, (_, index) => `team-${index + 1}`);
    const matchesPerDay = Math.min(7, teamCount * (teamCount - 1) / 2);
    const schedule = scheduleRoundRobinMatches(generateSingleRoundRobin(ids), matchesPerDay);
    assert.equal(schedule.length, teamCount * (teamCount - 1) / 2);
    for (let index = 1; index < schedule.length; index += 1) {
      const previous = schedule[index - 1];
      const current = schedule[index];
      if (previous.dayIndex !== current.dayIndex) continue;
      assert.equal([previous.teamAId, previous.teamBId].includes(current.teamAId), false);
      assert.equal([previous.teamAId, previous.teamBId].includes(current.teamBId), false);
    }
  });
}
