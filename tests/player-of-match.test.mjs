import test from "node:test";
import assert from "node:assert/strict";
import { rankPlayerOfMatch } from "../features/scoring/actions.ts";

const players = [
  { id: "winner", name: "Winner", team_id: "team-w", playing_role: null, photo_url: null },
  { id: "loser", name: "Loser", team_id: "team-l", playing_role: null, photo_url: null },
  { id: "loser-two", name: "Loser Two", team_id: "team-l", playing_role: null, photo_url: null },
  { id: "loser-three", name: "Loser Three", team_id: "team-l", playing_role: null, photo_url: null },
  { id: "winner-two", name: "Winner Two", team_id: "team-w", playing_role: null, photo_url: null },
];
const ball = (overrides = {}) => ({ batsman_id: null, bowler_id: null, runs: 0, extras: 0, extras_type: null, is_legal: true, is_wicket: false, dismissal_type: null, fielder_id: null, ...overrides });

test("POM prefers a winning-team player who is in the top three MVP performers", () => {
  const result = rankPlayerOfMatch([
    ...Array.from({ length: 11 }, () => ball({ batsman_id: "loser", runs: 6 })),
    ...Array.from({ length: 9 }, () => ball({ batsman_id: "winner", runs: 6 })),
    ...Array.from({ length: 7 }, () => ball({ batsman_id: "winner-two", runs: 4 })),
  ], players, "team-w");
  assert.equal(result?.playerId, "winner");
});

test("POM allows an extraordinary losing-side player when no winner is in the top three", () => {
  const result = rankPlayerOfMatch([
    ...Array.from({ length: 17 }, () => ball({ batsman_id: "loser", runs: 6 })),
    ...Array.from({ length: 5 }, () => ball({ batsman_id: "loser-two", runs: 6 })),
    ...Array.from({ length: 5 }, () => ball({ batsman_id: "loser-three", runs: 6 })),
    ...Array.from({ length: 2 }, () => ball({ batsman_id: "winner", runs: 1 })),
    ...Array.from({ length: 2 }, () => ball({ batsman_id: "winner-two", runs: 1 })),
  ], players, "team-w");
  assert.equal(result?.playerId, "loser");
});

test("POM credits wickets, bowling economy and fielding events", () => {
  const result = rankPlayerOfMatch([
    ...Array.from({ length: 6 }, () => ball({ bowler_id: "winner", is_wicket: true, dismissal_type: "caught", fielder_id: "winner" })),
    ...Array.from({ length: 6 }, () => ball({ batsman_id: "loser", runs: 4 })),
  ], players, "team-w");
  assert.equal(result?.playerId, "winner");
});
